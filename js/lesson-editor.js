(function () {
  "use strict";

  const STORAGE_KEY = "hexin-lesson-edits:v1";
  let memoryState = readState();

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function text(value, maxLength = 600) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
  }

  function multiline(value, maxLength = 3000) {
    return String(value || "").replace(/\r\n?/g, "\n").trim().slice(0, maxLength);
  }

  function stableId(value, fallback) {
    const normalized = String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
    return normalized || fallback;
  }

  function customId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function normalizeWord(word, index) {
    return {
      _id: stableId(word?._id, String(index)),
      english: text(word?.english, 160),
      ipa: text(word?.ipa, 160) || "/音标待补充/",
      chinese: text(word?.chinese, 300)
    };
  }

  function normalizeSentence(sentence, index) {
    return {
      _id: stableId(sentence?._id, `sentence-${index}`),
      english: multiline(sentence?.english, 3000),
      chinese: multiline(sentence?.chinese, 3000),
      ...(text(sentence?.ipa, 500) ? { ipa: text(sentence.ipa, 500) } : {})
    };
  }

  function normalizeNote(note, index) {
    return {
      _id: stableId(note?._id, `note-${index}`),
      title: text(note?.title, 180) || "语法笔记",
      description: multiline(note?.description, 1200),
      structures: (Array.isArray(note?.structures) ? note.structures : [])
        .map((item) => multiline(item, 500))
        .filter(Boolean)
        .slice(0, 30),
      examples: (Array.isArray(note?.examples) ? note.examples : [])
        .map(normalizeSentence)
        .filter((item) => item.english)
        .slice(0, 100)
    };
  }

  function prepareLesson(lesson) {
    const prepared = clone(lesson || {});
    prepared.title = text(prepared.title, 180) || `第${Number(prepared.number) || ""}课`;
    prepared.wordSectionTitle = text(prepared.wordSectionTitle, 180) || "单词与短语";
    prepared.readingTitle = text(prepared.readingTitle, 180) || "课文与例句";
    prepared.words = (Array.isArray(prepared.words) ? prepared.words : [])
      .map(normalizeWord)
      .filter((item) => item.english)
      .slice(0, 500);
    prepared.studyNotes = (Array.isArray(prepared.studyNotes) ? prepared.studyNotes : [])
      .map(normalizeNote)
      .slice(0, 100);
    prepared.sentences = (Array.isArray(prepared.sentences) ? prepared.sentences : [])
      .map(normalizeSentence)
      .filter((item) => item.english)
      .slice(0, 500);
    return prepared;
  }

  function readState() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
      if (!parsed || typeof parsed !== "object") return { overrides: {}, deleted: [] };
      return {
        overrides: parsed.overrides && typeof parsed.overrides === "object" ? parsed.overrides : {},
        deleted: Array.isArray(parsed.deleted) ? parsed.deleted.map(String) : []
      };
    } catch (_error) {
      return { overrides: {}, deleted: [] };
    }
  }

  function writeState() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryState));
    } catch (_error) {
      const error = new Error("浏览器本地空间不足，无法保存课程修改。");
      error.code = "STORAGE_FULL";
      throw error;
    }
  }

  function apply(lessons) {
    const deleted = new Set(memoryState.deleted || []);
    return (Array.isArray(lessons) ? lessons : []).filter((source) => !deleted.has(String(source.id))).map((source) => {
      const base = prepareLesson(source);
      const override = memoryState.overrides[source.id];
      if (!override) return base;
      return prepareLesson({
        ...base,
        ...clone(override),
        id: base.id,
        number: base.number,
        imported: base.imported,
        sourceName: base.sourceName,
        importedAt: base.importedAt
      });
    });
  }

  function save(lesson) {
    const prepared = prepareLesson(lesson);
    memoryState.overrides[prepared.id] = prepared;
    writeState();
    return prepared;
  }

  function rename(lesson, title) {
    const next = prepareLesson(lesson);
    next.title = text(title, 180);
    if (!next.title) throw new Error("课程名称不能为空。");
    return save(next);
  }

  function addWord(lesson, word) {
    const next = prepareLesson(lesson);
    const normalized = normalizeWord({ ...word, _id: customId("word") }, next.words.length);
    if (!normalized.english) throw new Error("请输入英文单词或短语。");
    next.words.push(normalized);
    return save(next);
  }

  function removeWord(lesson, wordId) {
    const next = prepareLesson(lesson);
    next.words = next.words.filter((word) => word._id !== wordId);
    return save(next);
  }

  function addNote(lesson, note) {
    const next = prepareLesson(lesson);
    const normalized = normalizeNote({
      ...note,
      _id: customId("note"),
      structures: multiline(note?.structures, 3000).split("\n").filter(Boolean),
      examples: []
    }, next.studyNotes.length);
    next.studyNotes.push(normalized);
    return save(next);
  }

  function removeNote(lesson, noteId) {
    const next = prepareLesson(lesson);
    next.studyNotes = next.studyNotes.filter((note) => note._id !== noteId);
    return save(next);
  }

  function addExample(lesson, noteId, sentence) {
    const next = prepareLesson(lesson);
    const note = next.studyNotes.find((item) => item._id === noteId);
    if (!note) throw new Error("没有找到这条语法笔记。");
    const normalized = normalizeSentence({ ...sentence, _id: customId("example") }, note.examples.length);
    if (!normalized.english) throw new Error("请输入英文例句。");
    note.examples.push(normalized);
    return save(next);
  }

  function removeExample(lesson, noteId, exampleId) {
    const next = prepareLesson(lesson);
    const note = next.studyNotes.find((item) => item._id === noteId);
    if (!note) return save(next);
    note.examples = note.examples.filter((example) => example._id !== exampleId);
    return save(next);
  }

  function addSentence(lesson, sentence) {
    const next = prepareLesson(lesson);
    const normalized = normalizeSentence({ ...sentence, _id: customId("sentence") }, next.sentences.length);
    if (!normalized.english) throw new Error("请输入英文句子或文章段落。");
    next.sentences.push(normalized);
    return save(next);
  }

  function removeSentence(lesson, sentenceId) {
    const next = prepareLesson(lesson);
    next.sentences = next.sentences.filter((sentence) => sentence._id !== sentenceId);
    return save(next);
  }

  function forget(lessonId) {
    delete memoryState.overrides[lessonId];
    writeState();
  }

  function deleteLesson(lessonId) {
    const normalizedId = String(lessonId || "");
    if (!normalizedId) return false;
    memoryState.deleted = [...new Set([...(memoryState.deleted || []), normalizedId])];
    delete memoryState.overrides[normalizedId];
    writeState();
    return true;
  }

  window.LessonEditor = {
    apply,
    rename,
    addWord,
    removeWord,
    addNote,
    removeNote,
    addExample,
    removeExample,
    addSentence,
    removeSentence,
    forget,
    deleteLesson
  };
})();
