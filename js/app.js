(function () {
  "use strict";

  const publicLessons = Array.isArray(window.ENGLISH_LESSONS) ? window.ENGLISH_LESSONS : [];
  const ownerLessons = window.CoursePrivacy?.ownerLessonsForActiveAccount?.() || [];
  const baseLessons = [...publicLessons, ...ownerLessons];
  const importedLessons = window.LessonImporter?.getLessons?.() || [];
  const baseLessonIds = new Set(baseLessons.map((lesson) => String(lesson.id)));
  const lessonSources = [
    ...baseLessons,
    ...importedLessons.filter((lesson) => !baseLessonIds.has(String(lesson.id)))
  ].sort((left, right) => left.number - right.number);
  const lessons = window.LessonEditor?.apply?.(lessonSources) || lessonSources;
  const views = ["home", "lessons", "search", "favorites", "flashcards", "spelling", "admin"];
  const allWords = lessons.flatMap((lesson) => {
    return lesson.words.map((word, index) => ({
      ...word,
      id: `${lesson.id}:${word._id || index}`,
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      lessonNumber: lesson.number
    }));
  });
  const wordById = new Map(allWords.map((word) => [word.id, word]));
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
  let wordPopoverController = null;
  let wordPopoverSequence = 0;
  let flashcardDictionaryController = null;
  let flashcardDictionarySequence = 0;
  let onlineSearchTimer = null;
  let onlineSearchController = null;
  let onlineSearchSequence = 0;
  let wordImageController = null;
  let wordImageSequence = 0;
  let wordImagePrefetchTimer = null;
  let activeLessonMenuTrigger = null;

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $$(selector, root) {
    return [...(root || document).querySelectorAll(selector)];
  }

  function t(key, variables) {
    return window.SiteI18n?.t?.(key, variables) || key;
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

  function isSignedInAdmin() {
    const auth = window.CloudAuth?.getState?.();
    return Boolean(auth?.signedIn && auth.role === "admin");
  }

  function canManageLesson(lesson) {
    if (window.CoursePrivacy?.isOwnerLesson?.(lesson)) {
      return window.CoursePrivacy.isOwnerAccount();
    }
    return Boolean(lesson) && (lesson._public !== true || isSignedInAdmin());
  }

  function getCurrentWord() {
    return deck[deckIndex] || null;
  }

  function isFavorite(wordId) {
    return appState.favorites.includes(wordId);
  }

  function favoriteStarMarkup(word) {
    const favorite = isFavorite(word.id);
    const action = favorite ? t("favorites.remove") : t("favorites.add");
    return `
      <button class="favorite-star" type="button" data-word-favorite="${escapeHTML(word.id)}" data-lesson-id="${escapeHTML(word.lessonId)}" aria-pressed="${favorite}" aria-label="${action} ${escapeHTML(word.english)}" title="${action}">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m12 3.5 2.63 5.33 5.88.85-4.25 4.14 1 5.85L12 16.9l-5.26 2.77 1-5.85L3.5 9.68l5.87-.85L12 3.5Z"></path>
        </svg>
      </button>
    `;
  }

  function speakerButtonMarkup(content, lessonId, extraClass) {
    const label = t("speech.play", { text: content });
    return `
      <button class="speech-icon-button ${extraClass || ""}" type="button" data-speak="${escapeHTML(content)}" data-lesson-id="${escapeHTML(lessonId)}" aria-label="${escapeHTML(label)}" title="${escapeHTML(label)}">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path class="speaker-body" d="M4.5 9.2h3.1l4-3.25v12.1l-4-3.25H4.5z"></path>
          <path class="speaker-wave speaker-wave-one" d="M14.4 9.1c.8.75 1.2 1.72 1.2 2.9s-.4 2.15-1.2 2.9"></path>
          <path class="speaker-wave speaker-wave-two" d="M17.2 6.8c1.45 1.35 2.18 3.08 2.18 5.2s-.73 3.85-2.18 5.2"></path>
        </svg>
      </button>
    `;
  }

  function wordCardMarkup(word, showLesson, editContext) {
    return `
      <article class="word-card">
        <div class="word-card-main">
          <div class="word-card-heading">
            ${speakerButtonMarkup(word.english, word.lessonId, "word-speaker")}
            <span class="word" lang="en">${escapeHTML(word.english)}</span>
          </div>
          <span class="ipa">${escapeHTML(word.ipa)}</span>
          <span class="translation">${escapeHTML(word.chinese)}</span>
          ${showLesson ? `<span class="word-card-lesson">${escapeHTML(word.lessonTitle)}</span>` : ""}
        </div>
        ${favoriteStarMarkup(word)}
        ${editContext ? `<button class="remove-content-button word-remove" type="button" data-remove-word="${escapeHTML(editContext.wordId)}" data-lesson-id="${escapeHTML(editContext.lessonId)}">${t("edit.delete")}</button>` : ""}
      </article>
    `;
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
      { value: lessons.length, label: t("stats.courses") },
      { value: allWords.length, label: t("stats.words") },
      { value: appState.mastered.filter((id) => validWordIds.has(id)).length, label: t("stats.mastered") },
      { value: appState.favorites.filter((id) => validWordIds.has(id)).length, label: t("stats.favorites") }
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
            <strong>${t("recent.emptyTitle")}</strong>
            <p>${t("recent.emptyText")}</p>
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
          <p>${t("lessons.wordCount", { words: lesson.words.length, sentences: getLessonSentenceCount(lesson) })}</p>
        </div>
        <button class="button button-secondary" type="button" data-open-lesson="${lesson.id}">${t("recent.continue")}</button>
      </article>
    `).join("");
  }

  function lessonMarkup(lesson) {
    const editable = canManageLesson(lesson);
    const words = lesson.words.map((word, index) => wordCardMarkup({
      ...word,
      id: `${lesson.id}:${word._id || index}`,
      lessonId: lesson.id,
      lessonTitle: lesson.title
    }, false, editable ? { lessonId: lesson.id, wordId: word._id || String(index) } : null)).join("");

    const sentenceButton = (sentence, extraClass, type, noteId) => `
      <article class="sentence-card ${extraClass || ""}" data-lesson-id="${lesson.id}">
        <div class="sentence-heading">
          ${speakerButtonMarkup(sentence.english, lesson.id, "sentence-speaker")}
          <p class="sentence-english" lang="en">${sentenceWordMarkup(sentence.english, lesson.id)}</p>
        </div>
        ${sentence.ipa ? `<p class="sentence-ipa">${escapeHTML(sentence.ipa)}</p>` : ""}
        <p class="translation">${escapeHTML(sentence.chinese)}</p>
        ${editable ? `<button class="remove-content-button sentence-remove" type="button" data-remove-${type}="${escapeHTML(sentence._id)}" data-lesson-id="${escapeHTML(lesson.id)}" ${noteId ? `data-note-id="${escapeHTML(noteId)}"` : ""}>${t("edit.delete")}</button>` : ""}
      </article>
    `;

    const studyNotes = (lesson.studyNotes || []).map((note) => {
      const structures = (note.structures || []).length
        ? `<ul class="structure-list translation">${note.structures.map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul>`
        : "";
      const examples = (note.examples || []).map((example) => sentenceButton(example, "note-example", "example", note._id)).join("");

      return `
        <section class="study-note" data-note-id="${escapeHTML(note._id)}">
          <div class="study-note-heading">
            <div>
              <span class="note-index">GRAMMAR</span>
              <h4>${escapeHTML(note.title)}</h4>
              <p class="translation">${escapeHTML(note.description)}</p>
            </div>
            ${editable ? `<div class="note-actions">
              <button class="mini-action" type="button" data-add-example="${escapeHTML(note._id)}" data-lesson-id="${escapeHTML(lesson.id)}">${t("edit.addExample")}</button>
              <button class="mini-action mini-action-danger" type="button" data-remove-note="${escapeHTML(note._id)}" data-lesson-id="${escapeHTML(lesson.id)}">${t("edit.delete")}</button>
            </div>` : ""}
          </div>
          ${structures}
          <div class="sentence-list note-examples">${examples || `<p class="content-empty">${t("lessons.empty")}</p>`}</div>
        </section>
      `;
    }).join("");

    const sentences = lesson.sentences.map((sentence) => sentenceButton(sentence, "", "sentence", "")).join("");
    const notesSection = `
      <div class="content-heading">
        <div>
          <h3>${t("lessons.grammar")}</h3>
          <span>${t("lessons.clickWord")}</span>
        </div>
        ${editable ? `<button class="mini-action" type="button" data-add-note data-lesson-id="${escapeHTML(lesson.id)}">${t("edit.addGrammar")}</button>` : ""}
      </div>
      <div class="study-notes">${studyNotes || `<p class="content-empty">${t("lessons.empty")}</p>`}</div>
    `;
    const importedMeta = lesson.imported && !lesson._public ? `
      <div class="imported-lesson-meta">
        <div>
          <span class="local-badge">${t(lesson.manual ? "lessons.localCourse" : "lessons.localImport")}</span>
          <p>${lesson.manual
            ? t("lessons.manualCourseHint")
            : t("lessons.source", { source: escapeHTML(lesson.sourceName || "本地文件") })}</p>
        </div>
      </div>
    ` : "";

    return `
      <details class="lesson-panel" id="${lesson.id}" data-lesson-panel="${lesson.id}">
        <summary>
          <span class="lesson-summary-copy">
            <span class="lesson-index">${lesson.number}</span>
            <span>
              <h2>${escapeHTML(lesson.title)}</h2>
              <p>${t("lessons.wordCount", { words: lesson.words.length, sentences: getLessonSentenceCount(lesson) })}</p>
              ${lesson._public ? `<span class="lesson-visibility-badge" data-kind="public">${t("admin.publicCourse")}</span>` : ""}
            </span>
          </span>
          <span class="lesson-summary-controls">
            <span class="summary-action"><span>${t("lessons.open")}</span></span>
            <span class="lesson-row-actions" data-lesson-actions="${escapeHTML(lesson.id)}">
              <button class="lesson-icon-button lesson-drag-handle" type="button" data-lesson-drag-handle="${escapeHTML(lesson.id)}" aria-label="${t("edit.dragLesson")}" title="${t("edit.dragLesson")}" aria-keyshortcuts="ArrowUp ArrowDown">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="6" r="1.35"></circle><circle cx="16" cy="6" r="1.35"></circle><circle cx="8" cy="12" r="1.35"></circle><circle cx="16" cy="12" r="1.35"></circle><circle cx="8" cy="18" r="1.35"></circle><circle cx="16" cy="18" r="1.35"></circle></svg>
              </button>
              ${editable ? `<button class="lesson-icon-button lesson-menu-trigger" type="button" data-lesson-menu="${escapeHTML(lesson.id)}" aria-haspopup="menu" aria-expanded="false" aria-label="${t("edit.menu")}" title="${t("edit.menu")}">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.7"></circle><circle cx="12" cy="12" r="1.7"></circle><circle cx="19" cy="12" r="1.7"></circle></svg>
              </button>` : ""}
              <button class="lesson-icon-button lesson-add-button" type="button" data-add-lesson="${escapeHTML(lesson.id)}" aria-label="${t("edit.addLesson")}" title="${t("edit.addLesson")}">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>
              </button>
              ${editable ? `<span class="lesson-overflow-menu" role="menu" data-lesson-menu-panel="${escapeHTML(lesson.id)}" hidden>
                <button type="button" role="menuitem" data-edit-lesson="${escapeHTML(lesson.id)}">${t("edit.rename")}</button>
                <button class="lesson-menu-danger" type="button" role="menuitem" data-delete-lesson="${escapeHTML(lesson.id)}">${t("edit.deleteLesson")}</button>
              </span>` : ""}
            </span>
          </span>
        </summary>
        <div class="lesson-content">
          ${importedMeta}
          <div class="content-heading">
            <div>
              <h3>${escapeHTML(lesson.wordSectionTitle || t("lessons.words"))}</h3>
              <span>${t("lessons.clickRead")}</span>
            </div>
            ${editable ? `<button class="mini-action" type="button" data-add-word data-lesson-id="${escapeHTML(lesson.id)}">${t("edit.addWord")}</button>` : ""}
          </div>
          <div class="word-grid">${words || `<p class="content-empty">${t("lessons.empty")}</p>`}</div>
          ${notesSection}
          <div class="content-heading">
            <div>
              <h3>${escapeHTML(lesson.readingTitle || t("lessons.reading"))}</h3>
              <span>${t("lessons.clickWord")}</span>
            </div>
            ${editable ? `<button class="mini-action" type="button" data-add-sentence data-lesson-id="${escapeHTML(lesson.id)}">${t("edit.addSentence")}</button>` : ""}
          </div>
          <div class="sentence-list">${sentences || `<p class="content-empty">${t("lessons.empty")}</p>`}</div>
        </div>
      </details>
    `;
  }

  function renderLessons() {
    const lessonList = $("#lesson-list");
    lessonList.innerHTML = lessons.map(lessonMarkup).join("");

    $$('[data-lesson-panel]', lessonList).forEach((panel) => {
      panel.addEventListener("toggle", () => {
        const actionLabel = $(".summary-action span", panel);
        if (actionLabel) actionLabel.textContent = t(panel.open ? "lessons.close" : "lessons.open");
        if (!panel.open) return;
        appState = window.LearningStorage.recordLesson(panel.dataset.lessonPanel);
        renderRecentLessons();
      });
    });

    applyTranslationSetting();
  }

  function persistLessonOrder(lessonList) {
    const lessonIds = $$('[data-lesson-panel]', lessonList).map((panel) => panel.dataset.lessonPanel);
    const byId = new Map(lessons.map((lesson) => [String(lesson.id), lesson]));
    const orderedLessons = lessonIds.flatMap((lessonId) => {
      const lesson = byId.get(String(lessonId));
      if (!lesson) return [];
      byId.delete(String(lessonId));
      return [lesson];
    });
    lessons.splice(0, lessons.length, ...orderedLessons, ...byId.values());
    window.LessonEditor?.reorder?.(lessonIds);
    renderDynamicControls();
  }

  function setupLessonReordering() {
    const lessonList = $("#lesson-list");
    let activeDrag = null;
    let suppressHandleClick = false;

    const finishDrag = () => {
      if (!activeDrag) return;
      const state = activeDrag;
      activeDrag = null;
      try {
        if (state.handle.hasPointerCapture?.(state.pointerId)) {
          state.handle.releasePointerCapture(state.pointerId);
        }
      } catch (_error) {
        // Pointer capture is best-effort on older mobile browsers.
      }
      state.panel.classList.remove("is-dragging");
      lessonList.classList.remove("is-reordering");
      document.body.classList.remove("lesson-is-dragging");
      if (!state.dragging) return;
      if (state.wasOpen) state.panel.open = true;
      persistLessonOrder(lessonList);
      suppressHandleClick = true;
      window.setTimeout(() => { suppressHandleClick = false; }, 120);
    };

    lessonList.addEventListener("click", (event) => {
      if (!suppressHandleClick || !event.target.closest("[data-lesson-drag-handle]")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      suppressHandleClick = false;
    }, true);

    lessonList.addEventListener("pointerdown", (event) => {
      const handle = event.target.closest("[data-lesson-drag-handle]");
      if (!handle || (event.pointerType === "mouse" && event.button !== 0)) return;
      const panel = handle.closest("[data-lesson-panel]");
      if (!panel) return;
      activeDrag = {
        handle,
        panel,
        pointerId: event.pointerId,
        startY: event.clientY,
        dragging: false,
        wasOpen: panel.open
      };
      try { handle.setPointerCapture?.(event.pointerId); } catch (_error) { /* no-op */ }
    });

    lessonList.addEventListener("pointermove", (event) => {
      if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
      if (!activeDrag.dragging && Math.abs(event.clientY - activeDrag.startY) < 6) return;
      if (!activeDrag.dragging) {
        activeDrag.dragging = true;
        activeDrag.panel.open = false;
        activeDrag.panel.classList.add("is-dragging");
        lessonList.classList.add("is-reordering");
        document.body.classList.add("lesson-is-dragging");
      }
      event.preventDefault();

      const otherPanels = $$('[data-lesson-panel]', lessonList)
        .filter((panel) => panel !== activeDrag.panel);
      const beforePanel = otherPanels.find((panel) => {
        const rect = panel.getBoundingClientRect();
        return event.clientY < rect.top + rect.height / 2;
      });
      if (beforePanel) lessonList.insertBefore(activeDrag.panel, beforePanel);
      else lessonList.append(activeDrag.panel);

      const edge = 72;
      if (event.clientY < edge) window.scrollBy(0, -12);
      else if (event.clientY > window.innerHeight - edge) window.scrollBy(0, 12);
    });

    lessonList.addEventListener("pointerup", finishDrag);
    lessonList.addEventListener("pointercancel", finishDrag);

    lessonList.addEventListener("keydown", (event) => {
      const handle = event.target.closest("[data-lesson-drag-handle]");
      if (!handle || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
      const panel = handle.closest("[data-lesson-panel]");
      if (!panel) return;
      const sibling = event.key === "ArrowUp" ? panel.previousElementSibling : panel.nextElementSibling;
      if (!sibling?.matches?.("[data-lesson-panel]")) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "ArrowUp") lessonList.insertBefore(panel, sibling);
      else lessonList.insertBefore(panel, sibling.nextElementSibling);
      persistLessonOrder(lessonList);
      handle.focus();
    });
  }

  function renderFavorites() {
    const favoriteWords = allWords.filter((word) => isFavorite(word.id));
    const summary = $("#favorites-summary");
    const list = $("#favorites-list");
    summary.textContent = favoriteWords.length
      ? t("favorites.count", { count: favoriteWords.length })
      : t("favorites.none");

    if (!favoriteWords.length) {
      list.innerHTML = `
        <div class="empty-state favorites-empty">
          <div>
            <strong>${t("favorites.emptyTitle")}</strong>
            <p>${t("favorites.emptyText")}</p>
          </div>
        </div>
      `;
      return;
    }

    list.innerHTML = favoriteWords.map((word) => wordCardMarkup(word, true)).join("");
  }

  function syncFavoriteStars() {
    $$('[data-word-favorite]').forEach((button) => {
      const word = wordById.get(button.dataset.wordFavorite);
      if (!word) return;
      const favorite = isFavorite(word.id);
      const action = favorite ? t("favorites.remove") : t("favorites.add");
      button.setAttribute("aria-pressed", String(favorite));
      button.setAttribute("aria-label", `${action} ${word.english}`);
      button.title = action;
    });
  }

  function toggleWordFavorite(wordId, lessonId) {
    if (!wordById.has(wordId)) return;
    appState = window.LearningStorage.toggleFavorite(wordId);
    renderStats();
    renderFavorites();
    renderSearch($("#search-input").value);
    syncFavoriteStars();

    if ($("#deck-filter").value === "favorites") resetDeck(false);
    else updateCardStatus();

    recordLessonActivity(lessonId || wordById.get(wordId).lessonId);
  }

  function applyTranslationSetting() {
    const hideChinese = Boolean(appState.settings.hideChinese);
    const hideEnglish = Boolean(appState.settings.hideEnglish);
    $("#hide-chinese").checked = hideChinese;
    $("#hide-english").checked = hideEnglish;
    $('[data-view="lessons"]').classList.toggle("hide-translations", hideChinese);
    $('[data-view="lessons"]').classList.toggle("hide-english-content", hideEnglish);
  }

  function partOfSpeechLabel(value) {
    const labels = {
      noun: "名词",
      verb: "动词",
      "auxiliary verb": "助动词",
      "modal verb": "情态动词",
      adjective: "形容词",
      adverb: "副词",
      pronoun: "代词",
      preposition: "介词",
      conjunction: "连词",
      interjection: "感叹词",
      exclamation: "感叹词",
      determiner: "限定词",
      article: "冠词",
      numeral: "数词",
      phrase: "短语",
      abbreviation: "缩写",
      prefix: "前缀",
      suffix: "后缀"
    };
    return labels[String(value || "").toLocaleLowerCase("en")] || "其他";
  }

  function lexicalMeaningsMarkup(meanings, className) {
    return (Array.isArray(meanings) ? meanings : []).map((meaning) => {
      const definitions = (Array.isArray(meaning.definitions) ? meaning.definitions : [])
        .filter((definition) => definition.chinese || definition.definition);
      if (!definitions.length) return "";
      const partOfSpeech = String(meaning.partOfSpeech || "meaning");
      return `
        <section class="${className}-meaning">
          <h3><span>${escapeHTML(partOfSpeechLabel(partOfSpeech))}</span><small>${escapeHTML(partOfSpeech)}</small></h3>
          <ol>
            ${definitions.map((definition) => `
              <li>
                ${definition.chinese ? `<strong>${escapeHTML(definition.chinese)}</strong>` : ""}
                ${definition.definition ? `<p lang="en">${escapeHTML(definition.definition)}</p>` : ""}
                ${definition.example ? `<blockquote lang="en">${escapeHTML(definition.example)}</blockquote>` : ""}
              </li>
            `).join("")}
          </ol>
        </section>
      `;
    }).join("");
  }

  function fallbackPartOfSpeech(word) {
    const english = String(word?.english || "").trim();
    if (/\s/.test(english)) return "phrase";
    const chinese = String(word?.chinese || "");
    const markers = [
      ["名词", "noun"],
      ["动词", "verb"],
      ["形容词", "adjective"],
      ["副词", "adverb"],
      ["介词", "preposition"],
      ["连词", "conjunction"],
      ["代词", "pronoun"]
    ];
    return markers.find(([label]) => chinese.includes(`（${label}）`) || chinese.includes(`(${label})`))?.[1] || "";
  }

  async function renderFlashcardDictionary(word) {
    const sequence = ++flashcardDictionarySequence;
    flashcardDictionaryController?.abort();
    flashcardDictionaryController = null;
    const chinese = $("#card-chinese");
    const meanings = $("#card-meanings");
    const status = $("#card-lexical-status");
    const back = $(".flashcard-back");
    const fallbackPart = fallbackPartOfSpeech(word);

    chinese.hidden = false;
    chinese.textContent = word?.chinese || "—";
    meanings.hidden = true;
    meanings.replaceChildren();
    back.classList.remove("has-lexical-meanings");
    status.textContent = fallbackPart ? `${partOfSpeechLabel(fallbackPart)} · ${fallbackPart}` : "正在查询词性和更多释义…";

    if (!word || !window.OnlineDictionary?.isSupportedQuery(word.english)) {
      if (!fallbackPart) status.textContent = "词性暂未收录";
      return;
    }

    flashcardDictionaryController = new AbortController();
    try {
      const result = await window.OnlineDictionary.lookup(word.english, {
        signal: flashcardDictionaryController.signal
      });
      if (sequence !== flashcardDictionarySequence || getCurrentWord()?.id !== word.id) return;
      const displayedMeanings = result.meanings?.length ? result.meanings : (fallbackPart ? [{
        partOfSpeech: fallbackPart,
        definitions: [{ chinese: word.chinese || result.translation, definition: "", example: "" }]
      }] : []);
      const markup = lexicalMeaningsMarkup(displayedMeanings, "flashcard");
      if (markup) {
        meanings.innerHTML = markup;
        meanings.hidden = false;
        chinese.textContent = word.chinese || result.translation || "—";
        chinese.hidden = false;
        back.classList.add("has-lexical-meanings");
        status.textContent = result.fromCache ? "词性与释义 · 已缓存" : "词性与释义";
      } else {
        chinese.textContent = result.translation || word.chinese;
        status.textContent = fallbackPart ? `${partOfSpeechLabel(fallbackPart)} · ${fallbackPart}` : "词性暂未收录";
      }
    } catch (error) {
      if (error?.name === "AbortError" || sequence !== flashcardDictionarySequence) return;
      status.textContent = fallbackPart
        ? `${partOfSpeechLabel(fallbackPart)} · ${fallbackPart}`
        : "在线词性暂时不可用";
    }
  }

  function renderOnlineDictionaryResult(result) {
    const phonetics = result.phonetics.length
      ? result.phonetics.map((phonetic) => `<span>${escapeHTML(phonetic)}</span>`).join("")
      : '<span class="dictionary-muted">暂未返回音标</span>';
    const translation = result.translation
      ? `<p class="dictionary-translation"><span>常见中文释义</span><strong>${escapeHTML(result.translation)}</strong></p>`
      : '<p class="dictionary-translation dictionary-muted">中文概括暂未返回，请查看下面按词性整理的释义。</p>';
    const meaningsMarkup = lexicalMeaningsMarkup(result.meanings, "dictionary");
    const meanings = meaningsMarkup
      ? meaningsMarkup
      : '<p class="dictionary-muted dictionary-no-definition">这是短语翻译结果，暂时没有可按词性拆分的词典释义。</p>';
    const resolvedNotice = result.resolvedFrom
      ? `<p class="dictionary-resolved">已自动按原形 <strong lang="en">${escapeHTML(result.word)}</strong> 查询；你输入的是 <span lang="en">${escapeHTML(result.resolvedFrom)}</span>。</p>`
      : "";
    const sourceLine = result.source === "translation"
      ? "短语翻译来自 MyMemory"
      : `词条与词性来自 ${result.source === "datamuse" ? "Datamuse" : "Free Dictionary API"} · 中文释义来自 MyMemory`;

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
        ${resolvedNotice}
        ${translation}
        <div class="dictionary-meanings">${meanings}</div>
        <p class="dictionary-source">${sourceLine}</p>
      </article>
    `;
  }

  function dictionarySuggestionsMarkup(suggestions) {
    if (!Array.isArray(suggestions) || !suggestions.length) return "";
    return `
      <div class="dictionary-suggestions">
        <span>你是不是想查：</span>
        <div>${suggestions.map((word) => `
          <button type="button" data-dictionary-suggestion="${escapeHTML(word)}" lang="en">${escapeHTML(word)}</button>
        `).join("")}</div>
      </div>
    `;
  }

  function scheduleOnlineDictionary(query) {
    window.clearTimeout(onlineSearchTimer);
    onlineSearchController?.abort();
    onlineSearchController = null;
    const sequence = ++onlineSearchSequence;

    $("#online-dictionary").hidden = false;

    if (!query) {
      $("#online-dictionary-status").textContent = "";
      $("#online-dictionary-content").innerHTML = `
        <div class="dictionary-welcome">
          <strong>输入一个英文单词开始查询</strong>
          <p>会优先显示精确词条，并补充音标、词性、多种含义、中文释义和例句。</p>
        </div>
      `;
      return;
    }

    if (!window.OnlineDictionary?.isSupportedQuery(query)) {
      $("#online-dictionary-status").textContent = "格式不支持";
      $("#online-dictionary-content").innerHTML = `
        <div class="dictionary-error">
          <strong>请输入英文单词或英文短语</strong>
          <p>目前在线词典不接受中文、数字或特殊符号。</p>
        </div>
      `;
      return;
    }

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
        const invalid = error.code === "INVALID_QUERY";
        $("#online-dictionary-status").textContent = notFound ? "没有收录" : (invalid ? "格式不支持" : "连接失败");
        $("#online-dictionary-content").innerHTML = `
          <div class="dictionary-error">
            <strong>${notFound ? "没有找到精确词条" : (invalid ? "请输入完整的英文单词" : "暂时无法连接在线词典")}</strong>
            <p>${notFound ? "请检查拼写，或从下面的建议中选择。" : (invalid ? "可使用英文字母、空格、连字符和撇号。" : "请检查网络后稍后重试。")}</p>
            ${dictionarySuggestionsMarkup(error.suggestions)}
          </div>
        `;
      }
    }, 500);
  }

  function renderSearch(query) {
    const normalizedQuery = window.OnlineDictionary?.normalizeQuery(query) || String(query || "").trim();
    $("#clear-search").hidden = !normalizedQuery;
    scheduleOnlineDictionary(normalizedQuery);
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
    favoriteButton.textContent = favorite ? t("favorites.saved") : t("favorites.add");
  }

  function resetCardImage(message, options = {}) {
    const image = $("#card-image");
    const placeholder = $("#card-image-placeholder");
    const credit = $("#card-image-credit");
    const changeButton = $("#change-card-image");
    const status = $("#card-image-status");
    image.onload = null;
    image.onerror = null;
    image.removeAttribute("src");
    image.alt = "";
    image.hidden = true;
    placeholder.classList.toggle("is-concept", Boolean(options.concept));
    placeholder.replaceChildren();
    if (options.concept) {
      const kicker = document.createElement("span");
      const english = document.createElement("strong");
      const chinese = document.createElement("small");
      kicker.textContent = t("images.conceptKicker");
      english.textContent = options.concept.english || "WORD";
      chinese.textContent = options.concept.chinese || message || t("images.none");
      placeholder.append(kicker, english, chinese);
    } else {
      placeholder.textContent = message;
    }
    placeholder.hidden = false;
    credit.hidden = true;
    credit.removeAttribute("href");
    credit.textContent = "";
    changeButton.hidden = !options.allowChange;
    changeButton.disabled = Boolean(options.disabled);
    status.textContent = options.status || "";
  }

  function scheduleCardImagePrefetch(word) {
    window.clearTimeout(wordImagePrefetchTimer);
    if (!word || !window.WordImages?.preload || deck.length < 2) return;

    wordImagePrefetchTimer = window.setTimeout(() => {
      const queued = [];
      const limit = Math.min(2, deck.length - 1);
      for (let offset = 1; offset <= limit; offset += 1) {
        const nextWord = deck[(deckIndex + offset) % deck.length];
        if (nextWord && nextWord.id !== word.id) queued.push(nextWord);
      }
      queued.forEach((item) => window.WordImages.preload(item));
    }, 250);
  }

  async function renderCardImage(word, options = {}) {
    wordImageSequence += 1;
    const sequence = wordImageSequence;
    if (wordImageController) wordImageController.abort();
    wordImageController = null;

    if (!word) {
      resetCardImage(t("images.none"));
      return;
    }

    if (!window.WordImages?.find) {
      resetCardImage(t("images.unavailable"));
      return;
    }

    const shouldAdvance = Boolean(options.advance && window.WordImages.next);
    resetCardImage(t(shouldAdvance ? "images.changing" : "images.searching"), { disabled: true });
    wordImageController = new AbortController();

    try {
      const action = shouldAdvance ? window.WordImages.next : window.WordImages.find;
      const result = await action(word, { signal: wordImageController.signal });
      if (sequence !== wordImageSequence) return;
      if (!result) {
        resetCardImage(t("images.none"), {
          concept: word,
          status: t("images.conceptStatus")
        });
        scheduleCardImagePrefetch(word);
        return;
      }

      const image = $("#card-image");
      const placeholder = $("#card-image-placeholder");
      const credit = $("#card-image-credit");
      const changeButton = $("#change-card-image");
      const status = $("#card-image-status");
      const hasAlternatives = result.candidateCount > 1;
      image.alt = `${word.english}：${result.title}`;
      image.onload = () => {
        if (sequence !== wordImageSequence) return;
        image.hidden = false;
        placeholder.hidden = true;
        if (result.landingUrl) credit.hidden = false;
        changeButton.hidden = !hasAlternatives;
        changeButton.disabled = false;
        status.textContent = shouldAdvance
          ? t("images.changed")
          : (result.matchType === "scene" ? t("images.scene") : "");
      };
      image.onerror = () => {
        if (sequence !== wordImageSequence) return;
        resetCardImage(t("images.failed"), {
          allowChange: hasAlternatives,
          concept: hasAlternatives ? null : word,
          status: hasAlternatives ? "" : t("images.conceptStatus")
        });
      };
      credit.href = result.landingUrl || "#";
      credit.textContent = `${result.creator} · ${result.license}`;
      credit.title = `${result.source} · ${result.title}`;
      image.src = result.thumbnail;
      scheduleCardImagePrefetch(word);
    } catch (error) {
      if (error?.name === "AbortError" || sequence !== wordImageSequence) return;
      resetCardImage(t("images.offline"), {
        concept: word,
        status: t("images.conceptStatus")
      });
    }
  }

  function renderFlashcard() {
    const word = getCurrentWord();
    const cardControls = [
      $("#flashcard"),
      $("#previous-card"),
      $("#next-card"),
      $("#speak-card"),
      ...$$('[data-card-status]'),
      $("[data-card-favorite]")
    ];
    cardControls.forEach((button) => { button.disabled = !word; });

    if (!word) {
      flashcardDictionarySequence += 1;
      flashcardDictionaryController?.abort();
      flashcardDictionaryController = null;
      $("#deck-progress").textContent = t("cards.none");
      $("#card-context").textContent = "";
      $("#card-english").textContent = t("cards.noContent");
      $("#card-ipa").textContent = "";
      $("#card-chinese").textContent = "—";
      $("#card-chinese").hidden = false;
      $("#card-meanings").hidden = true;
      $("#card-meanings").replaceChildren();
      $(".flashcard-back").classList.remove("has-lexical-meanings");
      $("#card-lexical-status").textContent = "";
      $$('[data-card-status]').forEach((button) => button.setAttribute("aria-pressed", "false"));
      $("[data-card-favorite]").setAttribute("aria-pressed", "false");
      $("[data-card-favorite]").textContent = t("favorites.add");
      renderCardImage(null);
      return;
    }

    $("#deck-progress").textContent = `${deckIndex + 1} / ${deck.length}`;
    $("#card-context").textContent = `${word.lessonTitle} · WORD CARD`;
    $("#card-english").textContent = word.english;
    $("#card-ipa").textContent = word.ipa;
    $("#card-chinese").textContent = word.chinese;
    renderFlashcardDictionary(word);
    setCardFlipped(false);
    updateCardStatus();
    if (!$("[data-view='flashcards']").hidden) renderCardImage(word);
  }

  function resetDeck(shouldShuffle) {
    const filter = $("#deck-filter").value;
    if (filter === "all") deck = [...allWords];
    else if (filter === "favorites") deck = allWords.filter((word) => isFavorite(word.id));
    else deck = allWords.filter((word) => word.lessonId === filter);

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
    $("#search-label").textContent = t("search.label");
    $("#deck-filter").innerHTML = [
      `<option value="all">${t("common.allLessons")}</option>`,
      `<option value="favorites">${t("common.myFavorites")}</option>`,
      ...lessons.map((lesson) => `<option value="${lesson.id}">${escapeHTML(lesson.title)}</option>`)
    ].join("");
    $("#course-export-select").innerHTML = [
      `<option value="all">${t("export.all")}</option>`,
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
    $("#theme-label").textContent = t(isDark ? "theme.night" : "theme.day");
    $("#theme-toggle").setAttribute("aria-label", t(isDark ? "theme.toDay" : "theme.toNight"));
    $("#theme-toggle").title = t(isDark ? "theme.toDay" : "theme.toNight");
  }

  function showView(viewName) {
    const requestedView = views.includes(viewName) ? viewName : "home";
    const activeView = requestedView === "admin" && !isSignedInAdmin() ? "home" : requestedView;
    $$('[data-view]').forEach((section) => {
      section.hidden = section.dataset.view !== activeView;
    });
    $$('[data-nav]').forEach((link) => {
      if (link.dataset.nav === activeView) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    if (activeView === "flashcards") renderCardImage(getCurrentWord());
    else {
      if (wordImageController) wordImageController.abort();
      window.clearTimeout(wordImagePrefetchTimer);
    }
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
    window.addEventListener("hexin:auth-changed", () => {
      renderLessons();
      window.SiteI18n?.apply?.($("#lesson-list"));
      routeFromHash();
    });
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
      appState = window.LearningStorage.updateSettings({ theme: "light", hideChinese: false, hideEnglish: false, appearanceVersion: 4 });
      applyTranslationSetting();
    }
    applyTheme(initialTheme);

    $("#theme-toggle").addEventListener("click", () => {
      const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      appState = window.LearningStorage.updateSettings({ theme: nextTheme });
      applyTheme(nextTheme);
    });
  }

  function setupLanguage() {
    const select = $("#language-select");
    if (!select || !window.SiteI18n) return;
    select.value = window.SiteI18n.current();
    select.addEventListener("change", () => {
      window.SiteI18n.setLanguage(select.value);
      window.location.reload();
    });
  }

  function keepLessonOpen(lessonId) {
    try {
      window.sessionStorage.setItem("hexin-open-imported-lesson", lessonId);
    } catch (_error) {
      // 会话存储不可用时，编辑仍然已经写入 localStorage。
    }
    window.location.hash = "lessons";
    window.location.reload();
  }

  function editorField(name) {
    return $(`[data-editor-field="${name}"]`);
  }

  function openLessonEditor(action, lessonId, noteId) {
    const dialog = $("#lesson-editor-dialog");
    const form = $("#lesson-editor-form");
    const lesson = getLesson(lessonId);
    if (!dialog || !form || !lesson) return;
    if (!canManageLesson(lesson)) {
      window.alert(t("admin.readonly"));
      return;
    }

    const definitions = {
      rename: { title: "edit.dialog.rename", fields: ["title"] },
      word: { title: "edit.dialog.word", fields: ["english", "ipa", "chinese"] },
      note: { title: "edit.dialog.note", fields: ["title", "description", "structures"] },
      example: { title: "edit.dialog.example", fields: ["english", "chinese"] },
      sentence: { title: "edit.dialog.sentence", fields: ["english", "chinese"] }
    };
    const definition = definitions[action];
    if (!definition) return;

    form.reset();
    $("#lesson-editor-action").value = action;
    $("#lesson-editor-lesson-id").value = lessonId;
    $("#lesson-editor-note-id").value = noteId || "";
    $("#lesson-editor-title").textContent = t(definition.title);
    $("#lesson-editor-error").hidden = true;
    ["title", "english", "ipa", "chinese", "description", "structures"].forEach((name) => {
      const field = editorField(name);
      const input = field?.querySelector("input, textarea");
      if (!field || !input) return;
      field.hidden = !definition.fields.includes(name);
      input.required = definition.fields.includes(name) && (name === "title" || name === "english");
    });
    if (action === "rename") $("#lesson-editor-title-input").value = lesson.title;

    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    const firstInput = form.querySelector(".editor-field:not([hidden]) input, .editor-field:not([hidden]) textarea");
    window.requestAnimationFrame(() => firstInput?.focus());
  }

  function closeLessonEditor() {
    const dialog = $("#lesson-editor-dialog");
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function setupLessonEditor() {
    const form = $("#lesson-editor-form");
    $("#lesson-editor-cancel").addEventListener("click", closeLessonEditor);
    $("#lesson-editor-dialog").addEventListener("click", (event) => {
      if (event.target === event.currentTarget) closeLessonEditor();
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const action = $("#lesson-editor-action").value;
      const lessonId = $("#lesson-editor-lesson-id").value;
      const noteId = $("#lesson-editor-note-id").value;
      const lesson = getLesson(lessonId);
      const values = {
        title: $("#lesson-editor-title-input").value,
        english: $("#lesson-editor-english").value,
        ipa: $("#lesson-editor-ipa").value,
        chinese: $("#lesson-editor-chinese").value,
        description: $("#lesson-editor-description").value,
        structures: $("#lesson-editor-structures").value
      };
      try {
        if (!lesson || !window.LessonEditor) throw new Error("课程编辑器没有正确载入。");
        if (!canManageLesson(lesson)) throw new Error(t("admin.readonly"));
        if (action === "rename") window.LessonEditor.rename(lesson, values.title);
        if (action === "word") window.LessonEditor.addWord(lesson, values);
        if (action === "note") window.LessonEditor.addNote(lesson, values);
        if (action === "example") window.LessonEditor.addExample(lesson, noteId, values);
        if (action === "sentence") window.LessonEditor.addSentence(lesson, values);
        closeLessonEditor();
        keepLessonOpen(lessonId);
      } catch (error) {
        const errorBox = $("#lesson-editor-error");
        errorBox.textContent = error.message || "保存失败，请重试。";
        errorBox.hidden = false;
      }
    });
  }

  function confirmDestructiveAction(button, action) {
    if (button.dataset.confirmDelete === "true") {
      action();
      return;
    }
    const originalLabel = button.textContent;
    button.dataset.confirmDelete = "true";
    button.textContent = t("edit.confirm");
    window.setTimeout(() => {
      if (!button.isConnected) return;
      button.dataset.confirmDelete = "false";
      button.textContent = originalLabel;
    }, 12000);
  }

  function setupCourseExport() {
    const pdfButton = $("#export-pdf");
    const wordButton = $("#export-word");
    const status = $("#export-status");
    const selectedLessons = () => {
      const selected = $("#course-export-select").value;
      return selected === "all" ? lessons : lessons.filter((lesson) => lesson.id === selected);
    };
    const exportTitle = (items) => items.length === 1 ? items[0].title : "何鑫的英语课程学习资料";
    const setBusy = (busy) => {
      pdfButton.disabled = busy;
      wordButton.disabled = busy;
    };

    wordButton.addEventListener("click", () => {
      const items = selectedLessons();
      try {
        window.CourseExporter.exportWord(items, appState, exportTitle(items));
        status.textContent = t("export.done");
      } catch (error) {
        status.textContent = t("export.failed", { message: error.message });
      }
    });

    pdfButton.addEventListener("click", async () => {
      const items = selectedLessons();
      setBusy(true);
      status.textContent = t("export.working");
      try {
        await window.CourseExporter.exportPdf(items, appState, exportTitle(items));
        status.textContent = t("export.done");
      } catch (error) {
        status.textContent = t("export.failed", { message: error.message });
      } finally {
        setBusy(false);
      }
    });
  }

  function closeLessonMenu(restoreFocus = false) {
    $$('[data-lesson-menu-panel]').forEach((menu) => { menu.hidden = true; });
    $$('[data-lesson-actions]').forEach((actions) => actions.classList.remove("is-open"));
    $$('[data-lesson-menu]').forEach((trigger) => trigger.setAttribute("aria-expanded", "false"));
    if (restoreFocus && activeLessonMenuTrigger?.isConnected) activeLessonMenuTrigger.focus();
    activeLessonMenuTrigger = null;
  }

  function toggleLessonMenu(trigger) {
    const lessonId = trigger.dataset.lessonMenu;
    const menu = $(`[data-lesson-menu-panel="${CSS.escape(lessonId)}"]`);
    const actions = trigger.closest("[data-lesson-actions]");
    if (!menu || !actions) return;
    const willOpen = menu.hidden;
    closeLessonMenu(false);
    if (!willOpen) return;
    menu.hidden = false;
    actions.classList.add("is-open");
    trigger.setAttribute("aria-expanded", "true");
    activeLessonMenuTrigger = trigger;
    window.requestAnimationFrame(() => $("[role='menuitem']", menu)?.focus());
  }

  function createBlankLesson() {
    if (!window.LessonImporter?.saveLesson) return;
    const number = Math.max(0, ...lessons.map((lesson) => Number(lesson.number) || 0)) + 1;
    const lesson = {
      id: `imported-manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      number,
      title: t("edit.newLesson", { number }),
      wordSectionTitle: t("lessons.words"),
      readingTitle: t("lessons.reading"),
      words: [],
      sentences: [],
      studyNotes: [],
      imported: true,
      manual: true,
      sourceName: t("edit.manualSource"),
      importedAt: Date.now()
    };
    const saved = window.LessonImporter.saveLesson(lesson);
    window.LessonEditor?.prepend?.(saved.id);
    keepLessonOpen(saved.id);
  }

  function setupLessonControls() {
    $("#hide-chinese").addEventListener("change", (event) => {
      appState = window.LearningStorage.updateSettings({ hideChinese: event.target.checked });
      applyTranslationSetting();
    });

    $("#hide-english").addEventListener("change", (event) => {
      appState = window.LearningStorage.updateSettings({ hideEnglish: event.target.checked });
      applyTranslationSetting();
    });

    $("#expand-lessons").addEventListener("click", () => {
      $$('[data-lesson-panel]').forEach((panel) => { panel.open = true; });
    });

    $("#collapse-lessons").addEventListener("click", () => {
      $$('[data-lesson-panel]').forEach((panel) => { panel.open = false; });
    });

    $("#lesson-list").addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.closest("summary")) event.preventDefault();

      if (button.matches("[data-lesson-menu]")) {
        toggleLessonMenu(button);
        return;
      }

      if (button.matches("[data-add-lesson]")) {
        event.preventDefault();
        closeLessonMenu(false);
        try {
          createBlankLesson();
        } catch (error) {
          window.alert(error.message || t("edit.addLessonFailed"));
        }
        return;
      }

      const lessonId = button.dataset.lessonId || button.dataset.editLesson || button.dataset.deleteLesson;
      const lesson = getLesson(lessonId);
      const changesLesson = button.matches("[data-edit-lesson], [data-add-word], [data-add-note], [data-add-example], [data-add-sentence], [data-remove-word], [data-remove-note], [data-remove-example], [data-remove-sentence], [data-delete-lesson]");
      if (changesLesson && lesson && !canManageLesson(lesson)) {
        window.alert(t("admin.readonly"));
        return;
      }

      if (button.matches("[data-edit-lesson]")) {
        closeLessonMenu(false);
        openLessonEditor("rename", lessonId);
      }
      else if (button.matches("[data-add-word]")) openLessonEditor("word", lessonId);
      else if (button.matches("[data-add-note]")) openLessonEditor("note", lessonId);
      else if (button.matches("[data-add-example]")) openLessonEditor("example", lessonId, button.dataset.addExample);
      else if (button.matches("[data-add-sentence]")) openLessonEditor("sentence", lessonId);
      else if (button.matches("[data-remove-word]")) {
        confirmDestructiveAction(button, () => {
          window.LessonEditor.removeWord(lesson, button.dataset.removeWord);
          keepLessonOpen(lessonId);
        });
      } else if (button.matches("[data-remove-note]")) {
        confirmDestructiveAction(button, () => {
          window.LessonEditor.removeNote(lesson, button.dataset.removeNote);
          keepLessonOpen(lessonId);
        });
      } else if (button.matches("[data-remove-example]")) {
        confirmDestructiveAction(button, () => {
          window.LessonEditor.removeExample(lesson, button.dataset.noteId, button.dataset.removeExample);
          keepLessonOpen(lessonId);
        });
      } else if (button.matches("[data-remove-sentence]")) {
        confirmDestructiveAction(button, () => {
          window.LessonEditor.removeSentence(lesson, button.dataset.removeSentence);
          keepLessonOpen(lessonId);
        });
      } else if (button.matches("[data-delete-lesson]") && lesson) {
        confirmDestructiveAction(button, () => {
          if (lesson.imported) {
            window.LessonImporter?.deleteLesson?.(lesson.id);
          }
          window.LessonEditor?.deleteLesson?.(lesson.id, lesson);
          window.location.reload();
        });
      }
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest("[data-lesson-actions]")) closeLessonMenu(false);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && activeLessonMenuTrigger) closeLessonMenu(true);
    });
  }

  function setupLessonImporter() {
    window.LessonImporter?.init({
      onSaved(lesson) {
        window.LessonEditor?.prepend?.(lesson.id);
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

    $("#online-dictionary-content").addEventListener("click", (event) => {
      const button = event.target.closest("[data-dictionary-suggestion]");
      if (!button) return;
      searchInput.value = button.dataset.dictionarySuggestion;
      renderSearch(searchInput.value);
      searchInput.focus();
    });
  }

  function setupFavorites() {
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-word-favorite]");
      if (!button) return;
      toggleWordFavorite(button.dataset.wordFavorite, button.dataset.lessonId);
    });

    $("[data-review-favorites]").addEventListener("click", () => {
      $("#deck-filter").value = "favorites";
      resetDeck(false);
    });
  }

  function setupFlashcards() {
    $("#flashcard").addEventListener("click", () => setCardFlipped(!cardFlipped));
    $("#previous-card").addEventListener("click", () => changeCard(-1));
    $("#next-card").addEventListener("click", () => changeCard(1));
    $("#change-card-image").addEventListener("click", () => {
      const word = getCurrentWord();
      if (word) renderCardImage(word, { advance: true });
    });
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
      toggleWordFavorite(word.id, word.lessonId);
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
      if (speakTarget.classList.contains("speech-icon-button")) {
        speakTarget.classList.remove("is-playing");
        window.requestAnimationFrame(() => speakTarget.classList.add("is-playing"));
        window.setTimeout(() => speakTarget.classList.remove("is-playing"), 1600);
      }
      window.SpeechController.speak(speakTarget.dataset.speak, speakTarget.dataset.speechAccent);
      recordLessonActivity(speakTarget.dataset.lessonId);
    });
  }

  function positionWordPopover(trigger) {
    const popover = $("#word-popover");
    popover.style.removeProperty("top");
    popover.style.removeProperty("left");
    popover.style.removeProperty("bottom");
    popover.style.removeProperty("max-height");
    popover.removeAttribute("data-placement");
    if (window.innerWidth <= 700) return;

    const triggerRect = trigger.getBoundingClientRect();
    const edge = 12;
    const gap = 8;
    popover.style.maxHeight = `${Math.max(220, Math.min(480, window.innerHeight - (edge * 2)))}px`;
    const popoverRect = popover.getBoundingClientRect();
    const clampLeft = (value) => Math.min(window.innerWidth - popoverRect.width - edge, Math.max(edge, value));
    const clampTop = (value) => Math.min(window.innerHeight - popoverRect.height - edge, Math.max(edge, value));
    const spaces = {
      right: window.innerWidth - triggerRect.right - edge,
      left: triggerRect.left - edge,
      below: window.innerHeight - triggerRect.bottom - edge,
      above: triggerRect.top - edge
    };
    let placement;
    if (spaces.right >= popoverRect.width + gap) placement = "right";
    else if (spaces.left >= popoverRect.width + gap) placement = "left";
    else if (spaces.below >= popoverRect.height + gap) placement = "below";
    else if (spaces.above >= popoverRect.height + gap) placement = "above";
    else placement = spaces.below >= spaces.above ? "below" : "above";

    let left;
    let top;
    if (placement === "right" || placement === "left") {
      left = placement === "right" ? triggerRect.right + gap : triggerRect.left - popoverRect.width - gap;
      top = clampTop(triggerRect.top - 20);
    } else {
      left = clampLeft(triggerRect.left + (triggerRect.width - popoverRect.width) / 2);
      top = placement === "below" ? triggerRect.bottom + gap : triggerRect.top - popoverRect.height - gap;
      top = clampTop(top);
    }

    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
    popover.dataset.placement = placement;
  }

  function closeWordPopover(restoreFocus) {
    const popover = $("#word-popover");
    if (popover.hidden) return;
    wordPopoverSequence += 1;
    wordPopoverController?.abort();
    wordPopoverController = null;
    popover.hidden = true;
    $("#popover-scrim").hidden = true;
    activePopoverWord = null;
    if (restoreFocus && activeWordTrigger) activeWordTrigger.focus();
    activeWordTrigger = null;
  }

  async function openWordPopover(trigger) {
    const sequence = ++wordPopoverSequence;
    wordPopoverController?.abort();
    wordPopoverController = null;
    const details = getWordDetails(trigger.dataset.word);
    const sentenceCard = trigger.closest(".sentence-card");
    const sentenceTranslation = sentenceCard?.querySelector(".translation")?.textContent.trim();
    activeWordTrigger = trigger;
    activePopoverWord = {
      ...details,
      sentenceTranslation,
      lessonId: trigger.dataset.lessonId
    };

    $("#word-popover-title").textContent = activePopoverWord.word;
    $("#word-popover-ipa").textContent = activePopoverWord.ipa;
    $("#word-popover-status").textContent = "正在查询词性和中文释义…";
    $("#word-popover-senses").innerHTML = `
      <div class="popover-dictionary-loading" role="status"><span aria-hidden="true"></span>正在查询多个词性和义项</div>
    `;
    $("#word-popover-meaning").textContent = details.isVocabulary ? `课程释义：${details.meaning}` : "";
    $("#word-popover-meaning").hidden = !details.isVocabulary;
    $("#word-popover-context").textContent = sentenceTranslation ? `句子翻译：${sentenceTranslation}` : "";
    $("#word-popover-context").hidden = !sentenceTranslation;
    const popover = $("#word-popover");
    popover.scrollTop = 0;
    popover.hidden = false;
    $("#popover-scrim").hidden = window.innerWidth > 700;
    positionWordPopover(trigger);
    recordLessonActivity(activePopoverWord.lessonId);

    if (!window.OnlineDictionary?.isSupportedQuery(details.word)) {
      const fallbackPart = /\s/.test(details.word) ? "phrase" : "";
      $("#word-popover-status").textContent = fallbackPart
        ? `${partOfSpeechLabel(fallbackPart)} · ${fallbackPart}`
        : "词性暂未收录";
      $("#word-popover-senses").innerHTML = fallbackPart ? lexicalMeaningsMarkup([{
        partOfSpeech: fallbackPart,
        definitions: [{ chinese: details.meaning, definition: "", example: "" }]
      }], "popover") : '<p class="popover-dictionary-error">这个词暂时没有可用的词性资料。</p>';
      positionWordPopover(trigger);
      return;
    }

    wordPopoverController = new AbortController();
    try {
      const result = await window.OnlineDictionary.lookup(details.word, {
        signal: wordPopoverController.signal
      });
      if (sequence !== wordPopoverSequence || $("#word-popover").hidden) return;
      const fallbackPart = fallbackPartOfSpeech({ english: details.word, chinese: details.meaning });
      const displayedMeanings = result.meanings?.length ? result.meanings : (fallbackPart ? [{
        partOfSpeech: fallbackPart,
        definitions: [{ chinese: details.isVocabulary ? details.meaning : result.translation, definition: "", example: "" }]
      }] : []);
      const meaningsMarkup = lexicalMeaningsMarkup(displayedMeanings, "popover");
      $("#word-popover-title").textContent = result.word || details.word;
      $("#word-popover-ipa").textContent = result.phonetics[0] || details.ipa;
      $("#word-popover-status").textContent = result.meanings?.length
        ? (result.fromCache ? "词性与释义 · 已缓存" : "词性与释义")
        : (fallbackPart ? `${partOfSpeechLabel(fallbackPart)} · ${fallbackPart}` : "词性暂未收录");
      $("#word-popover-senses").innerHTML = meaningsMarkup
        || '<p class="popover-dictionary-error">在线词典暂未提供分词性释义。</p>';
      if (!details.isVocabulary && result.translation) {
        $("#word-popover-meaning").textContent = `中文概括：${result.translation}`;
        $("#word-popover-meaning").hidden = false;
      }
      positionWordPopover(trigger);
    } catch (error) {
      if (error?.name === "AbortError" || sequence !== wordPopoverSequence) return;
      const fallbackPart = fallbackPartOfSpeech({ english: details.word, chinese: details.meaning });
      $("#word-popover-status").textContent = fallbackPart
        ? `${partOfSpeechLabel(fallbackPart)} · ${fallbackPart}`
        : "在线词性暂时不可用";
      $("#word-popover-senses").innerHTML = fallbackPart ? lexicalMeaningsMarkup([{
        partOfSpeech: fallbackPart,
        definitions: [{ chinese: details.meaning, definition: "", example: "" }]
      }], "popover") : '<p class="popover-dictionary-error">请检查网络后再点一次；句子翻译仍保留在下方。</p>';
      positionWordPopover(trigger);
    }
  }

  function setupWordPopover() {
    $("#lesson-list").addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-word]");
      if (!trigger) return;
      openWordPopover(trigger);
    });

    $("#word-popover-close").addEventListener("click", () => closeWordPopover(true));
    $("#popover-scrim").addEventListener("click", () => closeWordPopover(false));
    document.addEventListener("pointerdown", (event) => {
      const popover = $("#word-popover");
      if (popover.hidden || popover.contains(event.target) || event.target.closest("[data-word]")) return;
      closeWordPopover(false);
    });
    $("#word-speak-us").addEventListener("click", () => {
      if (activePopoverWord) window.SpeechController.speak(activePopoverWord.word, "en-US");
    });
    $("#word-speak-uk").addEventListener("click", () => {
      if (activePopoverWord) window.SpeechController.speak(activePopoverWord.word, "en-GB");
    });

    window.addEventListener("resize", () => {
      if (activeWordTrigger && !$("#word-popover").hidden) {
        $("#popover-scrim").hidden = window.innerWidth > 700;
        positionWordPopover(activeWordTrigger);
      }
    });
    window.addEventListener("scroll", () => {
      if (activeWordTrigger && !$("#word-popover").hidden) positionWordPopover(activeWordTrigger);
    }, { passive: true });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeWordPopover(true);
    });
  }

  function init() {
    setupLanguage();
    renderDynamicControls();
    renderStats();
    renderRecentLessons();
    renderLessons();
    renderFavorites();
    renderSearch("");
    renderFlashcard();
    setupNavigation();
    setupTheme();
    setupLessonReordering();
    setupLessonControls();
    setupLessonEditor();
    setupCourseExport();
    setupLessonImporter();
    setupSearch();
    setupFavorites();
    setupFlashcards();
    setupSpeech();
    setupWordPopover();
    openNewlyImportedLesson();
    window.SiteI18n?.apply?.(document);
    window.setTimeout(() => {
      if (deck[0] && window.WordImages?.preload) window.WordImages.preload(deck[0]);
    }, 800);
    window.dispatchEvent(new CustomEvent("hexin:app-ready", {
      detail: { lessonCount: lessons.length }
    }));
  }

  window.EnglishLearningApp = Object.freeze({
    getLessons: () => JSON.parse(JSON.stringify(lessons)),
    canManageLesson
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
