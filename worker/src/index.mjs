import { AGENT_PROMPT } from "./prompt.mjs";
import {
  agentContextPart,
  agentToolConfig,
  appendToolTrace,
  cleanAgentContext,
  cleanToolTrace,
  extractToolCalls
} from "./tools.mjs";

const BODY_LIMIT = 4 * 1024 * 1024;
const MESSAGE_LIMIT = 2000;
const HISTORY_LIMIT = 12;
const IMAGE_BYTE_LIMIT = 1536 * 1024;
const IMAGE_BASE64_LIMIT = Math.ceil(IMAGE_BYTE_LIMIT * 4 / 3) + 8;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 30;
const REQUEST_TIMEOUT_MS = 60 * 1000;
const RETRY_DELAYS_MS = [600, 1400];
const DEFAULT_ORIGINS = [
  "http://127.0.0.1:4173",
  "http://localhost:4173",
  "https://hexin-11.github.io"
];
const rateBuckets = new Map();

const LESSON_VISION_PROMPT = `你是英语课程资料的高精度视觉整理器。请只依据图片中实际可见的内容，输出结构化课程数据。

识别规则：
1. 优先寻找课程标题、单词表、短语表、问题、回答和例句。
2. 表格的一行可能同时有两组“英文｜中文”词条，必须从左到右逐组提取，不能漏项、串列或把表头当词条。
3. 英文段落可能被版面自动换行。必须把同一句被拆开的多行合并成完整句子；每个问题和每个回答分别作为一条 sentence。
4. 行内绿色或小号中文通常只是单词注释，不是整句翻译。sentence.chinese 必须是对应完整英文句子的自然中文翻译。
5. words 只放图片里明确出现的单词或短语；chinese 保留图片中的完整释义；ipa 提供标准英语音标。不要从课文随意提取普通词充数。
6. 排除 OCR 碎片、乱码、页码、装饰文字、孤立字母和不完整句子。模糊到无法确认的内容不要猜测。
7. 保持图片中的先后顺序，不要改写英文原文，不要补写图片中没有出现的问答内容。
8. rawText 按阅读顺序保存校正后的可见文字，便于用户核对。

只返回符合指定 JSON 结构的数据，不要输出说明、Markdown 或代码块。`;

const LESSON_VISION_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    words: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          english: { type: "STRING" },
          ipa: { type: "STRING" },
          chinese: { type: "STRING" }
        },
        required: ["english", "ipa", "chinese"]
      }
    },
    sentences: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          english: { type: "STRING" },
          chinese: { type: "STRING" }
        },
        required: ["english", "chinese"]
      }
    },
    rawText: { type: "STRING" }
  },
  required: ["title", "words", "sentences", "rawText"]
};

function allowedOrigins(env) {
  return new Set(
    String(env.ALLOWED_ORIGINS || DEFAULT_ORIGINS.join(","))
      .split(",")
      .map((origin) => origin.trim().replace(/\/$/, ""))
      .filter(Boolean)
  );
}

function corsHeaders(request, env) {
  const origin = String(request.headers.get("Origin") || "").replace(/\/$/, "");
  if (!origin || origin === "null") return {};
  if (!allowedOrigins(env).has(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function json(value, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      ...extraHeaders
    }
  });
}

function clientIp(request) {
  return String(
    request.headers.get("CF-Connecting-IP")
      || request.headers.get("X-Forwarded-For")
      || "unknown"
  ).split(",")[0].trim();
}

function rateAllowed(ip) {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.startedAt >= RATE_WINDOW_MS) {
    rateBuckets.set(ip, { startedAt: now, count: 1 });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= RATE_MAX;
}

function cleanMessage(value) {
  return typeof value === "string" ? value.trim().slice(0, MESSAGE_LIMIT) : "";
}

function cleanHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(-HISTORY_LIMIT).flatMap((item) => {
    const role = item?.role === "assistant" ? "assistant" : item?.role === "user" ? "user" : "";
    const content = cleanMessage(item?.content);
    return role && content ? [{ role, content }] : [];
  });
}

