"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL, pathToFileURL } = require("node:url");
const AGENT_PROMPT = require("./prompt");

const ROOT = path.resolve(__dirname, "..");
const agentToolsPromise = import(pathToFileURL(path.join(ROOT, "worker", "src", "tools.mjs")).href);
loadLocalEnv(path.join(ROOT, ".env.local"));

const PORT = numberInRange(process.env.PORT, 8787, 1, 65535);
const HOST = String(process.env.HOST || "0.0.0.0").trim();
const MODEL = String(process.env.GEMINI_MODEL || "gemini-3.5-flash").trim();
const API_KEY = String(process.env.GEMINI_API_KEY || "").trim();
const BODY_LIMIT = 4 * 1024 * 1024;
const MESSAGE_LIMIT = 2000;
const HISTORY_LIMIT = 12;
const IMAGE_BYTE_LIMIT = 1536 * 1024;
const IMAGE_BASE64_LIMIT = Math.ceil(IMAGE_BYTE_LIMIT * 4 / 3) + 8;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 30;
const REQUEST_TIMEOUT_MS = 60 * 1000;
const defaultOrigins = [
  "http://127.0.0.1:4173",
  "http://localhost:4173",
  "https://hexin-11.github.io"
];
const allowedOrigins = new Set(
  String(process.env.ALLOWED_ORIGINS || defaultOrigins.join(","))
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean)
);
const rateBuckets = new Map();

function loadLocalEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!Object.prototype.hasOwnProperty.call(process.env, key)) process.env[key] = value;
  }
}

function numberInRange(value, fallback, min, max) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) && number >= min && number <= max ? number : fallback;
}

function setCommonHeaders(res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
}

function applyCors(req, res) {
  const origin = String(req.headers.origin || "").replace(/\/$/, "");
  if (!origin || origin === "null") return true;
  if (!allowedOrigins.has(origin)) return false;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
  return true;
}

function sendJson(res, status, value) {
  setCommonHeaders(res);
  res.statusCode = status;
  res.end(JSON.stringify(value));
}

function clientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket.remoteAddress || "unknown";
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

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        tooLarge = true;
        chunks.length = 0;
        return;
      }
      if (!tooLarge) chunks.push(chunk);
    });
    req.on("end", () => {
      if (tooLarge) {
        const error = new Error("BODY_TOO_LARGE");
        error.statusCode = 413;
        reject(error);
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch (_error) {
        const error = new Error("INVALID_JSON");
        error.statusCode = 400;
        reject(error);
      }
    });
    req.on("error", reject);
  });
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

function matchesImageSignature(bytes, mimeType) {
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimeType === "image/webp") {
    return bytes.length >= 12
      && bytes.subarray(0, 4).toString("ascii") === "RIFF"
      && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  }
  return false;
}

function cleanImage(value) {
  if (value == null) return null;
  if (!value || typeof value !== "object") {
    const error = new Error("INVALID_IMAGE");
    error.statusCode = 400;
    throw error;
  }
  const mimeType = String(value.mimeType || "").trim().toLowerCase();
  const data = typeof value.data === "string" ? value.data.trim() : "";
  if (!IMAGE_TYPES.has(mimeType)
      || !data
      || data.length > IMAGE_BASE64_LIMIT
      || data.length % 4 !== 0
      || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
    const error = new Error("INVALID_IMAGE");
    error.statusCode = 400;
    throw error;
  }
  const bytes = Buffer.from(data, "base64");
  if (!bytes.length || bytes.length > IMAGE_BYTE_LIMIT) {
    const error = new Error("IMAGE_TOO_LARGE");
    error.statusCode = 413;
    throw error;
  }
  const normalized = bytes.toString("base64").replace(/=+$/, "");
  if (normalized !== data.replace(/=+$/, "")) {
    const error = new Error("INVALID_IMAGE");
    error.statusCode = 400;
    throw error;
  }
  if (!matchesImageSignature(bytes, mimeType)) {
    const error = new Error("INVALID_IMAGE");
    error.statusCode = 400;
    throw error;
  }
  return { mimeType, data };
}

function cleanAssistantText(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "• ")
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

function geminiContents(history, message, image, contextText = "") {
  const latestParts = [{ text: `${message}${contextText}` }];
  if (image) {
    latestParts.push({
      inlineData: {
        mimeType: image.mimeType,
        data: image.data
      }
    });
  }
  return [
    ...history.map((item) => ({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: item.content }]
    })),
    { role: "user", parts: latestParts }
  ];
}

