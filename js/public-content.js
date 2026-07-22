(function () {
  "use strict";

  const CACHE_KEY = "hexin-public-lessons-cache:v1";
  const RELOAD_KEY = "hexin-public-lessons-reload:v1";
  const MAX_LESSONS = 120;
  const MAX_WORDS = 800;
  const MAX_SENTENCES = 800;
  const staticLessons = clone(Array.isArray(window.ENGLISH_LESSONS) ? window.ENGLISH_LESSONS : []);

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function cleanText(value, maxLength) {
    return String(value || "").trim().slice(0, maxLength);
  }

  function normalizeWord(word, index) {
    const english = cleanText(word?.english, 180);
    if (!english) return null;
    return {
      ...clone(word || {}),
      _id: cleanText(word?._id, 100) || String(index),
      english,
      ipa: cleanText(word?.ipa, 180) || "/音标待补充/",
      chinese: cleanText(word?.chinese, 500)
    };
  }

  function normalizeSentence(sentence, index) {
    const english = cleanText(sentence?.english, 5000);
    if (!english) return null;
    return {
      ...clone(sentence || {}),
      _id: cleanText(sentence?._id, 100) || `sentence-${index}`,
      english,
      chinese: cleanText(sentence?.chinese, 5000),
      ...(cleanText(sentence?.ipa, 500) ? { ipa: cleanText(sentence.ipa, 500) } : {})
    };
  }

  function normalizeNote(note, index) {
    return {
      ...clone(note || {}),
      _id: cleanText(note?._id, 100) || `note-${index}`,
      title: cleanText(note?.title, 220) || "语法笔记",
      description: cleanText(note?.description, 3000),
      structures: (Array.isArray(note?.structures) ? note.structures : [])
        .map((item) => cleanText(item, 1000))
        .filter(Boolean)
        .slice(0, 100),
      examples: (Array.isArray(note?.examples) ? note.examples : [])
        .map(normalizeSentence)
        .filter(Boolean)
        .slice(0, MAX_SENTENCES)
    };
  }

  function normalizeLesson(lesson, index) {
    const id = cleanText(lesson?.id, 120) || `public-${index + 1}`;
    const number = Math.max(1, Math.floor(Number(lesson?.number) || index + 1));
    return {
      ...clone(lesson || {}),
      id,
      number,
      title: cleanText(lesson?.title, 220) || `第${number}课`,
      wordSectionTitle: cleanText(lesson?.wordSectionTitle, 220) || "单词与短语",
      readingTitle: cleanText(lesson?.readingTitle, 220) || "文章与句子",
      words: (Array.isArray(lesson?.words) ? lesson.words : [])
        .map(normalizeWord)
        .filter(Boolean)
        .slice(0, MAX_WORDS),
      studyNotes: (Array.isArray(lesson?.studyNotes) ? lesson.studyNotes : [])
        .map(normalizeNote)
        .slice(0, 200),
      sentences: (Array.isArray(lesson?.sentences) ? lesson.sentences : [])
        .map(normalizeSentence)
        .filter(Boolean)
        .slice(0, MAX_SENTENCES),
      _public: true
    };
  }

  function normalizeLessons(value) {
    if (!Array.isArray(value)) return [];
    const publishable = window.CoursePrivacy?.filterPublishable?.(value) || value;
    return publishable
      .slice(0, MAX_LESSONS)
      .map(normalizeLesson)
      .sort((left, right) => left.number - right.number);
  }

  function readCache() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(CACHE_KEY) || "null");
      if (!parsed || typeof parsed !== "object") return null;
      const lessons = normalizeLessons(parsed.lessons);
      if (!lessons.length) return null;
      return {
        lessons,
        updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : ""
      };
    } catch (_error) {
      return null;
    }
  }

  function writeCache(lessons, updatedAt) {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({
      schemaVersion: 1,
      lessons: normalizeLessons(lessons),
      updatedAt: updatedAt || new Date().toISOString()
    }));
  }

  function activePayload(row) {
    const content = row?.content;
    if (Array.isArray(content)) return content;
    if (content && Array.isArray(content.lessons)) return content.lessons;
    return [];
  }

  function applyRemote(row, options) {
    const lessons = normalizeLessons(activePayload(row));
    if (!lessons.length) return false;
    const updatedAt = String(row?.updated_at || row?.updatedAt || "");
    const cache = readCache();
    if (cache?.updatedAt && cache.updatedAt === updatedAt) return false;

    writeCache(lessons, updatedAt);
    window.ENGLISH_LESSONS = clone(lessons);
    window.dispatchEvent(new CustomEvent("hexin:public-lessons-updated", {
      detail: { lessons: clone(lessons), updatedAt }
    }));

    if (options?.reload === false) return true;
    try {
      if (window.sessionStorage.getItem(RELOAD_KEY) === updatedAt) return true;
      window.sessionStorage.setItem(RELOAD_KEY, updatedAt);
    } catch (_error) {
      // 会话存储不可用时仍然使用已写入的课程缓存。
    }
    window.location.reload();
    return true;
  }

  function clearCache() {
    window.localStorage.removeItem(CACHE_KEY);
    try { window.sessionStorage.removeItem(RELOAD_KEY); } catch (_error) { /* no-op */ }
  }

  const cache = readCache();
  window.ENGLISH_LESSONS = cache?.lessons?.length
    ? clone(cache.lessons)
    : normalizeLessons(staticLessons);

  window.PublicLessons = Object.freeze({
    cacheKey: CACHE_KEY,
    applyRemote,
    clearCache,
    getCacheMeta: () => ({ updatedAt: readCache()?.updatedAt || "" }),
    getStaticLessons: () => normalizeLessons(staticLessons),
    getActiveLessons: () => clone(window.ENGLISH_LESSONS || [])
  });
})();
