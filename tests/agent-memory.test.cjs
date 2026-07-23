const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "js", "agent-memory.js"), "utf8");
const values = new Map();
const events = [];
const window = {
  localStorage: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  },
  dispatchEvent: (event) => events.push(event)
};
class CustomEvent {
  constructor(type, options) { this.type = type; this.detail = options?.detail; }
}

vm.runInNewContext(source, { window, CustomEvent, Date, Object, JSON, String }, { filename: "agent-memory.js" });

let observed = window.XiaoHeMemory.observeUserMessage("请记住：我下个月要参加英语面试");
assert.equal(observed.changed, true);
assert.deepEqual(Array.from(window.XiaoHeMemory.context().facts), ["我下个月要参加英语面试"]);

observed = window.XiaoHeMemory.observeUserMessage("我的英语学习目标是每天练习十分钟口语");
assert.equal(observed.kind, "goals");
assert.deepEqual(Array.from(window.XiaoHeMemory.context().goals), ["每天练习十分钟口语"]);

observed = window.XiaoHeMemory.observeUserMessage("我更喜欢美式发音和简短中文讲解");
assert.equal(observed.kind, "preferences");
assert.match(window.XiaoHeMemory.context().preferences[0], /美式发音/);

window.XiaoHeMemory.recordTask("收藏 intimidate", "已收藏", true);
assert.match(window.XiaoHeMemory.context().recentTasks[0], /已完成/);

window.XiaoHeMemory.observeUserMessage("忘记英语面试");
assert.equal(window.XiaoHeMemory.context().facts.length, 0);
assert.ok(events.some((event) => event.type === "hexin:data-changed" && event.detail.key === "hexin-xiaohe-memory:v1"));

console.log("Agent long-term memory tests passed.");
