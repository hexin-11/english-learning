(function () {
  "use strict";

  const STORAGE_KEY = "hexin-xiaohe-memory:v1";
  const LIMITS = { preferences: 12, goals: 8, facts: 12, recentTasks: 10 };

  function clean(value, limit = 240) {
    return String(value || "").trim().replace(/\s+/g, " ").slice(0, limit);
  }

  function normalizeList(value, limit) {
    const seen = new Set();
    return (Array.isArray(value) ? value : []).flatMap((entry) => {
      const text = clean(entry?.text || entry);
      const key = text.toLocaleLowerCase();
      if (!text || seen.has(key)) return [];
      seen.add(key);
      return [{ text, updatedAt: Number(entry?.updatedAt) || Date.now() }];
    }).sort((left, right) => right.updatedAt - left.updatedAt).slice(0, limit);
  }

  function normalize(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      preferences: normalizeList(source.preferences, LIMITS.preferences),
      goals: normalizeList(source.goals, LIMITS.goals),
      facts: normalizeList(source.facts, LIMITS.facts),
      recentTasks: normalizeList(source.recentTasks, LIMITS.recentTasks)
    };
  }

  function read() {
    try { return normalize(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}")); }
    catch (_error) { return normalize({}); }
  }

  function write(value) {
    const next = normalize(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent("hexin:data-changed", { detail: { key: STORAGE_KEY } }));
    } catch (_error) {
      // 存储不可用时不阻断对话。
    }
    return next;
  }

  function remember(kind, value) {
    if (!Object.hasOwn(LIMITS, kind) || kind === "recentTasks") return read();
    const text = clean(value);
    if (!text) return read();
    const memory = read();
    memory[kind] = [{ text, updatedAt: Date.now() }, ...memory[kind].filter((item) => item.text.toLocaleLowerCase() !== text.toLocaleLowerCase())];
    return write(memory);
  }

  function forget(value) {
    const query = clean(value).toLocaleLowerCase();
    const memory = read();
    if (!query || /全部|所有|everything|all/.test(query)) return write({});
    for (const kind of ["preferences", "goals", "facts"]) {
      memory[kind] = memory[kind].filter((item) => !item.text.toLocaleLowerCase().includes(query));
    }
    return write(memory);
  }

  function observeUserMessage(value) {
    const message = clean(value, 600);
    if (!message) return { changed: false };
    const forgetMatch = message.match(/(?:忘记|不要再记得|删除记忆)[:：]?\s*(.+)/);
    if (forgetMatch) {
      forget(forgetMatch[1]);
      return { changed: true, action: "forgot", text: clean(forgetMatch[1]) };
    }
    const explicit = message.match(/(?:请记住|记住)[:：]?\s*(.+)/);
    if (explicit) {
      remember("facts", explicit[1]);
      return { changed: true, action: "remembered", kind: "facts", text: clean(explicit[1]) };
    }
    const goal = message.match(/(?:我的英语学习目标是|我的学习目标是|我想重点练习)[:：]?\s*(.+)/);
    if (goal) {
      remember("goals", goal[1]);
      return { changed: true, action: "remembered", kind: "goals", text: clean(goal[1]) };
    }
    const preference = message.match(/(?:我更喜欢|我偏好|以后请一直)[:：]?\s*(.+(?:发音|语速|英语|中文|例句|讲解).*)/);
    if (preference) {
      remember("preferences", preference[1]);
      return { changed: true, action: "remembered", kind: "preferences", text: clean(preference[1]) };
    }
    return { changed: false };
  }

  function recordTask(request, outcome, succeeded) {
    const memory = read();
    const text = clean(`${succeeded ? "已完成" : "未完成"}：${clean(request, 100)} → ${clean(outcome, 140)}`, 260);
    memory.recentTasks = [{ text, updatedAt: Date.now() }, ...memory.recentTasks];
    write(memory);
  }

  function context() {
    const memory = read();
    return Object.fromEntries(Object.entries(memory).map(([key, entries]) => [key, entries.map((entry) => entry.text)]));
  }

  window.XiaoHeMemory = Object.freeze({ context, observeUserMessage, recordTask, remember, forget });
})();
