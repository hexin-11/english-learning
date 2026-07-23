const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "js", "agent-tools.js"), "utf8");
const agentSource = fs.readFileSync(path.join(root, "js", "agent.js"), "utf8");
const savedLessons = [];
const prepended = [];
const presentations = [];
const dictionaryFavorites = [];
const localStorageValues = new Map([
  ["hexin-spelling-preferences:v1", JSON.stringify({ mistakes: { word: ["word:lesson-1:hello"], sentence: [] } })]
]);
const baseLesson = {
  id: "lesson-1",
  number: 1,
  title: "第一课",
  words: [{ _id: "hello", english: "hello", ipa: "/həˈləʊ/", chinese: "int. 你好" }],
  sentences: [{ english: "Hello, Amy.", chinese: "你好，艾米。" }],
  studyNotes: []
};

const window = {
  PptxGenJS: class MockPptxGenJS {
    constructor() { this.slides = []; presentations.push(this); }
    addSlide() {
      const slide = { addText() {} };
      this.slides.push(slide);
      return slide;
    }
    async writeFile(options) { this.written = options; }
  },
  ENGLISH_LESSONS: [baseLesson],
  CoursePrivacy: { ownerLessonsForActiveAccount: () => [] },
  LessonImporter: {
    getLessons: () => savedLessons,
    saveLesson: (lesson) => { savedLessons.push(lesson); return lesson; },
    deleteLesson: () => true
  },
  LessonEditor: {
    apply: (lessons) => lessons,
    canEdit: () => true,
    prepend: (id) => prepended.push(id),
    rename: (lesson, title) => ({ ...lesson, title }),
    addWord: (lesson, word) => ({ ...lesson, words: [...lesson.words, word] }),
    addSentence: (lesson, sentence) => ({ ...lesson, sentences: [...lesson.sentences, sentence] }),
    deleteLesson: () => true
  },
  LearningStorage: {
    getState: () => ({ favorites: [], dictionaryFavorites, mastered: [], review: [], recentLessons: [] }),
    toggleFavorite() {},
    dictionaryFavoriteId: (value) => `dictionary:${encodeURIComponent(String(value).trim().toLowerCase())}`,
    toggleDictionaryFavorite(entry) {
      const id = this.dictionaryFavoriteId(entry.english);
      const index = dictionaryFavorites.findIndex((item) => item.id === id);
      if (index >= 0) dictionaryFavorites.splice(index, 1);
      else dictionaryFavorites.push({ id, ...entry });
    },
    setWordStatus() {}
  },
  OnlineDictionary: {
    normalizeQuery: (value) => String(value || "").trim().toLowerCase(),
    async lookup(word) {
      return {
        word,
        phonetics: ["/ɪnˈtɪmɪdeɪt/"],
        translation: "恐吓；威胁",
        meanings: [{
          partOfSpeech: "verb",
          definitions: [{ chinese: "恐吓；威胁", definition: "frighten someone" }]
        }]
      };
    }
  },
  CloudAuth: { getState: () => ({ user: null }) },
  localStorage: {
    getItem: (key) => localStorageValues.get(key) || null,
    setItem: (key, value) => localStorageValues.set(key, String(value))
  },
  XiaoHeMemory: { context: () => ({ preferences: ["美式发音"], goals: [], facts: [], recentTasks: [] }) },
  CourseExporter: { exportPdf: async () => {}, exportWord: () => {} },
  location: { hash: "#lessons" }
};

vm.runInNewContext(source, { window, console, Date, Math }, { filename: "agent-tools.js" });

