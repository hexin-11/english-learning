const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "js", "lesson-editor.js"), "utf8");
const values = new Map();
const events = [];
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

const sandbox = {
  window: {
    localStorage,
    dispatchEvent(event) { events.push(event); }
  },
  CustomEvent
};
vm.runInNewContext(source, sandbox, { filename: "lesson-editor.js" });

const editor = sandbox.window.LessonEditor;
const lesson = (id, number) => ({
  id,
  number,
  title: `Lesson ${number}`,
  words: [],
  sentences: [],
  studyNotes: []
});
const original = [lesson("a", 1), lesson("b", 2), lesson("c", 3)];

assert.deepEqual(Array.from(editor.apply(original), (item) => item.id), ["a", "b", "c"]);

editor.reorder(["c", "a", "b", "c", ""]);
assert.deepEqual(Array.from(editor.apply(original), (item) => item.id), ["c", "a", "b"]);
assert.deepEqual(JSON.parse(values.get("hexin-lesson-edits:v1")).order, ["c", "a", "b"]);

editor.prepend("d");
const withNewLesson = [...original, lesson("d", 4)];
assert.deepEqual(Array.from(editor.apply(withNewLesson), (item) => item.id), ["d", "c", "a", "b"]);

editor.deleteLesson("c", lesson("c", 3));
assert.deepEqual(Array.from(editor.apply(withNewLesson), (item) => item.id), ["d", "a", "b"]);
assert.deepEqual(JSON.parse(values.get("hexin-lesson-edits:v1")).order, ["d", "a", "b"]);
assert.ok(events.some((event) => event.type === "hexin:data-changed"));

console.log("Lesson ordering tests passed.");
