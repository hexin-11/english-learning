const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "css", "style.css"), "utf8");
const i18n = fs.readFileSync(path.join(root, "js", "i18n.js"), "utf8");

assert.match(app, /function speakerButtonMarkup\(/);
assert.match(app, /class="speech-icon-button \$\{extraClass \|\| ""\}"/);
assert.match(app, /speakerButtonMarkup\(word\.english, word\.lessonId, "word-speaker"\)/);
assert.match(app, /speakerButtonMarkup\(sentence\.english, lesson\.id, "sentence-speaker"\)/);
assert.doesNotMatch(app, /<button class="word-card-main"/);
assert.doesNotMatch(app, /<button class="sentence-speak"/);
assert.match(css, /@keyframes speaker-wave-pulse/);
assert.match(css, /\.speech-icon-button\.is-playing/);
assert.match(i18n, /"lessons\.clickRead": "点击单词前的小喇叭播放发音"/);

console.log("Course speaker-button tests passed.");
