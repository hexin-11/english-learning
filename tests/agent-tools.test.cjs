const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "js", "agent-tools.js"), "utf8");
const savedLessons = [];
const prepended = [];
const presentations = [];
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
    getState: () => ({ favorites: [], mastered: [], review: [], recentLessons: [] }),
    toggleFavorite() {},
    setWordStatus() {}
  },
  CloudAuth: { getState: () => ({ user: null }) },
  CourseExporter: { exportPdf: async () => {}, exportWord: () => {} },
  location: { hash: "#lessons" }
};

vm.runInNewContext(source, { window, console, Date, Math }, { filename: "agent-tools.js" });

(async () => {
  const context = window.XiaoHeTools.context();
  assert.equal(context.overview.lessons, 1);
  assert.equal(context.overview.words, 1);
  assert.equal(context.lessonIndex[0].title, "第一课");

  const search = await window.XiaoHeTools.execute({ name: "search_course", args: { query: "你好" } });
  assert.equal(search.ok, true);
  assert.equal(search.words[0].english, "hello");

  assert.equal(window.XiaoHeTools.requiresConfirmation({ name: "get_lesson_detail" }), false);
  assert.equal(window.XiaoHeTools.requiresConfirmation({ name: "create_lesson" }), true);
  assert.equal(window.XiaoHeTools.requiresConfirmation({ name: "create_presentation" }), true);
  assert.match(source, /pptx\.writeFile\(\{ fileName, compression: true \}\)/);

  const created = await window.XiaoHeTools.execute({
    name: "create_lesson",
    args: {
      title: "旅行英语",
      words: [{ english: "passport", ipa: "/ˈpɑːspɔːt/", chinese: "n. 护照" }],
      sentences: [{ english: "May I see your passport?", chinese: "我可以看看你的护照吗？" }]
    }
  });
  assert.equal(created.ok, true);
  assert.equal(savedLessons.length, 1);
  assert.equal(prepended[0], savedLessons[0].id);
  assert.equal(window.XiaoHeTools.takeReloadRequest(), true);
  assert.equal(window.XiaoHeTools.takeReloadRequest(), false);

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
