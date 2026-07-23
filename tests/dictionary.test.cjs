const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "js", "dictionary.js"), "utf8");
const appSource = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
const styleSource = fs.readFileSync(path.join(root, "css", "style.css"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const values = new Map();
const requests = [];
const translations = new Map([
  ["To write software programs.", "编写软件程序。"],
  ["To encode information using a system of symbols.", "使用符号系统对信息进行编码。"],
  ["To assign a code to something.", "给某事物指定代码。"],
  ["The process of writing software programs.", "编写软件程序的过程。"],
  ["Instructions written for a computer.", "为计算机编写的指令。"]
]);

const dictionaryPayload = [{
  word: "coding",
  phonetic: "/ˈkəʊdɪŋ/",
  meanings: [
    {
      partOfSpeech: "verb",
      definitions: [
        { definition: "To write software programs.", example: "She is coding a website." },
        { definition: "To encode information using a system of symbols." }
      ]
    },
    {
      partOfSpeech: "verb",
      definitions: [
        { definition: "To write software programs." },
        { definition: "To assign a code to something." }
      ]
    },
    {
      partOfSpeech: "noun",
      definitions: [
        { definition: "The process of writing software programs." },
        { definition: "Instructions written for a computer." }
      ]
    }
  ]
}];

async function fetchMock(url) {
  requests.push(url);
  if (url.includes("dictionaryapi.dev")) {
    return { ok: true, json: async () => dictionaryPayload };
  }
  const query = new URL(url).searchParams.get("q");
  const translatedText = query === "coding"
    ? "编码；编程"
    : query.split(/\s*\|\|\|\s*/).map((item) => translations.get(item) || `中文：${item}`).join(" ||| ");
  return {
    ok: true,
    json: async () => ({ responseData: { translatedText } })
  };
}

const localStorage = {
  getItem(key) { return values.has(key) ? values.get(key) : null; },
  setItem(key, value) { values.set(key, String(value)); },
  removeItem(key) { values.delete(key); }
};
const sandbox = {
  window: { localStorage },
  fetch: fetchMock,
  DOMException,
  URL,
  AbortController,
  console
};
vm.runInNewContext(source, sandbox, { filename: "dictionary.js" });

(async () => {
  const result = await sandbox.window.OnlineDictionary.lookup("coding");
  assert.equal(result.translation, "编码；编程");
  assert.deepEqual(Array.from(result.meanings, (item) => item.partOfSpeech), ["verb", "noun"]);
  assert.equal(result.meanings[0].definitions.length, 3, "Duplicate verb groups should be merged and deduplicated");
  assert.equal(result.meanings[1].definitions.length, 2);
  assert.ok(result.meanings.every((meaning) => meaning.definitions.every((definition) => definition.chinese)));
  assert.equal(result.meanings[0].definitions[0].chinese, "编写软件程序。");
  assert.match(values.get("hexin-english-dictionary-cache:v2"), /编写软件程序/);

  const requestCount = requests.length;
  const cached = await sandbox.window.OnlineDictionary.lookup("coding");
  assert.equal(cached.fromCache, true);
  assert.equal(requests.length, requestCount, "Cached lookups should not repeat network requests");

  for (const id of ["word-popover-status", "word-popover-senses", "card-meanings", "card-lexical-status"]) {
    assert.match(indexSource, new RegExp(`id=["']${id}["']`), `Missing ${id}`);
  }
  assert.match(appSource, /OnlineDictionary\.lookup\(details\.word/);
  assert.match(appSource, /renderFlashcardDictionary\(word\)/);
  assert.match(appSource, /lexicalMeaningsMarkup\(displayedMeanings, "flashcard"\)/);
  assert.match(appSource, /placement = "right"/);
  assert.match(appSource, /window\.addEventListener\("scroll"/);
  assert.match(styleSource, /width:\s*min\(360px, calc\(100vw - 24px\)\)/);
  assert.match(styleSource, /max-height:\s*min\(480px, calc\(100dvh - 24px\)\)/);
  assert.match(styleSource, /overscroll-behavior:\s*contain/);

  console.log("Dictionary meanings and parts-of-speech tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
