const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const storageSource = fs.readFileSync(path.join(root, "js", "storage.js"), "utf8");
const appSource = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
const styleSource = fs.readFileSync(path.join(root, "css", "style.css"), "utf8");
const values = new Map();
const window = {
  localStorage: {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value))
  },
  dispatchEvent() {}
};

class CustomEvent {
  constructor(type, options) {
    this.type = type;
    this.detail = options?.detail;
  }
}

vm.runInNewContext(storageSource, { window, CustomEvent, console, encodeURIComponent }, { filename: "storage.js" });

const added = window.LearningStorage.toggleDictionaryFavorite({
  english: "Intimidate",
  ipa: "/ɪnˈtɪmɪdeɪt/",
  chinese: "v. 恐吓；使害怕"
});
assert.equal(added.dictionaryFavorites.length, 1);
assert.equal(added.dictionaryFavorites[0].id, "dictionary:intimidate");
assert.equal(added.dictionaryFavorites[0].chinese, "v. 恐吓；使害怕");
assert.match(values.get("hexin-english-learning:v1"), /dictionaryFavorites/);

const removed = window.LearningStorage.toggleDictionaryFavorite({ english: "intimidate" });
assert.equal(removed.dictionaryFavorites.length, 0, "Clicking the same dictionary word again should remove it");

assert.match(appSource, /data-online-dictionary-favorite/);
assert.match(appSource, /dictionaryFavoriteWords\(\)/);
assert.match(appSource, /toggleDictionaryFavorite/);
assert.match(styleSource, /\.dictionary-favorite-action\[aria-pressed="true"\]/);
assert.match(styleSource, /--favorite:\s*#[0-9a-f]{6}/i, "Favorite stars should use a dedicated yellow color token");
assert.match(styleSource, /\.favorite-star\[aria-pressed="true"\][\s\S]*?color:\s*var\(--favorite\)/, "Saved course-word stars should be yellow");
assert.match(styleSource, /\.dictionary-favorite-action\[aria-pressed="true"\]\s+svg\s*\{[\s\S]*?fill:\s*var\(--favorite\)/, "Saved online-dictionary stars should be yellow");

console.log("Online dictionary favorite tests passed.");
