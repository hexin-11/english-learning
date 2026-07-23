(function () {
  "use strict";

  const STORAGE_KEY = "hexin-spelling-preferences:v1";
  const copy = {
    zh: {
      nav: "拼写", title: "拼写练习", description: "先听发音，再拼出单词、短语或完整句子。", word: "单词与短语", sentence: "句子", scope: "课程范围", all: "全部课程", shuffle: "重新出题", progress: "练习进度", correct: "正确", attempted: "已作答", streak: "连续正确", question: "第 {current} / {total} 题", wordPrompt: "根据发音和中文写出英文", sentencePrompt: "根据发音和中文写出完整句子", listen: "播放发音", listenAgain: "再听一次", answer: "你的答案", wordPlaceholder: "输入英文拼写", sentencePlaceholder: "输入完整英文句子", check: "检查答案", next: "下一题", hint: "提示", skip: "跳过", correctFeedback: "拼写正确", wrongFeedback: "还差一点，可以修改后再试。", skippedFeedback: "已显示答案，下一题继续。", expected: "正确答案", shortcutWord: "按 Enter 检查", shortcutSentence: "按 Ctrl + Enter 检查", noQuestions: "这个范围暂时没有可用的拼写题。", lesson: "课程", hintLabel: "拼写提示", accuracy: "正确率"
    },
    en: {
      nav: "Spelling", title: "Spelling practice", description: "Listen first, then spell the word, phrase, or full sentence.", word: "Words & phrases", sentence: "Sentences", scope: "Lesson", all: "All lessons", shuffle: "New set", progress: "Practice progress", correct: "Correct", attempted: "Answered", streak: "Streak", question: "Question {current} / {total}", wordPrompt: "Write the English from the audio and meaning", sentencePrompt: "Write the full sentence from the audio and meaning", listen: "Play audio", listenAgain: "Play again", answer: "Your answer", wordPlaceholder: "Type the English spelling", sentencePlaceholder: "Type the full English sentence", check: "Check", next: "Next", hint: "Hint", skip: "Skip", correctFeedback: "Correct spelling", wrongFeedback: "Almost there. Edit your answer and try again.", skippedFeedback: "The answer is shown. Keep going with the next one.", expected: "Correct answer", shortcutWord: "Press Enter to check", shortcutSentence: "Press Ctrl + Enter to check", noQuestions: "There are no spelling questions in this set yet.", lesson: "Lesson", hintLabel: "Spelling hint", accuracy: "Accuracy"
    },
    ko: {
      nav: "철자", title: "철자 연습", description: "발음을 듣고 단어, 구 또는 문장 전체를 입력하세요.", word: "단어와 구", sentence: "문장", scope: "수업 범위", all: "전체 수업", shuffle: "새 문제", progress: "연습 진행", correct: "정답", attempted: "응답", streak: "연속 정답", question: "{current} / {total}번", wordPrompt: "발음과 뜻을 보고 영어를 입력하세요", sentencePrompt: "발음과 뜻을 보고 영어 문장 전체를 입력하세요", listen: "발음 듣기", listenAgain: "다시 듣기", answer: "내 답", wordPlaceholder: "영어 철자를 입력하세요", sentencePlaceholder: "영어 문장 전체를 입력하세요", check: "확인", next: "다음", hint: "힌트", skip: "건너뛰기", correctFeedback: "철자가 맞습니다", wrongFeedback: "거의 맞았어요. 수정해서 다시 확인하세요.", skippedFeedback: "정답을 표시했습니다. 다음 문제로 계속하세요.", expected: "정답", shortcutWord: "Enter로 확인", shortcutSentence: "Ctrl + Enter로 확인", noQuestions: "이 범위에는 아직 철자 문제가 없습니다.", lesson: "수업", hintLabel: "철자 힌트", accuracy: "정답률"
    },
    ja: {
      nav: "スペル", title: "スペル練習", description: "音声を聞いて、単語・フレーズ・文全体を入力します。", word: "単語とフレーズ", sentence: "文", scope: "レッスン範囲", all: "全レッスン", shuffle: "問題を更新", progress: "練習の進捗", correct: "正解", attempted: "回答済み", streak: "連続正解", question: "{current} / {total}問", wordPrompt: "音声と意味から英語を書いてください", sentencePrompt: "音声と意味から英文全体を書いてください", listen: "音声を再生", listenAgain: "もう一度聞く", answer: "あなたの答え", wordPlaceholder: "英語のスペルを入力", sentencePlaceholder: "英文全体を入力", check: "答え合わせ", next: "次へ", hint: "ヒント", skip: "スキップ", correctFeedback: "正しいスペルです", wrongFeedback: "あと少しです。修正してもう一度試してください。", skippedFeedback: "正解を表示しました。次の問題へ進みましょう。", expected: "正解", shortcutWord: "Enterで確認", shortcutSentence: "Ctrl + Enterで確認", noQuestions: "この範囲にはスペル問題がまだありません。", lesson: "レッスン", hintLabel: "スペルのヒント", accuracy: "正解率"
    }
  };

  Object.assign(copy.zh, {
    wrongFeedback: "回答错误，正确答案如下。已加入错题库，稍后会再次出现。",
    skippedFeedback: "已显示正确答案，并加入错题库，稍后会再次出现。",
    mistakeBank: "错题库"
  });
  Object.assign(copy.en, {
    wrongFeedback: "Incorrect. The correct answer is below. Added to your review list and it will return later.",
    skippedFeedback: "The answer is shown and added to your review list. It will return later.",
    mistakeBank: "Review list"
  });
  Object.assign(copy.ko, {
    wrongFeedback: "틀렸습니다. 아래 정답을 확인하세요. 오답 목록에 추가되어 나중에 다시 나옵니다.",
    skippedFeedback: "정답을 표시하고 오답 목록에 추가했습니다. 나중에 다시 나옵니다.",
    mistakeBank: "오답 목록"
  });
  Object.assign(copy.ja, {
    wrongFeedback: "不正解です。下の正解を確認してください。復習リストに追加され、後でもう一度出題されます。",
    skippedFeedback: "正解を表示し、復習リストに追加しました。後でもう一度出題されます。",
    mistakeBank: "復習リスト"
  });

  const publicLessons = Array.isArray(window.ENGLISH_LESSONS) ? window.ENGLISH_LESSONS : [];
  const ownerLessons = window.CoursePrivacy?.ownerLessonsForActiveAccount?.() || [];
  const baseLessons = [...publicLessons, ...ownerLessons];
  const importedLessons = window.LessonImporter?.getLessons?.() || [];
  const sources = [...baseLessons, ...importedLessons].sort((left, right) => left.number - right.number);
  const lessons = window.LessonEditor?.apply?.(sources) || sources;

  let mode = "word";
  let lessonFilter = "all";
  let questions = [];
  let index = 0;
  let answered = false;
  let attemptedCurrent = false;
  let stats = { attempted: 0, correct: 0, streak: 0 };
  let mistakes = { word: new Set(), sentence: new Set() };

  function locale() {
    const current = window.SiteI18n?.current?.() || "zh";
    return copy[current] ? current : "zh";
  }

  function t(key, values) {
    const template = copy[locale()][key] || copy.zh[key] || key;
    return String(template).replace(/\{(\w+)\}/g, (_match, name) => String(values?.[name] ?? ""));
  }

  function $(selector) {
    return document.querySelector(selector);
  }

  function readPreferences() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
      mode = parsed.mode === "sentence" ? "sentence" : "word";
      lessonFilter = typeof parsed.lessonFilter === "string" ? parsed.lessonFilter : "all";
      mistakes = {
        word: new Set(Array.isArray(parsed.mistakes?.word) ? parsed.mistakes.word.filter((id) => typeof id === "string") : []),
        sentence: new Set(Array.isArray(parsed.mistakes?.sentence) ? parsed.mistakes.sentence.filter((id) => typeof id === "string") : [])
      };
    } catch (_error) {
      mode = "word";
      lessonFilter = "all";
      mistakes = { word: new Set(), sentence: new Set() };
    }
  }

  function savePreferences() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        mode,
        lessonFilter,
        mistakes: {
          word: [...mistakes.word],
          sentence: [...mistakes.sentence]
        }
      }));
      window.dispatchEvent(new CustomEvent("hexin:data-changed", { detail: { key: STORAGE_KEY } }));
    } catch (_error) {
      // 当前页面仍可正常练习。
    }
  }

  function splitSentences(value, chinese) {
    const englishParts = String(value || "").match(/[^.!?]+(?:[.!?]+|$)/g)?.map((part) => part.trim()).filter(Boolean) || [];
    const chineseParts = String(chinese || "").match(/[^。！？]+(?:[。！？]+|$)/g)?.map((part) => part.trim()).filter(Boolean) || [];
    if (englishParts.length <= 1) return [{ english: String(value || "").trim(), chinese: String(chinese || "").trim() }];
    if (englishParts.length !== chineseParts.length) return [];
    return englishParts.map((english, partIndex) => ({ english, chinese: chineseParts[partIndex] }));
  }

  function sentenceItems(lesson) {
    const result = [];
    (lesson.studyNotes || []).forEach((note) => {
      (note.examples || []).forEach((example) => result.push(example));
    });
    (lesson.sentences || []).forEach((sentence) => {
      const english = String(sentence.english || "").trim();
      if (english.length <= 220) result.push(sentence);
      else result.push(...splitSentences(english, sentence.chinese));
    });
    const seen = new Set();
    return result.filter((item) => {
      const english = String(item.english || "").trim();
      const key = normalizeAnswer(english);
      const wordCount = key.split(" ").filter(Boolean).length;
      const sentenceLike = /[.!?][\"']?$/.test(english) || wordCount >= 4;
      if (!key || seen.has(key) || wordCount < 2 || wordCount > 38 || !sentenceLike || english.length > 220 || english.includes("/")) return false;
      seen.add(key);
      return true;
    });
  }

  function collectQuestions() {
    const selectedLessons = lessonFilter === "all" ? lessons : lessons.filter((lesson) => lesson.id === lessonFilter);
    return selectedLessons.flatMap((lesson) => {
      const items = mode === "word" ? (lesson.words || []) : sentenceItems(lesson);
      return items.flatMap((item, itemIndex) => {
        const english = String(item.english || "").trim();
        if (!english) return [];
        return [{
          id: `${mode}:${lesson.id}:${item._id || itemIndex}`,
          english,
          chinese: String(item.chinese || "").trim(),
          ipa: String(item.ipa || "").trim(),
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          lessonNumber: lesson.number
        }];
      });
    });
  }

  function shuffle(items) {
    const next = [...items];
    for (let current = next.length - 1; current > 0; current -= 1) {
      const other = Math.floor(Math.random() * (current + 1));
      [next[current], next[other]] = [next[other], next[current]];
    }
    return next;
  }

  function buildReviewQueue(baseQuestions, mistakeIds) {
    const reviewQuestions = shuffle(baseQuestions.filter((question) => mistakeIds.has(question.id)))
      .map((question) => ({ ...question, mistakeReview: true }));
    return [...baseQuestions, ...reviewQuestions];
  }

  function withQueuedMistakeReview(items, currentIndex, question) {
    if (!question || items.slice(currentIndex + 1).some((item) => item.id === question.id)) return items;
    const next = [...items];
    const reviewAt = Math.min(currentIndex + 4, next.length);
    next.splice(reviewAt, 0, { ...question, mistakeReview: true });
    return next;
  }

  function normalizeAnswer(value) {
    return String(value || "")
      .normalize("NFKC")
      .toLocaleLowerCase("en")
      .replace(/[’‘]/g, "'")
      .replace(/[^\p{L}\p{N}'\s-]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function hintFor(value) {
    return String(value || "").replace(/[\p{L}\p{N}]+/gu, (word) => {
      if (word.length <= 1) return word;
      return `${word[0]}${"＿".repeat(Math.min(word.length - 1, 12))}`;
    });
  }

  function currentQuestion() {
    return questions[index] || null;
  }

  function currentMistakes() {
    return mistakes[mode];
  }

  function addMistake(question) {
    if (!question?.id) return;
    currentMistakes().add(question.id);
    savePreferences();
    renderStats();
  }

  function clearMistake(question) {
    if (!question?.id || !currentMistakes().delete(question.id)) return;
    questions = questions.filter((item, itemIndex) => itemIndex <= index || item.id !== question.id);
    savePreferences();
    renderStats();
  }

  function queueMistakeReview(question) {
    questions = withQueuedMistakeReview(questions, index, question);
  }

  function applyCopy() {
    $("#spelling-nav-label").textContent = t("nav");
    $("#spelling-title").textContent = t("title");
    $("#spelling-description").textContent = t("description");
    $("#spelling-scope-label").textContent = t("scope");
    $("#spelling-shuffle").lastElementChild.textContent = t("shuffle");
    $("#spelling-progress-title").textContent = t("progress");
    $("#spelling-correct-label").textContent = t("correct");
    $("#spelling-attempted-label").textContent = t("attempted");
    $("#spelling-streak-label").textContent = t("streak");
    $("#spelling-mistake-label").textContent = t("mistakeBank");
    $("#spelling-answer-label").textContent = t("answer");
    $("#spelling-hint").textContent = t("hint");
    $("#spelling-skip").textContent = t("skip");
    $("#spelling-check-label").textContent = answered ? t("next") : t("check");
    document.querySelectorAll("[data-spelling-mode]").forEach((button) => {
      button.textContent = t(button.dataset.spellingMode);
    });
    updateLessonOptions();
  }

  function updateLessonOptions() {
    const select = $("#spelling-lesson-filter");
    const currentValue = lessonFilter;
    select.replaceChildren();
    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = t("all");
    select.append(allOption);
    lessons.forEach((lesson) => {
      const option = document.createElement("option");
      option.value = lesson.id;
      option.textContent = lesson.title;
      select.append(option);
    });
    lessonFilter = [...select.options].some((option) => option.value === currentValue) ? currentValue : "all";
    select.value = lessonFilter;
  }

  function renderStats() {
    $("#spelling-correct-count").textContent = String(stats.correct);
    $("#spelling-attempted-count").textContent = String(stats.attempted);
    $("#spelling-streak-count").textContent = String(stats.streak);
    $("#spelling-mistake-count").textContent = String(currentMistakes().size);
    const accuracy = stats.attempted ? Math.round((stats.correct / stats.attempted) * 100) : 0;
    $("#spelling-accuracy").textContent = `${accuracy}%`;
    $("#spelling-accuracy-ring").style.setProperty("--spelling-progress", `${accuracy * 3.6}deg`);
    $("#spelling-accuracy-ring").setAttribute("aria-label", `${t("accuracy")} ${accuracy}%`);
  }

  function resetFeedback() {
    const feedback = $("#spelling-feedback");
    feedback.hidden = true;
    feedback.dataset.state = "";
    $("#spelling-feedback-title").textContent = "";
    $("#spelling-expected").textContent = "";
    $("#spelling-hint-text").hidden = true;
    $("#spelling-hint-text").textContent = "";
  }

  function setAnswerValue(value) {
    $("#spelling-word-input").value = value;
    $("#spelling-sentence-input").value = value;
  }

  function setAnswerLocked(locked) {
    $("#spelling-word-input").readOnly = Boolean(locked);
    $("#spelling-sentence-input").readOnly = Boolean(locked);
  }

  function answerValue() {
    return mode === "word" ? $("#spelling-word-input").value : $("#spelling-sentence-input").value;
  }

  function focusAnswer() {
    const target = mode === "word" ? $("#spelling-word-input") : $("#spelling-sentence-input");
    window.setTimeout(() => target.focus(), 60);
  }

  function renderQuestion() {
    const question = currentQuestion();
    const empty = !question;
    $("#spelling-empty").hidden = !empty;
    $("#spelling-practice-content").hidden = empty;
    if (empty) {
      $("#spelling-empty").textContent = t("noQuestions");
      $("#spelling-question-progress").textContent = t("question", { current: 0, total: 0 });
      return;
    }

    answered = false;
    attemptedCurrent = false;
    resetFeedback();
    setAnswerValue("");
    setAnswerLocked(false);
    $("#spelling-question-progress").textContent = t("question", { current: index + 1, total: questions.length });
    $("#spelling-question-type").textContent = t(mode === "word" ? "wordPrompt" : "sentencePrompt");
    $("#spelling-question-lesson").textContent = `${t("lesson")} ${question.lessonNumber} · ${question.lessonTitle}`;
    $("#spelling-translation").textContent = question.chinese || question.lessonTitle;
    $("#spelling-word-input").hidden = mode !== "word";
    $("#spelling-sentence-input").hidden = mode !== "sentence";
    $("#spelling-word-input").placeholder = t("wordPlaceholder");
    $("#spelling-sentence-input").placeholder = t("sentencePlaceholder");
    $("#spelling-shortcut").textContent = t(mode === "word" ? "shortcutWord" : "shortcutSentence");
    $("#spelling-listen-label").textContent = t("listen");
    $("#spelling-check-label").textContent = t("check");
  }

  function rebuildQuestions(resetSession) {
    const baseQuestions = shuffle(collectQuestions());
    questions = buildReviewQueue(baseQuestions, currentMistakes());
    index = 0;
    if (resetSession) stats = { attempted: 0, correct: 0, streak: 0 };
    document.querySelectorAll("[data-spelling-mode]").forEach((button) => {
      const selected = button.dataset.spellingMode === mode;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    savePreferences();
    renderStats();
    renderQuestion();
  }

  function speakQuestion() {
    const question = currentQuestion();
    if (!question) return;
    window.SpeechController?.speak?.(question.english);
    $("#spelling-listen-label").textContent = t("listenAgain");
  }

  function showHint() {
    const question = currentQuestion();
    if (!question) return;
    const hint = hintFor(question.english);
    const ipa = mode === "word" && question.ipa ? `  ${question.ipa}` : "";
    $("#spelling-hint-text").textContent = `${t("hintLabel")}：${hint}${ipa}`;
    $("#spelling-hint-text").hidden = false;
    speakQuestion();
  }

  function showFeedback(state, title, answer) {
    const feedback = $("#spelling-feedback");
    feedback.dataset.state = state;
    feedback.hidden = false;
    $("#spelling-feedback-title").textContent = title;
    $("#spelling-expected").textContent = answer ? `${t("expected")}：${answer}` : "";
  }

  function checkAnswer() {
    const question = currentQuestion();
    if (!question) return;
    if (answered) {
      nextQuestion();
      return;
    }
    const value = answerValue();
    if (!value.trim()) {
      focusAnswer();
      return;
    }
    const correct = normalizeAnswer(value) === normalizeAnswer(question.english);
    if (!attemptedCurrent) {
      attemptedCurrent = true;
      stats.attempted += 1;
      if (!correct) stats.streak = 0;
    }
    if (correct) {
      stats.correct += 1;
      stats.streak += 1;
      answered = true;
      setAnswerLocked(true);
      clearMistake(question);
      renderStats();
      showFeedback("correct", t("correctFeedback"), question.english);
      $("#spelling-check-label").textContent = t("next");
    } else {
      answered = true;
      setAnswerLocked(true);
      addMistake(question);
      queueMistakeReview(question);
      showFeedback("wrong", t("wrongFeedback"), question.english);
      $("#spelling-check-label").textContent = t("next");
    }
  }

  function skipQuestion() {
    const question = currentQuestion();
    if (!question || answered) {
      nextQuestion();
      return;
    }
    if (!attemptedCurrent) {
      attemptedCurrent = true;
      stats.attempted += 1;
      stats.streak = 0;
      renderStats();
    }
    answered = true;
    setAnswerValue(question.english);
    setAnswerLocked(true);
    addMistake(question);
    queueMistakeReview(question);
    showFeedback("skipped", t("skippedFeedback"), question.english);
    $("#spelling-check-label").textContent = t("next");
  }

  function nextQuestion() {
    if (!questions.length) return;
    index = (index + 1) % questions.length;
    if (index === 0) questions = shuffle(questions);
    renderQuestion();
    focusAnswer();
  }

  function setupEvents() {
    document.querySelectorAll("[data-spelling-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        mode = button.dataset.spellingMode;
        rebuildQuestions(true);
        focusAnswer();
      });
    });
    $("#spelling-lesson-filter").addEventListener("change", (event) => {
      lessonFilter = event.target.value;
      rebuildQuestions(true);
      focusAnswer();
    });
    $("#spelling-shuffle").addEventListener("click", () => {
      rebuildQuestions(true);
      focusAnswer();
    });
    $("#spelling-listen").addEventListener("click", speakQuestion);
    $("#spelling-hint").addEventListener("click", showHint);
    $("#spelling-skip").addEventListener("click", skipQuestion);
    $("#spelling-form").addEventListener("submit", (event) => {
      event.preventDefault();
      checkAnswer();
    });
    $("#spelling-word-input").addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.isComposing) {
        event.preventDefault();
        checkAnswer();
      }
    });
    $("#spelling-sentence-input").addEventListener("keydown", (event) => {
      if (event.key === "Enter" && event.ctrlKey && !event.isComposing) {
        event.preventDefault();
        checkAnswer();
      }
    });
  }

  function init() {
    if (!$("#spelling-view")) return;
    readPreferences();
    applyCopy();
    setupEvents();
    rebuildQuestions(true);
  }

  window.SpellingPracticeCore = Object.freeze({
    normalizeAnswer,
    buildReviewQueue,
    withQueuedMistakeReview
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