(async () => {
  const context = window.XiaoHeTools.context();
  assert.equal(context.overview.lessons, 1);
  assert.equal(context.overview.words, 1);
  assert.equal(context.lessonIndex[0].title, "第一课");
  assert.equal(context.memory.preferences[0], "美式发音");
  const relevantContext = window.XiaoHeTools.context("hello 怎么读");
  assert.equal(relevantContext.relevantLessons[0].title, "第一课");
  assert.equal(relevantContext.relevantLessons[0].words[0].english, "hello");

  const reviewMaterial = await window.XiaoHeTools.execute({ name: "get_review_material", args: { limit: 10 } });
  assert.equal(reviewMaterial.ok, true);
  assert.equal(reviewMaterial.summary.spellingWordMistakes, 1);
  assert.equal(reviewMaterial.priorityWords[0].english, "hello");
  assert.equal(reviewMaterial.priorityWords[0].spellingMistake, true);

  const search = await window.XiaoHeTools.execute({ name: "search_course", args: { query: "你好" } });
  assert.equal(search.ok, true);
  assert.equal(search.words[0].english, "hello");

  const lookup = await window.XiaoHeTools.execute({ name: "lookup_dictionary_word", args: { word: "intimidate" } });
  assert.equal(lookup.ok, true);
  assert.equal(lookup.ipa, "/ɪnˈtɪmɪdeɪt/");
  assert.match(lookup.chinese, /v\. 恐吓；威胁/);

  const directFavorite = window.XiaoHeTools.matchDirectCommand("intimidate给我收藏一下");
  assert.equal(directFavorite.length, 1);
  assert.equal(directFavorite[0].name, "update_word_state");
  assert.equal(directFavorite[0].args.word, "intimidate");

  const favorite = await window.XiaoHeTools.execute(directFavorite[0]);
  assert.equal(favorite.ok, true);
  assert.equal(favorite.source, "online_dictionary");
  assert.equal(dictionaryFavorites[0].english, "intimidate");
  const favoriteVerification = await window.XiaoHeTools.verify(directFavorite[0], favorite);
  assert.equal(favoriteVerification.verified, true);
  assert.equal(favoriteVerification.check, "word_favorite");
  assert.match(window.XiaoHeTools.summarizeTrace([{
    calls: directFavorite,
    results: [{ name: "update_word_state", result: favorite }]
  }]), /已将 intimidate 收藏.*恐吓/);

  assert.equal(window.XiaoHeTools.requiresConfirmation({ name: "get_lesson_detail" }), false);
  assert.equal(window.XiaoHeTools.requiresConfirmation({ name: "create_lesson" }), true);
  assert.equal(window.XiaoHeTools.requiresConfirmation({ name: "create_presentation" }), true);
  assert.match(source, /pptx\.writeFile\(\{ fileName, compression: true \}\)/);
  assert.match(agentSource, /XiaoHeTools\?\.summarizeTrace\?\.\(trace\)/);
  assert.match(agentSource, /completedMutations\.get\(key\)/);
  assert.match(agentSource, /matchDirectCommand/);
  assert.match(agentSource, /XiaoHeTools\.verify\(call, result\)/);
  assert.match(agentSource, /ACTION_NOT_VERIFIED/);

  const created = await window.XiaoHeTools.execute({
    name: "create_lesson",
    args: {
      title: "旅行英语",
      words: [{ english: "passport", ipa: "/ˈpɑːspɔːt/", chinese: "n. 护照" }],
      sentences: [{ english: "May I see your passport?", chinese: "我可以看看你的护照吗？" }]
    }
  });
  assert.equal(created.ok, true);
  assert.deepEqual(Array.from(created.addedWords), ["passport"]);
  assert.equal(created.addedSentenceCount, 1);
  assert.equal(savedLessons.length, 1);
  assert.equal(prepended[0], savedLessons[0].id);
  assert.equal(window.XiaoHeTools.takeReloadRequest(), true);
  assert.equal(window.XiaoHeTools.takeReloadRequest(), false);
  assert.equal((await window.XiaoHeTools.verify({ name: "create_lesson", args: { title: "旅行英语" } }, created)).verified, true);

  const createSummary = window.XiaoHeTools.summarizeTrace([{
    calls: [{ name: "create_lesson", args: { title: "抖音中学习英语" } }],
    results: [{
      name: "create_lesson",
      result: {
        ok: true,
        lesson: { title: "抖音中学习英语" },
        addedWords: ["intimidate"],
        addedSentenceCount: 0
      }
    }]
  }]);
  assert.equal(createSummary, "已创建课程“抖音中学习英语”，并加入单词 intimidate，并放到课程列表最前面。");

  const deniedSummary = window.XiaoHeTools.summarizeTrace([{
    calls: [{ name: "edit_lesson", args: { lesson: "第一课", operation: "add_word", english: "intimidate" } }],
    results: [{ name: "edit_lesson", result: { ok: false, error: "USER_DENIED" } }]
  }]);
  assert.equal(deniedSummary, "你取消了操作，所以没有修改课程。");

  const presentation = await window.XiaoHeTools.execute({
    name: "create_presentation",
    args: {
      title: "Travel English",
      subtitle: "机场英语入门",
      slides: [
        { title: "Key words", bullets: ["passport：护照", "boarding pass：登机牌"] },
        { title: "Practice", bullets: ["May I see your passport? 可以看一下你的护照吗？"] }
      ]
    }
  });
  assert.equal(presentation.ok, true);
  assert.equal(presentation.slideCount, 3);
  assert.equal(presentations[0].slides.length, 3);
  assert.equal(presentations[0].written.fileName, "Travel English.pptx");

  console.log("Agent browser-tool tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
