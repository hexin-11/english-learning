const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const imageSource = fs.readFileSync(path.join(root, "js", "images.js"), "utf8");
const appSource = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
const cssSource = fs.readFileSync(path.join(root, "css", "style.css"), "utf8");
const values = new Map();
const requests = [];

const goodScene = {
  title: "Empty chair in a waiting room",
  thumbnail: "https://images.example/empty-chair.jpg",
  foreign_landing_url: "https://example.com/empty-chair",
  creator: "Example creator",
  license: "cc0",
  source: "wikimedia",
  mature: false,
  width: 1200,
  height: 800,
  tags: ["empty", "chair", "seat", "waiting", "room"]
};
const misleadingLogo = {
  title: "Available logo typography",
  thumbnail: "https://images.example/available-logo.jpg",
  foreign_landing_url: "https://example.com/available-logo",
  mature: false,
  width: 1200,
  height: 800,
  tags: ["available", "logo", "wordmark"]
};

async function fetchMock(url) {
  requests.push(url);
  const query = new URL(url).searchParams.get("q");
  assert.ok(["empty chair", "available seat", "waiting room chairs"].includes(query));
  return {
    ok: true,
    json: async () => ({ results: [misleadingLogo, goodScene, { ...goodScene }] })
  };
}

const localStorage = {
  getItem(key) { return values.has(key) ? values.get(key) : null; },
  setItem(key, value) { values.set(key, String(value)); },
  removeItem(key) { values.delete(key); }
};
class CustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
}
class ImageMock {
  set src(value) { this._src = value; }
}
const sandbox = {
  window: {
    localStorage,
    fetch: fetchMock,
    setTimeout,
    clearTimeout,
    dispatchEvent() {}
  },
  URL,
  AbortController,
  CustomEvent,
  Image: ImageMock,
  console
};
vm.runInNewContext(imageSource, sandbox, { filename: "images.js" });

(async () => {
  const image = await sandbox.window.WordImages.find({ english: "available", chinese: "可用的；有空的" });
  assert.equal(image.title, goodScene.title);
  assert.equal(image.matchType, "scene");
  assert.equal(image.candidateCount, 1, "Logos and duplicate photos should be removed");
  assert.match(values.get("hexin-word-images:v5"), /empty-chair/);

  const requestCount = requests.length;
  const cached = await sandbox.window.WordImages.find({ english: "available", chinese: "可用的" });
  assert.equal(cached.title, goodScene.title);
  assert.equal(requests.length, requestCount, "Cached image candidates should not refetch");

  const nonVisual = await sandbox.window.WordImages.find({ english: "hardly", chinese: "几乎不" });
  assert.equal(nonVisual, null);
  assert.equal(requests.length, requestCount, "Non-visual grammar words should use the concept card without searching");

  assert.match(appSource, /concept:\s*word/);
  assert.match(appSource, /result\.matchType === "scene"/);
  assert.match(cssSource, /\.card-image-placeholder\.is-concept/);
  console.log("Semantic image matching tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
