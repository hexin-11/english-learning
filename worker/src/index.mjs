import { AGENT_PROMPT } from "./prompt.mjs";

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

export function geminiContents(history, message, image) {
  const latestParts = [{ text: message }];
  if (image) latestParts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
  return [
    ...history.map((item) => ({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: item.content }]
    })),
    { role: "user", parts: latestParts }
  ];
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

async function createAgentReply(env, message, history, image) {
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
          contents: geminiContents(history, message, image),
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
      capabilities: { text: true, vision: true }
    }, 200, cors);
  }
  if (request.method !== "POST" || url.pathname !== "/api/chat") return json({ error: "NOT_FOUND" }, 404, cors);
  if (!String(env.GEMINI_API_KEY || "").trim()) {
    return json({ error: "AGENT_NOT_CONFIGURED", message: "小何的后端还没有配置密钥。" }, 503, cors);
  }
  if (!rateAllowed(clientIp(request))) {
    return json({ error: "RATE_LIMITED", message: "小何需要休息一下，请稍后再试。" }, 429, cors);
  }

  try {
    const body = await readJson(request);
    const image = cleanImage(body.image);
    const message = cleanMessage(body.message) || (image ? "请仔细识别这张图片，并结合英语学习给出准确、简洁的说明。" : "");
    const history = cleanHistory(body.history);
    if (!message) return json({ error: "EMPTY_MESSAGE", message: "请输入想对小何说的话。" }, 400, cors);
    const result = await createAgentReply(env, message, history, image);
    return json({ reply: result.reply, provider: "gemini", model: result.model, requestId: result.requestId }, 200, cors);
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