function decodeBase64(data) {
  try {
    const binary = atob(data);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

export function matchesImageSignature(bytes, mimeType) {
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
  }
  if (mimeType === "image/webp") {
    const ascii = (start, length) => String.fromCharCode(...bytes.slice(start, start + length));
    return bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP";
  }
  return false;
}

export function cleanImage(value) {
  if (value == null) return null;
  if (!value || typeof value !== "object") throw publicError("INVALID_IMAGE", 400);
  const mimeType = String(value.mimeType || "").trim().toLowerCase();
  const data = typeof value.data === "string" ? value.data.trim() : "";
  if (!IMAGE_TYPES.has(mimeType)
      || !data
      || data.length > IMAGE_BASE64_LIMIT
      || data.length % 4 !== 0
      || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
    throw publicError("INVALID_IMAGE", 400);
  }
  const bytes = decodeBase64(data);
  if (!bytes?.length || bytes.length > IMAGE_BYTE_LIMIT) throw publicError("IMAGE_TOO_LARGE", 413);
  if (!matchesImageSignature(bytes, mimeType)) throw publicError("INVALID_IMAGE", 400);
  return { mimeType, data };
}

export function cleanAssistantText(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/__([^_\n]+)__/g, "$1")
    .replace(/`{1,3}([^`\n]+)`{1,3}/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1")
    .replace(/\*{2,}|_{2,}|#{2,}/g, "")
    .replace(/[ \t]+([，。！？；：,.!?;:])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function outputText(payload) {
  const text = (payload?.candidates?.[0]?.content?.parts || [])
    .map((part) => typeof part?.text === "string" ? part.text : "")
    .join("")
    .trim();
  return cleanAssistantText(text);
}

function candidateText(payload) {
  return (payload?.candidates?.[0]?.content?.parts || [])
    .map((part) => typeof part?.text === "string" ? part.text : "")
    .join("")
    .trim();
}

function safeVisionText(value, maxLength) {
  return String(value || "").replace(/\u0000/g, "").trim().slice(0, maxLength);
}

function reliableEnglish(value, sentenceMode = false) {
  const text = safeVisionText(value, sentenceMode ? 600 : 120);
  const tokens = text.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || [];
  if (!tokens.length || tokens.some((token) => token.length === 1 && !/^(?:a|I)$/i.test(token))) return false;
  if (!sentenceMode) return tokens.length <= 7;
  const suspiciousCaps = tokens.filter((token) => /^[A-Z]{2,3}$/.test(token));
  const vowelLess = tokens.filter((token) => token.length >= 3 && !/[aeiouy]/i.test(token));
  return tokens.length >= 3
    && suspiciousCaps.length < 2
    && vowelLess.length <= Math.max(1, Math.floor(tokens.length / 3));
}

export function normalizeLessonVision(value) {
  const source = value && typeof value === "object" ? value : {};
  const wordKeys = new Set();
  const sentenceKeys = new Set();
  const words = (Array.isArray(source.words) ? source.words : []).flatMap((word) => {
    const english = safeVisionText(word?.english, 120).replace(/\s+/g, " ");
    const chinese = safeVisionText(word?.chinese, 240).replace(/\s+/g, " ");
    const key = english.toLocaleLowerCase("en");
    if (!reliableEnglish(english) || !/[\u3400-\u9fff]/u.test(chinese) || wordKeys.has(key)) return [];
    wordKeys.add(key);
    return [{ english, ipa: safeVisionText(word?.ipa, 120), chinese }];
  }).slice(0, 300);
  const sentences = (Array.isArray(source.sentences) ? source.sentences : []).flatMap((sentence) => {
    const english = safeVisionText(sentence?.english, 600).replace(/\s+/g, " ");
    const chinese = safeVisionText(sentence?.chinese, 800).replace(/\s+/g, " ");
    const key = english.toLocaleLowerCase("en");
    if (!reliableEnglish(english, true) || !/[\u3400-\u9fff]/u.test(chinese) || sentenceKeys.has(key)) return [];
    sentenceKeys.add(key);
    return [{ english, chinese }];
  }).slice(0, 220);
  return {
    title: safeVisionText(source.title, 180),
    words,
    sentences,
    rawText: safeVisionText(source.rawText, 120000)
  };
}

function parseLessonVision(payload) {
  const raw = candidateText(payload).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw publicError("INVALID_VISION_RESPONSE", 502);
  }
  const lesson = normalizeLessonVision(parsed);
  if (!lesson.words.length && !lesson.sentences.length) throw publicError("EMPTY_VISION_RESPONSE", 502);
  return lesson;
}

export function geminiContents(history, message, image, context = {}, trace = []) {
  const latestParts = [{ text: `${message}${agentContextPart(context)}` }];
  if (image) latestParts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
  const contents = [
    ...history.map((item) => ({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: item.content }]
    })),
    { role: "user", parts: latestParts }
  ];
  return appendToolTrace(contents, trace);
}

function publicError(code, statusCode, upstreamStatus = 0) {
  const error = new Error(code);
  error.statusCode = statusCode;
  error.upstreamStatus = upstreamStatus;
  return error;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function createAgentReply(env, message, history, image, context, trace) {
  const model = String(env.GEMINI_MODEL || "gemini-flash-latest").trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: AGENT_PROMPT }] },
          contents: geminiContents(history, message, image, context, trace),
          ...agentToolConfig(),
          generationConfig: {
            maxOutputTokens: 900,
            temperature: 0.7,
            ...(image ? { mediaResolution: "MEDIA_RESOLUTION_HIGH" } : {})
          }
        }),
        signal: controller.signal
      });
      const requestId = response.headers.get("x-request-id") || response.headers.get("x-goog-request-id") || "unavailable";
      const payload = await response.json().catch(() => ({}));
      if (response.ok) {
        const toolCalls = extractToolCalls(payload);
        if (toolCalls.length) return { toolCalls, requestId, model };
        const reply = outputText(payload);
        if (!reply) throw publicError("EMPTY_RESPONSE", 502, response.status);
        return { reply, requestId, model };
      }

      const upstreamCode = payload?.error?.status || payload?.error?.code || "unknown";
      const retryable = response.status === 429 || response.status >= 500 || upstreamCode === "RESOURCE_EXHAUSTED";
      console.error("Gemini request failed", { status: response.status, requestId, code: upstreamCode, attempt: attempt + 1 });
      if (retryable && attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      if (response.status === 429 || upstreamCode === "RESOURCE_EXHAUSTED") {
        throw publicError("RATE_LIMITED", 429, response.status);
      }
      if ([400, 401, 403].includes(response.status)) {
        throw publicError("AGENT_NOT_CONFIGURED", 503, response.status);
      }
      throw publicError("UPSTREAM_UNAVAILABLE", 502, response.status);
    }
    throw publicError("UPSTREAM_UNAVAILABLE", 502);
  } catch (error) {
    if (error?.name === "AbortError") throw publicError("TIMEOUT", 504);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function createLessonVision(env, image) {
  const model = String(env.GEMINI_MODEL || "gemini-flash-latest").trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: LESSON_VISION_PROMPT }] },
          contents: [{
            role: "user",
            parts: [
              { text: "请把这张英语学习资料准确整理成课程。" },
              { inlineData: { mimeType: image.mimeType, data: image.data } }
            ]
          }],
          generationConfig: {
            maxOutputTokens: 5000,
            temperature: 0.1,
            mediaResolution: "MEDIA_RESOLUTION_HIGH",
            responseMimeType: "application/json",
            responseSchema: LESSON_VISION_SCHEMA
          }
        }),
        signal: controller.signal
      });
      const requestId = response.headers.get("x-request-id") || response.headers.get("x-goog-request-id") || "unavailable";
      const payload = await response.json().catch(() => ({}));
      if (response.ok) return { lesson: parseLessonVision(payload), requestId, model };

      const upstreamCode = payload?.error?.status || payload?.error?.code || "unknown";
      const retryable = response.status === 429 || response.status >= 500 || upstreamCode === "RESOURCE_EXHAUSTED";
      console.error("Gemini lesson vision failed", { status: response.status, requestId, code: upstreamCode, attempt: attempt + 1 });
      if (retryable && attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      if (response.status === 429 || upstreamCode === "RESOURCE_EXHAUSTED") throw publicError("RATE_LIMITED", 429, response.status);
      if ([400, 401, 403].includes(response.status)) throw publicError("AGENT_NOT_CONFIGURED", 503, response.status);
      throw publicError("UPSTREAM_UNAVAILABLE", 502, response.status);
    }
    throw publicError("UPSTREAM_UNAVAILABLE", 502);
  } catch (error) {
    if (error?.name === "AbortError") throw publicError("TIMEOUT", 504);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function readJson(request) {
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > BODY_LIMIT) throw publicError("BODY_TOO_LARGE", 413);
  try {
    return JSON.parse(text || "{}");
  } catch {
    throw publicError("INVALID_JSON", 400);
  }
}

function errorResponse(error, cors) {
  const status = error?.statusCode || 500;
  const messages = {
    400: "图片或消息格式不正确，请重新选择图片后再试。",
    413: "图片或消息过大，请换一张更小的图片。",
    429: "Gemini 当前额度或速率已用完，请稍后再试。",
    502: "Gemini 暂时繁忙，小何已自动重试，请稍后再试。",
    503: "小何的 Gemini API 密钥尚未配置或不可用。",
    504: "小何这次思考太久了，请重新发送。"
  };
  return json({ error: error?.message || "SERVER_ERROR", message: messages[status] || "服务器暂时出现问题。" }, status, cors);
}

export async function handleRequest(request, env) {
  const cors = corsHeaders(request, env);
  if (cors == null) return json({ error: "ORIGIN_NOT_ALLOWED", message: "此网页来源未获准访问小何。" }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  const url = new URL(request.url);
  const model = String(env.GEMINI_MODEL || "gemini-flash-latest").trim();
  if (request.method === "GET" && url.pathname === "/health") {
    return json({
      ok: true,
      service: "xiaohe-agent",
      runtime: "cloudflare-worker",
      provider: "gemini",
      model,
      configured: Boolean(String(env.GEMINI_API_KEY || "").trim()),
      capabilities: { text: true, vision: true, lessonVision: true, tools: true, planning: true, approvals: true }
    }, 200, cors);
  }
  const isChatRequest = request.method === "POST" && url.pathname === "/api/chat";
  const isLessonVisionRequest = request.method === "POST" && url.pathname === "/api/lesson-vision";
  if (!isChatRequest && !isLessonVisionRequest) return json({ error: "NOT_FOUND" }, 404, cors);
  if (!String(env.GEMINI_API_KEY || "").trim()) {
    return json({ error: "AGENT_NOT_CONFIGURED", message: "小何的后端还没有配置密钥。" }, 503, cors);
  }
  if (!rateAllowed(clientIp(request))) {
    return json({ error: "RATE_LIMITED", message: "小何需要休息一下，请稍后再试。" }, 429, cors);
  }

  try {
    const body = await readJson(request);
    const image = cleanImage(body.image);
    if (isLessonVisionRequest) {
      if (!image) return json({ error: "INVALID_IMAGE", message: "请选择需要识别的课程图片。" }, 400, cors);
      const result = await createLessonVision(env, image);
      return json({
        lesson: result.lesson,
        provider: "gemini",
        model: result.model,
        requestId: result.requestId
      }, 200, cors);
    }
    const message = cleanMessage(body.message) || (image ? "请仔细识别这张图片，并结合英语学习给出准确、简洁的说明。" : "");
    const history = cleanHistory(body.history);
    const context = cleanAgentContext(body.context);
    const trace = cleanToolTrace(body.trace);
    if (!message) return json({ error: "EMPTY_MESSAGE", message: "请输入想对小何说的话。" }, 400, cors);
    const result = await createAgentReply(env, message, history, image, context, trace);
    return json({
      reply: result.reply || "",
      toolCalls: result.toolCalls || [],
      provider: "gemini",
      model: result.model,
      requestId: result.requestId
    }, 200, cors);
  } catch (error) {
    console.error("Worker request failed", { code: error?.message || "SERVER_ERROR", status: error?.statusCode || 500 });
    return errorResponse(error, cors);
  }
}

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  }
};
