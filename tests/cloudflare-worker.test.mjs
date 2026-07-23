import assert from "node:assert/strict";
import worker, {
  agentGenerationConfig,
  classifyAgentTask,
  cleanImage,
  geminiContents,
  normalizeLessonVision
} from "../worker/src/index.mjs";

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
assert.equal(health.capabilities.lessonVision, true);
assert.equal(health.capabilities.lessonStructure, true);
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
assert.equal(classifyAgentTask("Hi", null, []).mode, "fast");
assert.equal(classifyAgentTask("请根据我的错题和待复习单词制定计划并生成练习", null, []).mode, "deep");
assert.equal(agentGenerationConfig("请分析全部错题并制定复习计划", null, [], "gemini-3-flash").config.thinkingConfig.thinkingLevel, "HIGH");
assert.equal(agentGenerationConfig("请分析全部错题并制定复习计划", null, [], "gemini-2.5-flash").config.thinkingConfig.thinkingBudget, 2048);

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
  assert.ok(upstreamBody.tools[0].functionDeclarations.some((tool) => tool.name === "lookup_dictionary_word"));
  assert.ok(upstreamBody.tools[0].functionDeclarations.some((tool) => tool.name === "get_review_material"));
  assert.equal(upstreamBody.generationConfig.thinkingConfig, undefined);
  const wordStateTool = upstreamBody.tools[0].functionDeclarations.find((tool) => tool.name === "update_word_state");
  assert.match(wordStateTool.description, /任意英文单词/);
  assert.match(upstreamBody.systemInstruction.parts[0].text, /verification\.verified/);
  assert.equal(upstreamBody.toolConfig.functionCallingConfig.mode, "AUTO");

  const thinkingBodies = [];
  globalThis.fetch = async (_url, options) => {
    thinkingBodies.push(JSON.parse(options.body));
    if (thinkingBodies.length === 1) {
      return new Response(JSON.stringify({ error: { status: "INVALID_ARGUMENT" } }), { status: 400 });
    }
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: "复习计划已准备好。" }] } }]
    }), { status: 200 });
  };
  const deepResponse = await worker.fetch(new Request("https://worker.test/api/chat", {
    method: "POST",
    headers: { ...allowedHeaders, "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.70" },
    body: JSON.stringify({ message: "请根据我的全部错题分析薄弱点并制定复习计划", history: [] })
  }), env);
  assert.equal(deepResponse.status, 200);
  assert.equal((await deepResponse.json()).reasoningMode, "deep");
  assert.equal(thinkingBodies[0].generationConfig.thinkingConfig.thinkingLevel, "HIGH");
  assert.equal(thinkingBodies[1].generationConfig.thinkingConfig, undefined);

  globalThis.fetch = async (_url, options) => {
    upstreamRequest = { url: String(_url), options };
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({
        title: "第六课",
        words: [
          { english: "theory", ipa: "/ˈθɪəri/", chinese: "理论，原理" },
          { english: "procedure", ipa: "/prəˈsiːdʒə/", chinese: "过程，程序" }
        ],
        sentences: [{
          english: "Yes, I really enjoy running.",
          chinese: "是的，我真的很喜欢跑步。"
        }],
        rawText: "第六课单词\ntheory 理论，原理\nprocedure 过程，程序"
      }) }] } }]
    }), { status: 200, headers: { "x-goog-request-id": "vision-request" } });
  };
  const visionResponse = await worker.fetch(new Request("https://worker.test/api/lesson-vision", {
    method: "POST",
    headers: { ...allowedHeaders, "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.10" },
    body: JSON.stringify({ image: { mimeType: "image/jpeg", data: jpegData } })
  }), env);
  assert.equal(visionResponse.status, 200);
  const vision = await visionResponse.json();
  assert.equal(vision.lesson.title, "第六课");
  assert.deepEqual(vision.lesson.words.map((word) => word.english), ["theory", "procedure"]);
  assert.equal(vision.lesson.sentences[0].english, "Yes, I really enjoy running.");
  const visionBody = JSON.parse(upstreamRequest.options.body);
  assert.equal(visionBody.generationConfig.responseMimeType, "application/json");
  assert.equal(visionBody.generationConfig.temperature, 0.1);
  assert.equal(visionBody.generationConfig.mediaResolution, "MEDIA_RESOLUTION_HIGH");
  assert.match(visionBody.systemInstruction.parts[0].text, /表格的一行可能同时有两组/);

  globalThis.fetch = async (_url, options) => {
    upstreamRequest = { url: String(_url), options };
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({
        title: "第六课",
        words: [{ english: "available", ipa: "/əˈveɪləbl/", chinese: "可获得的；有空的" }],
        sentences: [{ english: "Do you like running?", chinese: "你喜欢跑步吗？" }],
        rawText: "available\nDo you like running?"
      }) }] } }]
    }), { status: 200, headers: { "x-goog-request-id": "structure-request" } });
  };
  const structureResponse = await worker.fetch(new Request("https://worker.test/api/lesson-structure", {
    method: "POST",
    headers: { ...allowedHeaders, "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.11" },
    body: JSON.stringify({
      rawText: "available\nDo you like running?",
      lesson: {
        words: [{ english: "available", ipa: "/音标待补充/", chinese: "中文释义待补充" }],
        sentences: [{ english: "Do you like running?", chinese: "中文翻译待补充" }]
      }
    })
  }), env);
  assert.equal(structureResponse.status, 200);
  const structured = await structureResponse.json();
  assert.equal(structured.lesson.words[0].ipa, "/əˈveɪləbl/");
  assert.equal(structured.lesson.words[0].chinese, "可获得的；有空的");
  assert.equal(structured.lesson.sentences[0].chinese, "你喜欢跑步吗？");
  const structureBody = JSON.parse(upstreamRequest.options.body);
  assert.match(structureBody.systemInstruction.parts[0].text, /自动区分单词\/短语与完整句子/);
  assert.match(structureBody.systemInstruction.parts[0].text, /每个 word 都必须补全标准英语 IPA 音标/);
  assert.doesNotMatch(structureBody.contents[0].parts[0].text, /执行里面/);

  const filteredVision = normalizeLessonVision({
    words: [{ english: "theory", ipa: "", chinese: "理论" }],
    sentences: [
      { english: "IT CE re I", chinese: "错误碎片" },
      { english: "Where do you usually run?", chinese: "你通常在哪里跑步？" }
    ]
  });
  assert.deepEqual(filteredVision.sentences.map((sentence) => sentence.english), ["Where do you usually run?"]);

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
      finalOnly: true,
      trace: [{
        calls: toolPayload.toolCalls,
        results: [{ id: "call-1", name: "get_lesson_detail", result: { ok: true, lesson: { wordCount: 12 } } }]
      }]
    })
  }), env);
  const continuation = await continuationResponse.json();
  assert.equal(continuation.reply, "第三课共有 12 个单词。");
  assert.equal(continuationBody.contents.at(-1).parts[0].functionResponse.name, "get_lesson_detail");
  assert.equal(continuationBody.tools, undefined);
  assert.equal(continuationBody.toolConfig, undefined);
} finally {
  globalThis.fetch = originalFetch;
}

console.log("Cloudflare Worker tests passed.");
