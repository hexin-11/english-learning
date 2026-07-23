import assert from "node:assert/strict";
import worker, { cleanImage, geminiContents } from "../worker/src/index.mjs";

const env = {
  GEMINI_API_KEY: "test-secret",
  GEMINI_MODEL: "gemini-test",
  ALLOWED_ORIGINS: "https://hexin-11.github.io,http://127.0.0.1:4173"
};
const allowedHeaders = { Origin: "https://hexin-11.github.io" };

const healthResponse = await worker.fetch(new Request("https://worker.test/health", { headers: allowedHeaders }), env);
assert.equal(healthResponse.status, 200);
assert.equal(healthResponse.headers.get("Access-Control-Allow-Origin"), "https://hexin-11.github.io");
const health = await healthResponse.json();
assert.equal(health.ok, true);
assert.equal(health.runtime, "cloudflare-worker");
assert.equal(health.configured, true);
assert.equal(health.capabilities.vision, true);
assert.equal(health.capabilities.tools, true);
assert.equal(health.capabilities.approvals, true);

const blockedResponse = await worker.fetch(new Request("https://worker.test/health", {
  headers: { Origin: "https://malicious.example" }
}), env);
assert.equal(blockedResponse.status, 403);

const optionsResponse = await worker.fetch(new Request("https://worker.test/api/chat", {
  method: "OPTIONS",
  headers: allowedHeaders
}), env);
assert.equal(optionsResponse.status, 204);

const jpegData = Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64");
assert.deepEqual(cleanImage({ mimeType: "image/jpeg", data: jpegData }), {
  mimeType: "image/jpeg",
  data: jpegData
});
assert.throws(() => cleanImage({ mimeType: "image/jpeg", data: Buffer.from("not an image").toString("base64") }), /INVALID_IMAGE/);

const contents = geminiContents(
  [{ role: "assistant", content: "Please upload an image." }],
  "Read the English text.",
  { mimeType: "image/jpeg", data: jpegData }
);
assert.equal(contents.at(-1).parts[1].inlineData.data, jpegData);

const originalFetch = globalThis.fetch;
let upstreamRequest;
globalThis.fetch = async (url, options) => {
  upstreamRequest = { url: String(url), options };
  return new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: "### **Hello!**" }] } }]
  }), {
    status: 200,
    headers: { "x-goog-request-id": "test-request" }
  });
};

try {
  const chatResponse = await worker.fetch(new Request("https://worker.test/api/chat", {
    method: "POST",
    headers: { ...allowedHeaders, "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.7" },
    body: JSON.stringify({ message: "Hi", history: [], image: null })
  }), env);
  assert.equal(chatResponse.status, 200);
  const chat = await chatResponse.json();
  assert.equal(chat.reply, "Hello!");
  assert.match(upstreamRequest.url, /gemini-test:generateContent$/);
  assert.equal(upstreamRequest.options.headers["x-goog-api-key"], "test-secret");
  const upstreamBody = JSON.parse(upstreamRequest.options.body);
  assert.equal(upstreamBody.contents.at(-1).parts[0].text, "Hi");
  assert.ok(upstreamBody.tools[0].functionDeclarations.length >= 8);
  assert.ok(upstreamBody.tools[0].functionDeclarations.some((tool) => tool.name === "create_presentation"));
  assert.equal(upstreamBody.toolConfig.functionCallingConfig.mode, "AUTO");

  globalThis.fetch = async () => new Response(JSON.stringify({
    candidates: [{ content: { parts: [{
      functionCall: { id: "call-1", name: "get_lesson_detail", args: { lesson: "第三课" } }
    }] } }]
  }), { status: 200, headers: { "x-goog-request-id": "tool-request" } });
  const toolResponse = await worker.fetch(new Request("https://worker.test/api/chat", {
    method: "POST",
    headers: { ...allowedHeaders, "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.8" },
    body: JSON.stringify({
      message: "总结第三课",
      history: [],
      context: { lessonIndex: [{ id: "lesson-3", title: "第三课" }] }
    })
  }), env);
  const toolPayload = await toolResponse.json();
  assert.equal(toolPayload.reply, "");
  assert.equal(toolPayload.toolCalls[0].name, "get_lesson_detail");
  assert.equal(toolPayload.toolCalls[0].args.lesson, "第三课");

  let continuationBody;
  globalThis.fetch = async (_url, options) => {
    continuationBody = JSON.parse(options.body);
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: "第三课共有 12 个单词。" }] } }]
    }), { status: 200 });
  };
  const continuationResponse = await worker.fetch(new Request("https://worker.test/api/chat", {
    method: "POST",
    headers: { ...allowedHeaders, "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.9" },
    body: JSON.stringify({
      message: "总结第三课",
      history: [],
      trace: [{
        calls: toolPayload.toolCalls,
        results: [{ id: "call-1", name: "get_lesson_detail", result: { ok: true, lesson: { wordCount: 12 } } }]
      }]
    })
  }), env);
  const continuation = await continuationResponse.json();
  assert.equal(continuation.reply, "第三课共有 12 个单词。");
  assert.equal(continuationBody.contents.at(-1).parts[0].functionResponse.name, "get_lesson_detail");
} finally {
  globalThis.fetch = originalFetch;
}

console.log("Cloudflare Worker tests passed.");
