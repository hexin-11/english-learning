const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const importerSource = fs.readFileSync(path.join(root, "js", "importer.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");

const sandbox = {
  console,
  URL,
  window: {
    APP_CONFIG: { agentApiBase: "https://worker.example" },
    WORD_PRONUNCIATIONS: {
      theory: { ipa: "/ˈθɪəri/" },
      procedure: { ipa: "/prəˈsiːdʒə/" }
    },
    localStorage: { getItem: () => null, setItem() {} },
    dispatchEvent() {},
    setTimeout,
    clearTimeout
  },
  document: { querySelector: () => null },
  CustomEvent: class CustomEvent {},
  Image: class Image {},
  FileReader: class FileReader {}
};
sandbox.window.window = sandbox.window;
vm.runInNewContext(importerSource, sandbox, { filename: "importer.js" });

const normalized = sandbox.window.LessonImporter.normalizeVisionLesson({
  title: "第六课",
  words: [
    { english: "theory", ipa: "/ˈθɪəri/", chinese: "理论，原理" },
    { english: "procedure", ipa: "/prəˈsiːdʒə/", chinese: "过程，程序" }
  ],
  sentences: [
    { english: "IT CE re I", chinese: "错误碎片" },
    { english: "Do you like running?", chinese: "你喜欢跑步吗？" }
  ]
});
assert.deepEqual(Array.from(normalized.words, (word) => word.english), ["theory", "procedure"]);
assert.deepEqual(Array.from(normalized.sentences, (sentence) => sentence.english), ["Do you like running?"]);

const parsed = sandbox.window.LessonImporter.structureText(`
第六课单词
theory 理论，原理 procedure 过程，程序
reference 参考，引证 measure 测量
IT CE | re I
Do you like running?
你喜欢跑步吗？
Yes, I really enjoy running.
是的，我真的很喜欢跑步。
`);
assert.deepEqual(Array.from(parsed.words, (word) => word.english), ["theory", "procedure", "reference", "measure"]);
assert.ok(parsed.sentences.some((sentence) => sentence.english === "Do you like running?"));
assert.ok(parsed.sentences.every((sentence) => sentence.english !== "IT CE | re I"));

assert.match(importerSource, /\/api\/lesson-vision/);
assert.match(importerSource, /\/api\/lesson-structure/);
assert.match(importerSource, /正在分类并补全课程/);
assert.match(importerSource, /补齐缺失的音标、单词释义和整句翻译/);
assert.match(importerSource, /tessedit_pageseg_mode:\s*"6"/);
assert.match(importerSource, /prepareOcrCanvas/);
assert.match(indexSource, /导入内容会发送给小何智能识别服务/);

console.log("Lesson vision import tests passed.");
