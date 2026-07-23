(function () {
  "use strict";

  const MUTATING_TOOLS = new Set([
    "create_lesson",
    "edit_lesson",
    "delete_lesson",
    "update_word_state",
    "export_lesson",
    "create_presentation"
  ]);
  const VALID_VIEWS = new Set(["home", "lessons", "search", "favorites", "flashcards", "spelling"]);
  const PPTXGEN_URL = "https://cdn.jsdelivr.net/npm/pptxgenjs@4.0.1/dist/pptxgen.bundle.js";
  let pptxPromise = null;
  let reloadRequested = false;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function cleanText(value, limit = 500) {
    return String(value || "").trim().slice(0, limit);
  }

  function lessonSources() {
    const publicLessons = Array.isArray(window.ENGLISH_LESSONS) ? window.ENGLISH_LESSONS : [];
    const ownerLessons = window.CoursePrivacy?.ownerLessonsForActiveAccount?.() || [];
    const baseLessons = [...publicLessons, ...ownerLessons];
    const baseIds = new Set(baseLessons.map((lesson) => String(lesson.id)));
    const imported = window.LessonImporter?.getLessons?.() || [];
    return [
      ...baseLessons,
      ...imported.filter((lesson) => !baseIds.has(String(lesson.id)))
    ].sort((left, right) => Number(left.number) - Number(right.number));
  }

  function lessons() {
    const sources = lessonSources();
    return window.LessonEditor?.apply?.(sources) || clone(sources);
  }

  function findLesson(reference) {
    const query = cleanText(reference, 180).toLocaleLowerCase();
    if (!query) return null;
    return lessons().find((lesson) => {
      const id = String(lesson.id || "").toLocaleLowerCase();
      const title = String(lesson.title || "").toLocaleLowerCase();
      const number = String(lesson.number || "");
      return id === query || title === query || number === query || title.includes(query);
    }) || null;
  }

  function lessonSummary(lesson) {
    return {
      id: String(lesson.id || ""),
      number: Number(lesson.number) || 0,
      title: cleanText(lesson.title, 180),
      wordCount: Array.isArray(lesson.words) ? lesson.words.length : 0,
      sentenceCount: Array.isArray(lesson.sentences) ? lesson.sentences.length : 0,
      noteCount: Array.isArray(lesson.studyNotes) ? lesson.studyNotes.length : 0,
      editable: window.LessonEditor?.canEdit?.(lesson) === true
    };
  }

  function allWords() {
    return lessons().flatMap((lesson) => (lesson.words || []).map((word, index) => ({
      ...word,
      id: `${lesson.id}:${word._id || index}`,
      lessonId: lesson.id,
      lessonTitle: lesson.title
    })));
  }

  function normalizeEnglish(value) {
    const fallback = cleanText(value, 160)
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/\s+/g, " ")
      .toLocaleLowerCase("en");
    return window.OnlineDictionary?.normalizeQuery?.(value) || fallback;
  }

  const PART_OF_SPEECH_LABELS = {
    noun: "n.", verb: "v.", adjective: "adj.", adverb: "adv.",
    pronoun: "pron.", preposition: "prep.", conjunction: "conj.",
    interjection: "int.", determiner: "det.", numeral: "num."
  };

  function dictionaryChinese(entry) {
    const groups = (Array.isArray(entry?.meanings) ? entry.meanings : []).flatMap((meaning) => {
      const definitions = (Array.isArray(meaning?.definitions) ? meaning.definitions : [])
        .map((definition) => cleanText(definition?.chinese, 180))
        .filter(Boolean)
        .slice(0, 2);
      if (!definitions.length) return [];
      const label = PART_OF_SPEECH_LABELS[String(meaning?.partOfSpeech || "").toLocaleLowerCase("en")]
        || cleanText(meaning?.partOfSpeech, 24);
      return [`${label ? `${label} ` : ""}${definitions.join("；")}`];
    }).slice(0, 4);
    return groups.join("；") || cleanText(entry?.translation, 500) || "中文释义待补充";
  }

  function dictionaryResult(entry) {
    return {
      word: cleanText(entry?.word || entry?.query, 160),
      ipa: cleanText((Array.isArray(entry?.phonetics) ? entry.phonetics[0] : ""), 160),
      chinese: dictionaryChinese(entry),
      meanings: (Array.isArray(entry?.meanings) ? entry.meanings : []).slice(0, 8)
    };
  }

  async function lookupDictionaryWord(args) {
    const query = normalizeEnglish(args.word);
    if (!query || !window.OnlineDictionary?.lookup) return { ok: false, error: "DICTIONARY_UNAVAILABLE" };
    try {
      const entry = await window.OnlineDictionary.lookup(query);
      return { ok: true, ...dictionaryResult(entry), source: "online_dictionary" };
    } catch (error) {
      return {
        ok: false,
        error: "DICTIONARY_LOOKUP_FAILED",
        message: cleanText(error?.message, 240) || "在线词典没有找到这个单词。"
      };
    }
  }

  function learningOverview() {
    const lessonList = lessons();
    const words = allWords();
    const state = window.LearningStorage?.getState?.() || {};
    return {
      lessons: lessonList.length,
      words: words.length,
      mastered: state.mastered?.length || 0,
      review: state.review?.length || 0,
      favorites: (state.favorites?.length || 0) + (state.dictionaryFavorites?.length || 0),
      recentLessons: (state.recentLessons || []).slice(0, 5),
      currentPage: window.location.hash.slice(1) || "home",
      signedIn: Boolean(window.CloudAuth?.getState?.()?.user)
    };
  }

  function spellingSentences(lesson) {
    const items = [];
    (lesson.studyNotes || []).forEach((note) => (note.examples || []).forEach((example) => items.push(example)));
    (lesson.sentences || []).forEach((sentence) => items.push(sentence));
    const seen = new Set();
    return items.filter((item) => {
      const english = cleanText(item.english, 240);
      const key = english.toLocaleLowerCase("en").replace(/\s+/g, " ");
      const wordCount = key.split(" ").filter(Boolean).length;
      if (!key || seen.has(key) || wordCount < 2 || wordCount > 38 || english.includes("/")) return false;
      seen.add(key);
      return true;
    });
  }

  function readSpellingMistakes() {
    try {
      const parsed = JSON.parse(window.localStorage?.getItem("hexin-spelling-preferences:v1") || "{}");
      return {
        word: new Set(Array.isArray(parsed.mistakes?.word) ? parsed.mistakes.word : []),
        sentence: new Set(Array.isArray(parsed.mistakes?.sentence) ? parsed.mistakes.sentence : [])
      };
    } catch (_error) {
      return { word: new Set(), sentence: new Set() };
    }
  }

  function reviewMaterial(args = {}) {
    const limit = Math.max(1, Math.min(50, Number(args.limit) || 20));
    const state = window.LearningStorage?.getState?.() || {};
    const mastered = new Set(Array.isArray(state.mastered) ? state.mastered : []);
    const review = new Set(Array.isArray(state.review) ? state.review : []);
    const mistakes = readSpellingMistakes();
    const wordQuestions = [];
    const sentenceQuestions = [];

    lessons().forEach((lesson) => {
      (lesson.words || []).forEach((word, index) => {
        const itemId = `${lesson.id}:${word._id || index}`;
        const spellingId = `word:${itemId}`;
        wordQuestions.push({
          id: itemId,
          english: cleanText(word.english, 160),
          ipa: cleanText(word.ipa, 160),
          chinese: cleanText(word.chinese, 300),
          lessonId: String(lesson.id || ""),
          lessonTitle: cleanText(lesson.title, 180),
          spellingMistake: mistakes.word.has(spellingId),
          status: review.has(itemId) ? "review" : mastered.has(itemId) ? "mastered" : "unmastered"
        });
      });
      spellingSentences(lesson).forEach((sentence, index) => {
        const spellingId = `sentence:${lesson.id}:${sentence._id || index}`;
        if (!mistakes.sentence.has(spellingId)) return;
        sentenceQuestions.push({
          id: spellingId,
          english: cleanText(sentence.english, 240),
          chinese: cleanText(sentence.chinese, 400),
          lessonTitle: cleanText(lesson.title, 180)
        });
      });
    });

    const priorityWords = wordQuestions
      .filter((item) => item.spellingMistake || item.status === "review" || item.status === "unmastered")
      .sort((left, right) => Number(right.spellingMistake) - Number(left.spellingMistake)
        || Number(right.status === "review") - Number(left.status === "review"));
    const dictionaryFavorites = (Array.isArray(state.dictionaryFavorites) ? state.dictionaryFavorites : [])
      .slice(0, limit).map((item) => ({
        english: cleanText(item.english, 160), ipa: cleanText(item.ipa, 160), chinese: cleanText(item.chinese, 300)
      }));
    return {
      ok: true,
      summary: {
        spellingWordMistakes: wordQuestions.filter((item) => item.spellingMistake).length,
        spellingSentenceMistakes: sentenceQuestions.length,
        reviewWords: wordQuestions.filter((item) => item.status === "review").length,
        masteredWords: mastered.size
      },
      priorityWords: priorityWords.slice(0, limit),
      sentenceMistakes: sentenceQuestions.slice(0, limit),
      dictionaryFavorites
    };
  }

  function queryTerms(value) {
    const normalized = cleanText(value, 1000).toLocaleLowerCase("en");
    return [...new Set(normalized.match(/[a-z][a-z'\u2019-]{1,}|[\u3400-\u9fff]{2,}/g) || [])].slice(0, 20);
  }

  function relevantLessons(query) {
    const normalized = cleanText(query, 1000).toLocaleLowerCase("en");
    const terms = queryTerms(normalized);
    if (!terms.length) return [];
    return lessons().map((lesson) => {
      const title = String(lesson.title || "").toLocaleLowerCase("en");
      const words = lesson.words || [];
      const sentences = lesson.sentences || [];
      let score = title && normalized.includes(title) ? 20 : 0;
      for (const term of terms) {
        if (title.includes(term)) score += 10;
        for (const word of words) {
          const english = String(word.english || "").toLocaleLowerCase("en");
          const chinese = String(word.chinese || "").toLocaleLowerCase("en");
          if (english === term) score += 16;
          else if (english.includes(term) || chinese.includes(term)) score += 5;
        }
        for (const sentence of sentences) {
          if (String(sentence.english || "").toLocaleLowerCase("en").includes(term)
            || String(sentence.chinese || "").toLocaleLowerCase("en").includes(term)) score += 2;
        }
      }
      return { lesson, score };
    }).filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score || Number(left.lesson.number) - Number(right.lesson.number))
      .slice(0, 5)
      .map(({ lesson, score }) => ({
        ...lessonSummary(lesson),
        relevanceScore: score,
        words: (lesson.words || []).filter((word) => terms.some((term) => {
          return String(word.english || "").toLocaleLowerCase("en").includes(term)
            || String(word.chinese || "").toLocaleLowerCase("en").includes(term);
        })).slice(0, 20).map((word) => ({ english: word.english, ipa: word.ipa, chinese: word.chinese })),
        sentences: (lesson.sentences || []).filter((sentence) => terms.some((term) => {
          return String(sentence.english || "").toLocaleLowerCase("en").includes(term)
            || String(sentence.chinese || "").toLocaleLowerCase("en").includes(term);
        })).slice(0, 8).map((sentence) => ({ english: sentence.english, chinese: sentence.chinese }))
      }));
  }

  function context(query) {
    return {
      overview: learningOverview(),
      memory: window.XiaoHeMemory?.context?.() || {},
      relevantLessons: relevantLessons(query),
      lessonIndex: lessons().map(lessonSummary).slice(0, 60)
    };
  }

  function lessonDetail(reference) {
    const lesson = findLesson(reference);
    if (!lesson) return { ok: false, error: "LESSON_NOT_FOUND" };
    return {
      ok: true,
      lesson: {
        ...lessonSummary(lesson),
        words: (lesson.words || []).slice(0, 200).map((word) => ({
          english: cleanText(word.english, 160),
          ipa: cleanText(word.ipa, 160),
          chinese: cleanText(word.chinese, 300)
        })),
        sentences: (lesson.sentences || []).slice(0, 120).map((sentence) => ({
          english: cleanText(sentence.english, 1200),
          chinese: cleanText(sentence.chinese, 1200)
        })),
        notes: (lesson.studyNotes || []).slice(0, 40).map((note) => ({
          title: cleanText(note.title, 180),
          description: cleanText(note.description, 600),
          structures: (note.structures || []).slice(0, 20).map((item) => cleanText(item, 300))
        }))
      }
    };
  }

  function searchCourse(query) {
    const normalized = cleanText(query, 120).toLocaleLowerCase();
    if (!normalized) return { ok: false, error: "EMPTY_QUERY" };
    const wordMatches = allWords().filter((word) => {
      return String(word.english || "").toLocaleLowerCase().includes(normalized)
        || String(word.chinese || "").includes(normalized);
    }).slice(0, 30).map((word) => ({
      lessonId: word.lessonId,
      lessonTitle: word.lessonTitle,
      english: word.english,
      ipa: word.ipa,
      chinese: word.chinese
    }));
    const sentenceMatches = lessons().flatMap((lesson) => (lesson.sentences || []).flatMap((sentence) => {
      const matched = String(sentence.english || "").toLocaleLowerCase().includes(normalized)
        || String(sentence.chinese || "").includes(normalized);
      return matched ? [{ lessonId: lesson.id, lessonTitle: lesson.title, english: sentence.english, chinese: sentence.chinese }] : [];
    })).slice(0, 20);
    return { ok: true, words: wordMatches, sentences: sentenceMatches };
  }

  function nextLessonNumber() {
    return Math.max(0, ...lessonSources().map((lesson) => Number(lesson.number) || 0)) + 1;
  }

  function createLesson(args) {
    if (!window.LessonImporter?.saveLesson) return { ok: false, error: "IMPORTER_UNAVAILABLE" };
    const number = nextLessonNumber();
    const title = cleanText(args.title, 180) || `第${number}课`;
    const lesson = {
      id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      number,
      title,
      wordSectionTitle: "单词与短语",
      readingTitle: "文章与例句",
      words: (Array.isArray(args.words) ? args.words : []).slice(0, 80).map((word) => ({
        english: cleanText(word?.english, 160),
        ipa: cleanText(word?.ipa, 160) || "/音标待补充/",
        chinese: cleanText(word?.chinese, 300) || "中文释义待补充"
      })).filter((word) => word.english),
      sentences: (Array.isArray(args.sentences) ? args.sentences : []).slice(0, 80).map((sentence) => ({
        english: cleanText(sentence?.english, 1200),
        chinese: cleanText(sentence?.chinese, 1200) || "中文翻译待补充"
      })).filter((sentence) => sentence.english),
      imported: true,
      manual: true,
      sourceName: "小何 Agent",
      importedAt: Date.now()
    };
    const saved = window.LessonImporter.saveLesson(lesson);
    window.LessonEditor?.prepend?.(saved.id);
    reloadRequested = true;
    return {
      ok: true,
      lesson: lessonSummary(saved),
      addedWords: lesson.words.map((word) => word.english),
      addedSentenceCount: lesson.sentences.length,
      message: "课程已创建并放到课程列表最前面。"
    };
  }

  function editLesson(args) {
    const lesson = findLesson(args.lesson);
    if (!lesson) return { ok: false, error: "LESSON_NOT_FOUND" };
    if (!window.LessonEditor?.canEdit?.(lesson)) return { ok: false, error: "LESSON_READ_ONLY" };
    const operation = cleanText(args.operation, 40);
    let saved;
    let item = null;
    if (operation === "rename") saved = window.LessonEditor.rename(lesson, cleanText(args.title, 180));
    else if (operation === "add_word") {
      item = {
        english: cleanText(args.english, 160),
        ipa: cleanText(args.ipa, 160) || "/音标待补充/",
        chinese: cleanText(args.chinese, 300) || "中文释义待补充"
      };
      saved = window.LessonEditor.addWord(lesson, item);
    } else if (operation === "add_sentence") {
      item = {
        english: cleanText(args.english, 1200),
        chinese: cleanText(args.chinese, 1200) || "中文翻译待补充"
      };
      saved = window.LessonEditor.addSentence(lesson, item);
    }
    else return { ok: false, error: "INVALID_OPERATION" };
    reloadRequested = true;
    return { ok: true, lesson: lessonSummary(saved), operation, item };
  }

  function deleteLesson(args) {
    const lesson = findLesson(args.lesson);
    if (!lesson) return { ok: false, error: "LESSON_NOT_FOUND" };
    if (!window.LessonEditor?.canEdit?.(lesson)) return { ok: false, error: "LESSON_READ_ONLY" };
    if (lesson.imported) window.LessonImporter?.deleteLesson?.(lesson.id);
    window.LessonEditor?.deleteLesson?.(lesson.id, lesson);
    reloadRequested = true;
    return { ok: true, deleted: lessonSummary(lesson) };
  }

  async function updateWordState(args) {
    const query = normalizeEnglish(args.word);
    const word = allWords().find((item) => String(item.english || "").toLocaleLowerCase() === query);
    const action = cleanText(args.action, 40);
    const state = window.LearningStorage?.getState?.() || {};
    if (!word) {
      const favoriteId = window.LearningStorage?.dictionaryFavoriteId?.(query) || `dictionary:${encodeURIComponent(query)}`;
      const saved = (state.dictionaryFavorites || []).find((item) => item.id === favoriteId);
      if (action === "unfavorite") {
        if (saved) window.LearningStorage.toggleDictionaryFavorite(saved);
      return { ok: true, word: saved?.english || query, wordId: favoriteId, action, source: "online_dictionary" };
      }
      if (action === "mastered" || action === "review") {
        if (!saved) return { ok: false, error: "WORD_NOT_SAVED" };
        const statusList = action === "mastered" ? state.mastered : state.review;
        if (!statusList?.includes(saved.id)) window.LearningStorage.setWordStatus(saved.id, action);
        return { ok: true, word: saved.english, wordId: saved.id, ipa: saved.ipa, chinese: saved.chinese, action, source: "online_dictionary" };
      }
      if (action !== "favorite") return { ok: false, error: "INVALID_ACTION" };
      if (saved) return { ok: true, ...saved, word: saved.english, wordId: saved.id, action, source: "online_dictionary", alreadySaved: true };
      const lookup = await lookupDictionaryWord({ word: query });
      if (!lookup.ok) return lookup;
      const favorite = { english: lookup.word || query, ipa: lookup.ipa, chinese: lookup.chinese };
      window.LearningStorage?.toggleDictionaryFavorite?.(favorite);
      const storedId = window.LearningStorage?.dictionaryFavoriteId?.(favorite.english) || favoriteId;
      return { ok: true, word: favorite.english, wordId: storedId, ipa: favorite.ipa, chinese: favorite.chinese, action, source: "online_dictionary" };
    }
    if (action === "favorite") {
      if (!state.favorites?.includes(word.id)) window.LearningStorage.toggleFavorite(word.id);
    } else if (action === "unfavorite") {
      if (state.favorites?.includes(word.id)) window.LearningStorage.toggleFavorite(word.id);
    } else if (action === "mastered") {
      if (!state.mastered?.includes(word.id)) window.LearningStorage.setWordStatus(word.id, "mastered");
    } else if (action === "review") {
      if (!state.review?.includes(word.id)) window.LearningStorage.setWordStatus(word.id, "review");
    } else return { ok: false, error: "INVALID_ACTION" };
    return { ok: true, word: word.english, wordId: word.id, lesson: word.lessonTitle, action, source: "course" };
  }

  function includesEnglish(items, value) {
    const query = normalizeEnglish(value);
    return (Array.isArray(items) ? items : []).some((item) => normalizeEnglish(item?.english) === query);
  }

  async function verify(call, result) {
    if (!result?.ok) return { verified: false, check: "tool_failed" };
    const args = call?.args || {};
    if (call?.name === "create_lesson") {
      const lesson = findLesson(result.lesson?.id || result.lesson?.title || args.title);
      return { verified: Boolean(lesson), check: "lesson_exists" };
    }
    if (call?.name === "edit_lesson") {
      const lesson = findLesson(result.lesson?.id || args.lesson);
      let verified = Boolean(lesson);
      if (verified && result.operation === "rename") verified = cleanText(lesson.title, 180) === cleanText(args.title, 180);
      if (verified && result.operation === "add_word") verified = includesEnglish(lesson.words, result.item?.english || args.english);
      if (verified && result.operation === "add_sentence") {
        verified = (lesson.sentences || []).some((item) => cleanText(item.english, 1200) === cleanText(result.item?.english || args.english, 1200));
      }
      return { verified, check: `lesson_${result.operation || "updated"}` };
    }
    if (call?.name === "delete_lesson") {
      return { verified: !findLesson(result.deleted?.id || args.lesson), check: "lesson_absent" };
    }
    if (call?.name === "update_word_state") {
      const state = window.LearningStorage?.getState?.() || {};
      const id = result.wordId;
      const dictionarySaved = (state.dictionaryFavorites || []).some((item) => item.id === id);
      const courseSaved = (state.favorites || []).includes(id);
      const checks = {
        favorite: result.source === "online_dictionary" ? dictionarySaved : courseSaved,
        unfavorite: result.source === "online_dictionary" ? !dictionarySaved : !courseSaved,
        mastered: (state.mastered || []).includes(id),
        review: (state.review || []).includes(id)
      };
      return { verified: checks[result.action] === true, check: `word_${result.action || "updated"}` };
    }
    if (call?.name === "navigate_to_page") {
      return { verified: window.location.hash.replace(/^#/, "") === result.page, check: "page_opened" };
    }
    if (call?.name === "export_lesson" || call?.name === "create_presentation") {
      return { verified: true, check: "download_started" };
    }
    return { verified: true, check: "read_completed" };
  }

  function matchDirectCommand(message) {
    const value = cleanText(message, 600);
    if (!/(收藏|加入收藏|移出收藏|取消收藏)/.test(value)) return [];
    const matches = value.match(/[A-Za-z][A-Za-z'\u2019 -]{0,80}/g) || [];
    const word = matches.map((item) => item.trim()).find(Boolean);
    if (!word) return [];
    const action = /(取消收藏|移出收藏)/.test(value) ? "unfavorite" : "favorite";
    return [{ id: `direct-${Date.now()}`, name: "update_word_state", args: { word, action } }];
  }

  function navigate(args) {
    const view = cleanText(args.page, 40);
    if (!VALID_VIEWS.has(view)) return { ok: false, error: "INVALID_PAGE" };
    window.location.hash = view;
    return { ok: true, page: view };
  }

  async function exportLesson(args) {
    const format = cleanText(args.format, 20).toLocaleLowerCase();
    const lesson = findLesson(args.lesson);
    const selected = lesson ? [lesson] : lessons();
    if (!selected.length) return { ok: false, error: "LESSON_NOT_FOUND" };
    if (format === "pdf") await window.CourseExporter.exportPdf(selected, window.LearningStorage.getState(), lesson?.title || "英语课程与学习记录");
    else if (format === "word") window.CourseExporter.exportWord(selected, window.LearningStorage.getState(), lesson?.title || "英语课程与学习记录");
    else return { ok: false, error: "INVALID_FORMAT" };
    return { ok: true, format, lessons: selected.map(lessonSummary) };
  }

  function loadPptxGen() {
    if (window.PptxGenJS) return Promise.resolve(window.PptxGenJS);
    if (pptxPromise) return pptxPromise;
    pptxPromise = new Promise((resolve, reject) => {
      const script = window.document.createElement("script");
      script.src = PPTXGEN_URL;
      script.async = true;
      script.onload = () => window.PptxGenJS
        ? resolve(window.PptxGenJS)
        : reject(new Error("PPT_COMPONENT_UNAVAILABLE"));
      script.onerror = () => reject(new Error("PPT_COMPONENT_LOAD_FAILED"));
      window.document.head.appendChild(script);
    }).catch((error) => {
      pptxPromise = null;
      throw error;
    });
    return pptxPromise;
  }

  function safeFileName(value) {
    return (cleanText(value, 80) || "小何英语学习")
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
      .replace(/\s+/g, " ")
      .trim();
  }

  function presentationSlides(args) {
    return (Array.isArray(args.slides) ? args.slides : []).slice(0, 12).map((slide, index) => ({
      title: cleanText(slide?.title, 100) || `第 ${index + 1} 页`,
      bullets: (Array.isArray(slide?.bullets) ? slide.bullets : [])
        .slice(0, 8)
        .map((item) => cleanText(item, 260))
        .filter(Boolean)
    })).filter((slide) => slide.bullets.length);
  }

  async function createPresentation(args) {
    const slides = presentationSlides(args);
    if (!slides.length) return { ok: false, error: "EMPTY_PRESENTATION" };
    const PptxGenJS = await loadPptxGen();
    const pptx = new PptxGenJS();
    const title = cleanText(args.title, 120) || "小何英语学习";
    const subtitle = cleanText(args.subtitle, 220);

    pptx.layout = "LAYOUT_WIDE";
    pptx.author = "小何英语学习 Agent";
    pptx.company = "何鑫英语学习";
    pptx.subject = title;
    pptx.title = title;
    pptx.lang = "zh-CN";
    pptx.theme = {
      headFontFace: "Aptos Display",
      bodyFontFace: "Aptos",
      lang: "zh-CN"
    };

    const cover = pptx.addSlide();
    cover.background = { color: "F7F7F5" };
    cover.addText("XIAO HE · ENGLISH LEARNING", {
      x: 0.8, y: 0.72, w: 11.7, h: 0.34,
      fontFace: "Aptos", fontSize: 11, bold: true, color: "777777", charSpacing: 1.8,
      margin: 0, breakLine: false
    });
    cover.addText(title, {
      x: 0.8, y: 1.55, w: 11.5, h: 1.5,
      fontFace: "Aptos Display", fontSize: 34, bold: true, color: "202020",
      margin: 0.02, valign: "mid", breakLine: false
    });
    if (subtitle) cover.addText(subtitle, {
      x: 0.82, y: 3.3, w: 10.9, h: 1.05,
      fontFace: "Aptos", fontSize: 18, color: "666666",
      margin: 0, breakLine: false, valign: "top"
    });
    cover.addText("Generated by 小何", {
      x: 0.82, y: 6.75, w: 4.2, h: 0.25,
      fontFace: "Aptos", fontSize: 10, color: "929292", margin: 0, breakLine: false
    });

    slides.forEach((item, index) => {
      const slide = pptx.addSlide();
      slide.background = { color: index % 2 ? "F5F5F2" : "FFFFFF" };
      slide.addText(String(index + 1).padStart(2, "0"), {
        x: 0.72, y: 0.45, w: 0.72, h: 0.4,
        fontFace: "Aptos", fontSize: 11, bold: true, color: "999999", margin: 0, breakLine: false
      });
      slide.addText(item.title, {
        x: 1.55, y: 0.42, w: 10.8, h: 0.72,
        fontFace: "Aptos Display", fontSize: 27, bold: true, color: "202020",
        margin: 0, breakLine: false, fit: "shrink"
      });
      const body = item.bullets.map((bullet) => `•  ${bullet}`).join("\n\n");
      slide.addText(body, {
        x: 1.55, y: 1.55, w: 10.45, h: 4.95,
        fontFace: "Aptos", fontSize: item.bullets.length > 6 ? 17 : 20,
        color: "333333", margin: 0.04, breakLine: false,
        breakLineOnOverflow: false, fit: "shrink", valign: "top", paraSpaceAfterPt: 12
      });
      slide.addText("小何英语学习", {
        x: 10.7, y: 6.85, w: 1.55, h: 0.2,
        fontFace: "Aptos", fontSize: 8, color: "AAAAAA", align: "right", margin: 0, breakLine: false
      });
    });

    const fileName = `${safeFileName(args.fileName || title)}.pptx`;
    await pptx.writeFile({ fileName, compression: true });
    return { ok: true, fileName, slideCount: slides.length + 1, title };
  }

  function describe(call) {
    const args = call?.args || {};
    const labels = {
      create_lesson: `新建课程“${cleanText(args.title, 40) || "未命名课程"}”`,
      edit_lesson: `${args.operation === "rename" ? "修改课名" : args.operation === "add_word" ? "添加单词" : "添加句子"}：${cleanText(args.lesson, 40)}`,
      delete_lesson: `删除课程：${cleanText(args.lesson, 40)}`,
      update_word_state: `更新单词状态：${cleanText(args.word, 40)} → ${cleanText(args.action, 30)}`,
      export_lesson: `导出 ${cleanText(args.lesson, 40) || "全部课程"} 为 ${cleanText(args.format, 10).toUpperCase()}`,
      create_presentation: `生成并下载 PPT：${cleanText(args.title, 50) || "英语学习演示"}`
    };
    return labels[call?.name] || cleanText(call?.name, 80);
  }

  function toolErrorMessage(error) {
    const messages = {
      USER_DENIED: "你取消了操作，所以没有修改课程。",
      LESSON_NOT_FOUND: "没有找到指定课程，所以没有完成修改。",
      LESSON_READ_ONLY: "这节课当前不可编辑，所以没有完成修改。",
      WORD_NOT_FOUND: "没有在课程中找到这个单词，所以没有更新学习状态。",
      WORD_NOT_SAVED: "这个在线词典单词还没有收藏，请先收藏后再标记学习状态。",
      DICTIONARY_UNAVAILABLE: "在线词典暂时不可用，请刷新页面后重试。",
      DICTIONARY_LOOKUP_FAILED: "在线词典没有找到这个单词，请检查拼写后重试。",
      ACTION_NOT_VERIFIED: "操作已经尝试执行，但核验没有通过，我没有把它当作成功。请刷新数据后重试。",
      IMPORTER_UNAVAILABLE: "课程保存功能暂时不可用，请刷新页面后重试。",
      TOOLS_UNAVAILABLE: "网页工具暂时不可用，请刷新页面后重试。"
    };
    return messages[cleanText(error, 80)] || "有一步没有执行成功，请再试一次。";
  }

  function summarizeSuccess(call, result) {
    const args = call?.args || {};
    const lessonTitle = cleanText(result?.lesson?.title || args.lesson, 100);
    if (call?.name === "create_lesson") {
      const words = (Array.isArray(result.addedWords) ? result.addedWords : [])
        .map((word) => cleanText(word, 80))
        .filter(Boolean);
      const wordText = words.length
        ? `，并加入${words.length === 1 ? `单词 ${words[0]}` : `${words.length} 个单词（${words.slice(0, 3).join("、")}${words.length > 3 ? "等" : ""}）`}`
        : "";
      const sentenceCount = Number(result.addedSentenceCount) || 0;
      const sentenceText = sentenceCount ? `和 ${sentenceCount} 个学习句子` : "";
      return `已创建课程“${lessonTitle || cleanText(args.title, 100) || "新课程"}”${wordText}${sentenceText}，并放到课程列表最前面。`;
    }
    if (call?.name === "edit_lesson") {
      if (result.operation === "rename") return `已把课程改名为“${lessonTitle || cleanText(args.title, 100)}”。`;
      if (result.operation === "add_word") {
        const word = cleanText(result.item?.english || args.english, 100);
        return `已把单词 ${word || "该词"} 添加到课程“${lessonTitle || "指定课程"}”。`;
      }
      if (result.operation === "add_sentence") return `已把句子添加到课程“${lessonTitle || "指定课程"}”。`;
    }
    if (call?.name === "delete_lesson") return `已删除课程“${cleanText(result.deleted?.title, 100) || "指定课程"}”。`;
    if (call?.name === "update_word_state") {
      const actions = { favorite: "收藏", unfavorite: "取消收藏", mastered: "标记为已掌握", review: "加入待复习" };
      const detail = result.source === "online_dictionary" && result.action === "favorite"
        ? `${cleanText(result.ipa, 100) ? ` ${cleanText(result.ipa, 100)}` : ""}${cleanText(result.chinese, 240) ? `：${cleanText(result.chinese, 240)}` : ""}`
        : "";
      const already = result.alreadySaved ? "（此前已收藏）" : "";
      return `已将 ${cleanText(result.word, 100) || cleanText(args.word, 100)} ${actions[result.action] || "更新状态"}${already}${detail}。`;
    }
    if (call?.name === "lookup_dictionary_word") {
      return `${cleanText(result.word, 100)}${cleanText(result.ipa, 100) ? ` ${cleanText(result.ipa, 100)}` : ""}：${cleanText(result.chinese, 500)}`;
    }
    if (call?.name === "navigate_to_page") return "已为你打开对应页面。";
    if (call?.name === "export_lesson") return `已完成 ${cleanText(result.format, 10).toUpperCase()} 导出。`;
    if (call?.name === "create_presentation") return `已生成并下载“${cleanText(result.fileName, 120) || "英语学习演示.pptx"}”。`;
    return "";
  }

  function summarizeTrace(trace) {
    const summaries = [];
    const failures = [];
    (Array.isArray(trace) ? trace : []).forEach((round) => {
      const calls = Array.isArray(round?.calls) ? round.calls : [];
      const results = Array.isArray(round?.results) ? round.results : [];
      results.forEach((entry, index) => {
        const call = calls[index] || { name: entry?.name, args: {} };
        const result = entry?.result || {};
        if (result.ok) {
          const summary = summarizeSuccess(call, result);
          if (summary && !summaries.includes(summary)) summaries.push(summary);
        } else {
          const message = result.message || toolErrorMessage(result.error);
          if (message && !failures.includes(message)) failures.push(message);
        }
      });
    });
    if (summaries.length) return [...summaries, ...failures].join("\n");
    if (failures.length) return failures.join("\n");
    return "我没有完成这次操作，请再说一次你要修改的课程和内容。";
  }

  async function execute(call) {
    const args = call?.args && typeof call.args === "object" ? call.args : {};
    const handlers = {
      get_learning_overview: () => ({ ok: true, ...learningOverview() }),
      list_lessons: () => ({ ok: true, lessons: lessons().map(lessonSummary) }),
      get_lesson_detail: () => lessonDetail(args.lesson),
      search_course: () => searchCourse(args.query),
      lookup_dictionary_word: () => lookupDictionaryWord(args),
      get_review_material: () => reviewMaterial(args),
      create_lesson: () => createLesson(args),
      edit_lesson: () => editLesson(args),
      delete_lesson: () => deleteLesson(args),
      update_word_state: () => updateWordState(args),
      navigate_to_page: () => navigate(args),
      export_lesson: () => exportLesson(args),
      create_presentation: () => createPresentation(args)
    };
    if (!handlers[call?.name]) return { ok: false, error: "UNKNOWN_TOOL" };
    try {
      return await handlers[call.name]();
    } catch (error) {
      return { ok: false, error: cleanText(error?.code || error?.message || "TOOL_FAILED", 300) };
    }
  }

  function takeReloadRequest() {
    const requested = reloadRequested;
    reloadRequested = false;
    return requested;
  }

  window.XiaoHeTools = Object.freeze({
    context,
    execute,
    verify,
    describe,
    summarizeTrace,
    matchDirectCommand,
    requiresConfirmation: (call) => MUTATING_TOOLS.has(call?.name),
    takeReloadRequest
  });
})();
