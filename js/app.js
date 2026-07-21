(function () {
  "use strict";

  const baseLessons = Array.isArray(window.ENGLISH_LESSONS) ? window.ENGLISH_LESSONS : [];
  const importedLessons = window.LessonImporter?.getLessons?.() || [];
  const lessons = [...baseLessons, ...importedLessons].sort((left, right) => left.number - right.number);
  const views = ["home", "lessons", "search", "flashcards"];
  const allWords = lessons.flatMap((lesson) => {
    return lesson.words.map((word, index) => ({
      ...word,
      id: `${lesson.id}:${index}`,
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      lessonNumber: lesson.number
    }));
  });
  const vocabularyByEnglish = new Map();
  allWords.forEach((word) => {
    const normalized = word.english.trim().toLocaleLowerCase("en");
    if (/^[\p{L}]+(?:['’][\p{L}]+)?$/u.test(normalized) && !vocabularyByEnglish.has(normalized)) {
      vocabularyByEnglish.set(normalized.replaceAll("’", "'"), word);
    }
  });

  let appState = window.LearningStorage.getState();
  let deck = [...allWords];
  let deckIndex = 0;
  let cardFlipped = false;
  let activePopoverWord = null;
  let activeWordTrigger = null;
  let onlineSearchTimer = null;
  let onlineSearchController = null;
  let onlineSearchSequence = 0;

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $$(selector, root) {
    return [...(root || document).querySelectorAll(selector)];
  }

  function escapeHTML(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeWord(value) {
    return String(value || "").trim().toLocaleLowerCase("en").replaceAll("’", "'");
  }

  function getWordDetails(value) {
    const normalized = normalizeWord(value);
    const vocabularyWord = vocabularyByEnglish.get(normalized);
    const pronunciation = window.WORD_PRONUNCIATIONS?.[normalized];

    return {
      word: String(value || "").trim(),
      ipa: vocabularyWord?.ipa || pronunciation?.ipa || "/音标暂未收录/",
      meaning: vocabularyWord?.chinese || "此词未单独列入本课词表，可先结合句子理解。",
      isVocabulary: Boolean(vocabularyWord)
    };
  }

  function sentenceWordMarkup(text, lessonId) {
    return String(text).split(/([\p{L}]+(?:['’][\p{L}]+)?)/gu).map((part) => {
      if (!/^[\p{L}]+(?:['’][\p{L}]+)?$/u.test(part)) return escapeHTML(part);
      const details = getWordDetails(part);
      return `<button class="sentence-token" type="button" data-word="${escapeHTML(part)}" data-lesson-id="${lessonId}" aria-label="查看 ${escapeHTML(part)} 的音标">${escapeHTML(part)}</button>`;
    }).join("");
  }

  function getLesson(lessonId) {
    return lessons.find((lesson) => lesson.id === lessonId);
  }

  function getCurrentWord() {
    return deck[deckIndex] || null;
  }

  function isFavorite(wordId) {
    return appState.favorites.includes(wordId);
  }

  function getStudyExampleCount(lesson) {
    return (lesson.studyNotes || []).reduce((total, note) => {
      return total + (Array.isArray(note.examples) ? note.examples.length : 0);
    }, 0);
  }

  function getLessonSentenceCount(lesson) {
    return lesson.sentences.length + getStudyExampleCount(lesson);
  }

  function renderStats() {
    const validWordIds = new Set(allWords.map((word) => word.id));
    const stats = [
      { value: lessons.length, label: "课程总数" },
      { value: allWords.length, label: "单词与短语" },
      { value: appState.mastered.filter((id) => validWordIds.has(id)).length, label: "已掌握" },
      { value: appState.favorites.filter((id) => validWordIds.has(id)).length, label: "收藏数量" }
    ];

    $("#stats-grid").innerHTML = stats.map((item) => `
      <article class="stat-card">
        <strong class="stat-value">${item.value}</strong>
        <span class="stat-label">${item.label}</span>
      </article>
    `).join("");
  }

  function renderRecentLessons() {
    const recentLessons = appState.recentLessons.map(getLesson).filter(Boolean);
    const container = $("#recent-lessons");

    if (!recentLessons.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div>
            <strong>还没有学习记录</strong>
            <p>展开一课或点击英文后，这里会显示最近学习内容。</p>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = recentLessons.map((lesson) => `
      <article class="recent-card">
        <div>
          <span class="lesson-number">LESSON ${lesson.number}</span>
          <h3>${escapeHTML(lesson.title)}</h3>
          <p>${lesson.words.length} 个词条 · ${getLessonSentenceCount(lesson)} 条学习句子</p>
        </div>
        <button class="button button-secondary" type="button" data-open-lesson="${lesson.id}">继续</button>
      </article>
    `).join("");
  }

  function lessonMarkup(lesson) {
    const words = lesson.words.map((word) => `
      <button class="word-card" type="button" data-speak="${escapeHTML(word.english)}" data-lesson-id="${lesson.id}">
        <span class="word">${escapeHTML(word.english)}</span>
        <span class="ipa">${escapeHTML(word.ipa)}</span>
        <span class="translation">${escapeHTML(word.chinese)}</span>
        <span class="speak-hint">点击朗读</span>
      </button>
    `).join("");

    const sentenceButton = (sentence, extraClass) => `
      <article class="sentence-card ${extraClass || ""}" data-lesson-id="${lesson.id}">
        <p class="sentence-english" lang="en">${sentenceWordMarkup(sentence.english, lesson.id)}</p>
        ${sentence.ipa ? `<p class="sentence-ipa">${escapeHTML(sentence.ipa)}</p>` : ""}
        <p class="translation">${escapeHTML(sentence.chinese)}</p>
        <button class="sentence-speak" type="button" data-speak="${escapeHTML(sentence.english)}" data-lesson-id="${lesson.id}">朗读整句</button>
      </article>
    `;

    const studyNotes = (lesson.studyNotes || []).map((note) => {
      const structures = (note.structures || []).length
        ? `<ul class="structure-list translation">${note.structures.map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul>`
        : "";
      const examples = (note.examples || []).map((example) => sentenceButton(example, "note-example")).join("");

      return `
        <section class="study-note">
          <div class="study-note-heading">
            <span class="note-index">GRAMMAR</span>
            <h4>${escapeHTML(note.title)}</h4>
            <p class="translation">${escapeHTML(note.description)}</p>
          </div>
          ${structures}
          <div class="sentence-list note-examples">${examples}</div>
        </section>
      `;
    }).join("");

    const sentences = lesson.sentences.map((sentence) => sentenceButton(sentence, "")).join("");
    const notesSection = studyNotes ? `
      <div class="content-heading">
        <h3>语法与例句</h3>
        <span>点击单词查音标，或朗读整句</span>
      </div>
      <div class="study-notes">${studyNotes}</div>
    ` : "";
    const importedMeta = lesson.imported ? `
      <div class="imported-lesson-meta">
        <div>
          <span class="local-badge">本地导入</span>
          <p>来源：${escapeHTML(lesson.sourceName || "本地文件")} · 原文件未保存</p>
        </div>
        <button class="button button-quiet imported-delete" type="button" data-delete-imported-lesson="${escapeHTML(lesson.id)}">删除这节导入课程</button>
      </div>
    ` : "";

    return `
      <details class="lesson-panel" id="${lesson.id}" data-lesson-panel="${lesson.id}">
        <summary>
          <span class="lesson-summary-copy">
            <span class="lesson-index">${lesson.number}</span>
            <span>
              <h2>${escapeHTML(lesson.title)}</h2>
              <p>${lesson.words.length} 个词条 · ${getLessonSentenceCount(lesson)} 条学习句子</p>
            </span>
          </span>
          <span class="summary-action"><span>展开学习</span></span>
        </summary>
        <div class="lesson-content">
          ${importedMeta}
          <div class="content-heading">
            <h3>${escapeHTML(lesson.wordSectionTitle)}</h3>
            <span>点击卡片朗读</span>
          </div>
          <div class="word-grid">${words}</div>
          ${notesSection}
          <div class="content-heading">
            <h3>${escapeHTML(lesson.readingTitle)}</h3>
            <span>点击单词查音标，或朗读整句</span>
          </div>
          <div class="sentence-list">${sentences}</div>
        </div>
      </details>
    `;
  }

  function renderLessons() {
    const lessonList = $("#lesson-list");
    lessonList.innerHTML = lessons.map(lessonMarkup).join("");

    $$('[data-lesson-panel]', lessonList).forEach((panel) => {
      panel.addEventListener("toggle", () => {
        if (!panel.open) return;
        appState = window.LearningStorage.recordLesson(panel.dataset.lessonPanel);
        renderRecentLessons();
      });
    });

    applyTranslationSetting();
  }

  function applyTranslationSetting() {
    const hideChinese = Boolean(appState.settings.hideChinese);
    $("#hide-chinese").checked = hideChinese;
    $('[data-view="lessons"]').classList.toggle("hide-translations", hideChinese);
  }

  function partOfSpeechLabel(value) {
    const labels = {
      noun: "名词",
      verb: "动词",
      adjective: "形容词",
      adverb: "副词",
      pronoun: "代词",
      preposition: "介词",
      conjunction: "连词",
      interjection: "感叹词",
      exclamation: "感叹词",
      determiner: "限定词",
      numeral: "数词"
    };
    return labels[value] || "释义";
  }

  function renderOnlineDictionaryResult(result) {
    const phonetics = result.phonetics.length
      ? result.phonetics.map((phonetic) => `<span>${escapeHTML(phonetic)}</span>`).join("")
      : '<span class="dictionary-muted">暂未返回音标</span>';
    const translation = result.translation
      ? `<p class="dictionary-translation"><span>中文直译</span><strong>${escapeHTML(result.translation)}</strong></p>`
      : '<p class="dictionary-translation dictionary-muted">在线翻译暂未返回中文结果</p>';
    const meanings = result.meanings.length
      ? result.meanings.map((meaning) => `
          <section class="dictionary-meaning">
            <h3><span>${escapeHTML(partOfSpeechLabel(meaning.partOfSpeech))}</span>${escapeHTML(meaning.partOfSpeech)}</h3>
            <ol>
              ${meaning.definitions.map((definition) => `
                <li>
                  <p>${escapeHTML(definition.definition)}</p>
                  ${definition.example ? `<blockquote>${escapeHTML(definition.example)}</blockquote>` : ""}
                </li>
              `).join("")}
            </ol>
          </section>
        `).join("")
      : '<p class="dictionary-muted dictionary-no-definition">暂未返回英文词典释义，但仍可查看中文直译和朗读。</p>';

    $("#online-dictionary-content").innerHTML = `
      <article class="dictionary-entry">
        <div class="dictionary-word-row">
          <div>
            <h2 lang="en">${escapeHTML(result.word)}</h2>
            <div class="dictionary-phonetics">${phonetics}</div>
          </div>
          <div class="dictionary-speech-actions" aria-label="选择在线单词发音">
            <button type="button" data-speak="${escapeHTML(result.word)}" data-speech-accent="en-US">美式朗读</button>
            <button type="button" data-speak="${escapeHTML(result.word)}" data-speech-accent="en-GB">英式朗读</button>
          </div>
        </div>
        ${translation}
        <div class="dictionary-meanings">${meanings}</div>
        <p class="dictionary-source">英文释义来自 Free Dictionary API · 中文直译来自 MyMemory</p>
      </article>
    `;
  }

  function scheduleOnlineDictionary(query) {
    window.clearTimeout(onlineSearchTimer);
    onlineSearchController?.abort();
    onlineSearchController = null;
    const sequence = ++onlineSearchSequence;

    if (!window.OnlineDictionary?.isSupportedQuery(query)) {
      $("#online-dictionary").hidden = true;
      $("#online-dictionary-content").replaceChildren();
      $("#online-dictionary-status").textContent = "";
      return;
    }

    $("#online-dictionary").hidden = false;
    $("#online-dictionary-status").textContent = "等待查询";
    $("#online-dictionary-content").innerHTML = `
      <div class="dictionary-loading" role="status">
        <span aria-hidden="true"></span>
        <p>停止输入后，将在线查询“${escapeHTML(query)}”</p>
      </div>
    `;

    onlineSearchTimer = window.setTimeout(async () => {
      onlineSearchController = new AbortController();
      $("#online-dictionary-status").textContent = "正在联网查询";
      $("#online-dictionary-content").innerHTML = `
        <div class="dictionary-loading" role="status">
          <span aria-hidden="true"></span>
          <p>正在查找音标、翻译和释义…</p>
        </div>
      `;

      try {
        const result = await window.OnlineDictionary.lookup(query, { signal: onlineSearchController.signal });
        if (sequence !== onlineSearchSequence) return;
        $("#online-dictionary-status").textContent = result.fromCache ? "浏览器缓存" : "在线结果";
        renderOnlineDictionaryResult(result);
      } catch (error) {
        if (error.name === "AbortError" || sequence !== onlineSearchSequence) return;
        const notFound = error.code === "NOT_FOUND";
        $("#online-dictionary-status").textContent = notFound ? "没有收录" : "连接失败";
        $("#online-dictionary-content").innerHTML = `
          <div class="dictionary-error">
            <strong>${notFound ? "在线词典也没有找到这个词" : "暂时无法连接在线词典"}</strong>
            <p>${notFound ? "请检查拼写，或尝试单词的原形。" : "请检查网络后重新输入；课程词库搜索仍可正常使用。"}</p>
          </div>
        `;
      }
    }, 500);
  }

  function renderSearch(query) {
    const normalizedQuery = String(query || "").trim().toLocaleLowerCase("zh-CN");
    const resultsContainer = $("#search-results");
    const meta = $("#search-meta");
    $("#clear-search").hidden = !normalizedQuery;
    scheduleOnlineDictionary(normalizedQuery);

    if (!normalizedQuery) {
      meta.textContent = "输入英文或中文开始搜索";
      resultsContainer.innerHTML = `
        <div class="empty-state">
          <div>
            <strong>查找想学的单词</strong>
            <p>可搜索课程内的中英文，也可以输入任意英文单词进行在线查询。</p>
          </div>
        </div>
      `;
      return;
    }

    const matches = allWords.filter((word) => {
      return word.english.toLocaleLowerCase("en").includes(normalizedQuery)
        || word.chinese.toLocaleLowerCase("zh-CN").includes(normalizedQuery);
    });

    meta.textContent = matches.length ? `课程词库找到 ${matches.length} 个结果` : "课程词库中没有找到匹配项";

    if (!matches.length) {
      resultsContainer.innerHTML = `
        <div class="empty-state">
          <div>
            <strong>课程词库中没有这个词</strong>
            <p>${window.OnlineDictionary?.isSupportedQuery(normalizedQuery) ? "正在继续查询下方在线词典。" : "可尝试完整英文单词，或更短的中文关键词。"}</p>
          </div>
        </div>
      `;
      return;
    }

    resultsContainer.innerHTML = matches.map((word) => `
      <article class="search-result">
        <button class="search-result-main" type="button" data-speak="${escapeHTML(word.english)}" data-lesson-id="${word.lessonId}">
          <span class="search-word-block">
            <span class="search-english">${escapeHTML(word.english)}</span>
            <span class="ipa">${escapeHTML(word.ipa)}</span>
          </span>
          <span class="translation">${escapeHTML(word.chinese)}</span>
          <span class="result-lesson">${escapeHTML(word.lessonTitle)}</span>
        </button>
        <button class="favorite-result" type="button" data-result-favorite="${word.id}" aria-pressed="${isFavorite(word.id)}">
          ${isFavorite(word.id) ? "已收藏" : "收藏"}
        </button>
      </article>
    `).join("");
  }

  function setCardFlipped(flipped) {
    cardFlipped = flipped;
    const card = $("#flashcard");
    card.classList.toggle("is-flipped", flipped);
    card.setAttribute("aria-pressed", String(flipped));
    card.setAttribute("aria-label", flipped ? "当前显示中文，点击返回英文" : "当前显示英文，点击查看中文");
    $(".flashcard-front", card).setAttribute("aria-hidden", String(flipped));
    $(".flashcard-back", card).setAttribute("aria-hidden", String(!flipped));
  }

  function updateCardStatus() {
    const word = getCurrentWord();
    const masteredButton = $('[data-card-status="mastered"]');
    const reviewButton = $('[data-card-status="review"]');
    const favoriteButton = $("[data-card-favorite]");
    const mastered = Boolean(word && appState.mastered.includes(word.id));
    const review = Boolean(word && appState.review.includes(word.id));
    const favorite = Boolean(word && appState.favorites.includes(word.id));

    masteredButton.setAttribute("aria-pressed", String(mastered));
    reviewButton.setAttribute("aria-pressed", String(review));
    favoriteButton.setAttribute("aria-pressed", String(favorite));
    favoriteButton.textContent = favorite ? "已收藏" : "收藏";
  }

  function renderFlashcard() {
    const word = getCurrentWord();
    if (!word) {
      $("#deck-progress").textContent = "暂无卡片";
      $("#card-context").textContent = "";
      $("#card-english").textContent = "暂无内容";
      $("#card-ipa").textContent = "";
      $("#card-chinese").textContent = "—";
      return;
    }

    $("#deck-progress").textContent = `${deckIndex + 1} / ${deck.length}`;
    $("#card-context").textContent = `${word.lessonTitle} · WORD CARD`;
    $("#card-english").textContent = word.english;
    $("#card-ipa").textContent = word.ipa;
    $("#card-chinese").textContent = word.chinese;
    setCardFlipped(false);
    updateCardStatus();
  }

  function resetDeck(shouldShuffle) {
    const filter = $("#deck-filter").value;
    deck = filter === "all" ? [...allWords] : allWords.filter((word) => word.lessonId === filter);

    if (shouldShuffle) {
      for (let index = deck.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [deck[index], deck[randomIndex]] = [deck[randomIndex], deck[index]];
      }
    }

    deckIndex = 0;
    renderFlashcard();
  }

  function renderDynamicControls() {
    $("#search-label").textContent = `搜索 ${allWords.length} 个课程词条，或查询任意英文单词`;
    $("#deck-filter").innerHTML = [
      '<option value="all">全部课程</option>',
      ...lessons.map((lesson) => `<option value="${lesson.id}">${escapeHTML(lesson.title)}</option>`)
    ].join("");
  }

  function changeCard(offset) {
    if (!deck.length) return;
    deckIndex = (deckIndex + offset + deck.length) % deck.length;
    renderFlashcard();
  }

  function applyTheme(theme) {
    const nextTheme = theme === "dark" ? "dark" : "light";
    const isDark = nextTheme === "dark";
    document.documentElement.dataset.theme = nextTheme;
    $("#theme-label").textContent = isDark ? "夜间" : "白天";
    $("#theme-toggle").setAttribute("aria-label", isDark ? "切换到白天模式" : "切换到夜间模式");
    $("#theme-toggle").title = isDark ? "切换到白天模式" : "切换到夜间模式";
  }

  function showView(viewName) {
    const activeView = views.includes(viewName) ? viewName : "home";
    $$('[data-view]').forEach((section) => {
      section.hidden = section.dataset.view !== activeView;
    });
    $$('[data-nav]').forEach((link) => {
      if (link.dataset.nav === activeView) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function openLesson(lessonId) {
    const panel = document.getElementById(lessonId);
    if (!panel) return;
    panel.open = true;
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function recordLessonActivity(lessonId) {
    if (!lessonId) return;
    appState = window.LearningStorage.recordLesson(lessonId);
    renderRecentLessons();
  }

  function setupNavigation() {
    const routeFromHash = () => showView(window.location.hash.slice(1) || "home");
    window.addEventListener("hashchange", routeFromHash);
    routeFromHash();

    $("#recent-lessons").addEventListener("click", (event) => {
      const button = event.target.closest("[data-open-lesson]");
      if (!button) return;
      window.location.hash = "lessons";
      window.requestAnimationFrame(() => openLesson(button.dataset.openLesson));
    });
  }

  function setupTheme() {
    const currentAppearance = appState.settings.appearanceVersion === 4;
    const initialTheme = currentAppearance ? (appState.settings.theme || "light") : "light";
    if (!currentAppearance) {
      appState = window.LearningStorage.updateSettings({ theme: "light", hideChinese: false, appearanceVersion: 4 });
      applyTranslationSetting();
    }
    applyTheme(initialTheme);

    $("#theme-toggle").addEventListener("click", () => {
      const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      appState = window.LearningStorage.updateSettings({ theme: nextTheme });
      applyTheme(nextTheme);
    });
  }

  function setupLessonControls() {
    $("#hide-chinese").addEventListener("change", (event) => {
      appState = window.LearningStorage.updateSettings({ hideChinese: event.target.checked });
      applyTranslationSetting();
    });

    $("#expand-lessons").addEventListener("click", () => {
      $$('[data-lesson-panel]').forEach((panel) => { panel.open = true; });
    });

    $("#collapse-lessons").addEventListener("click", () => {
      $$('[data-lesson-panel]').forEach((panel) => { panel.open = false; });
    });

    $("#lesson-list").addEventListener("click", (event) => {
      const button = event.target.closest("[data-delete-imported-lesson]");
      if (!button) return;
      const lesson = getLesson(button.dataset.deleteImportedLesson);
      if (!lesson?.imported) return;
      if (button.dataset.confirmDelete !== "true") {
        button.dataset.confirmDelete = "true";
        button.textContent = "再次点击确认删除";
        window.setTimeout(() => {
          if (!button.isConnected) return;
          button.dataset.confirmDelete = "false";
          button.textContent = "删除这节导入课程";
        }, 15000);
        return;
      }
      if (window.LessonImporter?.deleteLesson(lesson.id)) window.location.reload();
    });
  }

  function setupLessonImporter() {
    window.LessonImporter?.init({
      onSaved(lesson) {
        try {
          window.sessionStorage.setItem("hexin-open-imported-lesson", lesson.id);
        } catch (_error) {
          // 无痕模式禁用会话存储时，刷新后仍可在课程列表末尾找到新课程。
        }
        window.location.hash = "lessons";
        window.location.reload();
      }
    });
  }

  function openNewlyImportedLesson() {
    let lessonId = "";
    try {
      lessonId = window.sessionStorage.getItem("hexin-open-imported-lesson") || "";
      if (lessonId) window.sessionStorage.removeItem("hexin-open-imported-lesson");
    } catch (_error) {
      return;
    }
    if (!lessonId) return;
    window.requestAnimationFrame(() => openLesson(lessonId));
  }

  function setupSearch() {
    const searchInput = $("#search-input");
    searchInput.addEventListener("input", () => renderSearch(searchInput.value));

    $("#clear-search").addEventListener("click", () => {
      searchInput.value = "";
      renderSearch("");
      searchInput.focus();
    });

    $("#search-results").addEventListener("click", (event) => {
      const button = event.target.closest("[data-result-favorite]");
      if (!button) return;
      appState = window.LearningStorage.toggleFavorite(button.dataset.resultFavorite);
      renderStats();
      renderSearch(searchInput.value);
      updateCardStatus();
    });
  }

  function setupFlashcards() {
    $("#flashcard").addEventListener("click", () => setCardFlipped(!cardFlipped));
    $("#previous-card").addEventListener("click", () => changeCard(-1));
    $("#next-card").addEventListener("click", () => changeCard(1));
    $("#deck-filter").addEventListener("change", () => resetDeck(false));
    $("#shuffle-deck").addEventListener("click", () => resetDeck(true));

    $("#speak-card").addEventListener("click", () => {
      const word = getCurrentWord();
      if (word) {
        window.SpeechController.speak(word.english);
        recordLessonActivity(word.lessonId);
      }
    });

    $$('[data-card-status]').forEach((button) => {
      button.addEventListener("click", () => {
        const word = getCurrentWord();
        if (!word) return;
        appState = window.LearningStorage.setWordStatus(word.id, button.dataset.cardStatus);
        renderStats();
        updateCardStatus();
        recordLessonActivity(word.lessonId);
      });
    });

    $("[data-card-favorite]").addEventListener("click", () => {
      const word = getCurrentWord();
      if (!word) return;
      appState = window.LearningStorage.toggleFavorite(word.id);
      renderStats();
      updateCardStatus();
      renderSearch($("#search-input").value);
      recordLessonActivity(word.lessonId);
    });
  }

  function setupSpeech() {
    window.SpeechController.init({
      voiceSelect: $("#voice-select"),
      voiceLabel: $("#voice-label"),
      reloadButton: $("#reload-voices"),
      accentInputs: $$('[name="speech-accent"]'),
      rateInput: $("#rate-input"),
      rateOutput: $("#rate-output"),
      status: $("#speech-status"),
      stopButton: $("#stop-speech")
    });

    document.addEventListener("click", (event) => {
      const speakTarget = event.target.closest("[data-speak]");
      if (!speakTarget) return;
      window.SpeechController.speak(speakTarget.dataset.speak, speakTarget.dataset.speechAccent);
      recordLessonActivity(speakTarget.dataset.lessonId);
    });
  }

  function positionWordPopover(trigger) {
    const popover = $("#word-popover");
    popover.style.removeProperty("top");
    popover.style.removeProperty("left");
    popover.style.removeProperty("bottom");
    if (window.innerWidth <= 700) return;

    const triggerRect = trigger.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const gap = 10;
    const left = Math.min(
      window.innerWidth - popoverRect.width - 16,
      Math.max(16, triggerRect.left + (triggerRect.width - popoverRect.width) / 2)
    );
    const preferredTop = triggerRect.bottom + gap;
    const top = preferredTop + popoverRect.height <= window.innerHeight - 16
      ? preferredTop
      : Math.max(16, triggerRect.top - popoverRect.height - gap);

    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
  }

  function closeWordPopover(restoreFocus) {
    const popover = $("#word-popover");
    if (popover.hidden) return;
    popover.hidden = true;
    $("#popover-scrim").hidden = true;
    activePopoverWord = null;
    if (restoreFocus && activeWordTrigger) activeWordTrigger.focus();
    activeWordTrigger = null;
  }

  function openWordPopover(trigger) {
    const details = getWordDetails(trigger.dataset.word);
    const sentenceCard = trigger.closest(".sentence-card");
    const sentenceTranslation = sentenceCard?.querySelector(".translation")?.textContent.trim();
    activeWordTrigger = trigger;
    activePopoverWord = {
      ...details,
      meaning: !details.isVocabulary && sentenceTranslation
        ? `句子翻译：${sentenceTranslation}`
        : details.meaning,
      lessonId: trigger.dataset.lessonId
    };

    $("#word-popover-title").textContent = activePopoverWord.word;
    $("#word-popover-ipa").textContent = activePopoverWord.ipa;
    $("#word-popover-meaning").textContent = activePopoverWord.meaning;
    $("#word-popover").hidden = false;
    $("#popover-scrim").hidden = false;
    positionWordPopover(trigger);
    recordLessonActivity(activePopoverWord.lessonId);
  }

  function setupWordPopover() {
    $("#lesson-list").addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-word]");
      if (!trigger) return;
      openWordPopover(trigger);
    });

    $("#word-popover-close").addEventListener("click", () => closeWordPopover(true));
    $("#popover-scrim").addEventListener("click", () => closeWordPopover(false));
    $("#word-speak-us").addEventListener("click", () => {
      if (activePopoverWord) window.SpeechController.speak(activePopoverWord.word, "en-US");
    });
    $("#word-speak-uk").addEventListener("click", () => {
      if (activePopoverWord) window.SpeechController.speak(activePopoverWord.word, "en-GB");
    });

    window.addEventListener("resize", () => {
      if (activeWordTrigger && !$("#word-popover").hidden) positionWordPopover(activeWordTrigger);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeWordPopover(true);
    });
  }

  function init() {
    renderDynamicControls();
    renderStats();
    renderRecentLessons();
    renderLessons();
    renderSearch("");
    renderFlashcard();
    setupNavigation();
    setupTheme();
    setupLessonControls();
    setupLessonImporter();
    setupSearch();
    setupFlashcards();
    setupSpeech();
    setupWordPopover();
    openNewlyImportedLesson();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