async function createAgentReply(message, history, image, context, trace) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const agentTools = await agentToolsPromise;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": API_KEY
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: AGENT_PROMPT }] },
        contents: agentTools.appendToolTrace(
          geminiContents(history, message, image, agentTools.agentContextPart(context)),
          trace
        ),
        ...agentTools.agentToolConfig(),
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
    if (!response.ok) {
      const upstreamCode = payload?.error?.status || payload?.error?.code || "unknown";
      console.error("Gemini request failed", {
        status: response.status,
        requestId,
        code: upstreamCode
      });
      const error = new Error("UPSTREAM_ERROR");
      error.statusCode = response.status === 429 || upstreamCode === "RESOURCE_EXHAUSTED"
        ? 429
        : response.status === 400 || response.status === 401 || response.status === 403
          ? 503
          : 502;
      throw error;
    }
    const toolCalls = agentTools.extractToolCalls(payload);
    if (toolCalls.length) return { toolCalls, requestId };
    const reply = outputText(payload);
    if (!reply) {
      const error = new Error("EMPTY_RESPONSE");
      error.statusCode = 502;
      throw error;
    }
    return { reply, requestId };
  } finally {
    clearTimeout(timer);
  }
}

async function handle(req, res) {
  if (!applyCors(req, res)) {
    sendJson(res, 403, { error: "ORIGIN_NOT_ALLOWED", message: "此网页来源未获准访问小何。" });
    return;
  }

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, {
      ok: true,
      service: "xiaohe-agent",
      provider: "gemini",
      model: MODEL,
      configured: Boolean(API_KEY),
      capabilities: { text: true, vision: true, tools: true, planning: true, approvals: true }
    });
    return;
  }

  if (req.method !== "POST" || url.pathname !== "/api/chat") {
    sendJson(res, 404, { error: "NOT_FOUND" });
    return;
  }

  if (!API_KEY) {
    sendJson(res, 503, { error: "AGENT_NOT_CONFIGURED", message: "小何的后端还没有配置密钥。" });
    return;
  }

  const ip = clientIp(req);
  if (!rateAllowed(ip)) {
    sendJson(res, 429, { error: "RATE_LIMITED", message: "小何需要休息一下，请稍后再试。" });
    return;
  }

  try {
    const body = await readJson(req);
    const image = cleanImage(body.image);
    const message = cleanMessage(body.message) || (image ? "请仔细识别这张图片，并结合英语学习给出准确、简洁的说明。" : "");
    const history = cleanHistory(body.history);
    const agentTools = await agentToolsPromise;
    const context = agentTools.cleanAgentContext(body.context);
    const trace = agentTools.cleanToolTrace(body.trace);
    if (!message) {
      sendJson(res, 400, { error: "EMPTY_MESSAGE", message: "请输入想对小何说的话。" });
      return;
    }
    const result = await createAgentReply(message, history, image, context, trace);
    sendJson(res, 200, {
      reply: result.reply || "",
      toolCalls: result.toolCalls || [],
      provider: "gemini",
      model: MODEL,
      requestId: result.requestId
    });
  } catch (error) {
    if (res.destroyed) return;
    if (error?.name === "AbortError") {
      sendJson(res, 504, { error: "TIMEOUT", message: "小何这次思考太久了，请重试。" });
      return;
    }
    const status = error?.statusCode || 500;
    const messages = {
      400: "图片或消息格式不正确，请重新选择图片后再试。",
      413: "图片或消息过大，请换一张更小的图片。",
      429: "Gemini 免费额度或当前速率已用完，请稍后再试；每日额度会自动重置。",
      503: "小何的 Gemini API 密钥尚未配置或不可用。",
      502: "小何暂时无法连接智能服务，请稍后重试。"
    };
    sendJson(res, status, { error: error?.message || "SERVER_ERROR", message: messages[status] || "服务器暂时出现问题。" });
  }
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((error) => {
    console.error("Unhandled request error", { name: error?.name || "Error" });
    if (!res.headersSent) sendJson(res, 500, { error: "SERVER_ERROR", message: "服务器暂时出现问题。" });
    else res.end();
  });
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`小何后端已启动：http://127.0.0.1:${PORT}`);
    console.log(`模型：${MODEL} · 密钥：${API_KEY ? "已安全加载" : "未配置"}`);
  });
}

module.exports = { cleanImage, geminiContents, matchesImageSignature };
