const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const spellingSource = fs.readFileSync(path.join(root, "js", "spelling.js"), "utf8");
const storageSource = fs.readFileSync(path.join(root, "js", "storage.js"), "utf8");
const appSource = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const styleSource = fs.readFileSync(path.join(root, "css", "style.css"), "utf8");

const localValues = new Map();
const windowObject = {
  localStorage: {
    getItem: (key) => localValues.get(key) ?? null,
    setItem: (key, value) => localValues.set(key, String(value)),
    removeItem: (key) => localValues.delete(key)
  },
  dispatchEvent() {}
};
const sandbox = {
  window: windowObject,
  document: { readyState: "loading", addEventListener() {} },
  CustomEvent: class CustomEvent {},
  console
};

vm.runInNewContext(spellingSource, sandbox, { filename: "spelling.js" });
const core = windowObject.SpellingPracticeCore;
const base = [{ id: "word:a", english: "available" }, { id: "word:b", english: "coding" }];
const reviewQueue = core.buildReviewQueue(base, new Set(["word:a"]));
assert.equal(reviewQueue.length, 3, "Saved mistakes should be appended to the practice queue");
assert.equal(reviewQueue.filter((item) => item.id === "word:a").length, 2);
assert.equal(reviewQueue.at(-1).mistakeReview, true);

const newlyWrong = core.withQueuedMistakeReview(base, 0, base[0]);
assert.equal(newlyWrong.length, 3, "A newly wrong answer should return later in the same session");
assert.equal(newlyWrong.at(-1).id, "word:a");
assert.equal(newlyWrong.at(-1).mistakeReview, true);

const alreadyQueued = core.withQueuedMistakeReview(reviewQueue, 0, base[0]);
assert.equal(alreadyQueued.length, reviewQueue.length, "The same mistake must not be queued twice");

vm.runInNewContext(storageSource, sandbox, { filename: "storage.js" });
assert.equal(windowObject.LearningStorage.getState().settings.hideEnglish, false);
windowObject.LearningStorage.updateSettings({ hideEnglish: true });
assert.equal(windowObject.LearningStorage.getState().settings.hideEnglish, true);

assert.match(indexSource, /id="hide-english"/);
assert.match(indexSource, /id="spelling-mistake-count"/);
assert.match(appSource, /hide-english-content/);
assert.match(spellingSource, /showFeedback\("wrong", t\("wrongFeedback"\), question\.english\)/);
assert.match(spellingSource, /addMistake\(question\);\s*queueMistakeReview\(question\);/);
assert.match(styleSource, /\.hide-english-content \.sentence-english/);

console.log("Spelling mistake review and hidden-English tests passed.");
