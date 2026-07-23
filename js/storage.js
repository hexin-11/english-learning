(function () {
  "use strict";

  const STORAGE_KEY = "hexin-english-learning:v1";
  const APPEARANCE_VERSION = 4;
  const DEFAULT_STATE = {
    favorites: [],
    dictionaryFavorites: [],
    mastered: [],
    review: [],
    recentLessons: [],
    settings: {
      theme: "",
      voiceURI: "",
      accent: "en-US",
      rate: 0.8,
      weather: "clear",
      hideChinese: false,
      hideEnglish: false,
      appearanceVersion: APPEARANCE_VERSION
    }
  };

  let memoryState = clone(DEFAULT_STATE);

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function uniqueStrings(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((item) => typeof item === "string"))];
  }

  function dictionaryFavoriteId(value) {
    const normalized = String(value || "").trim().toLocaleLowerCase("en").replaceAll("’", "'");
    return normalized ? `dictionary:${encodeURIComponent(normalized)}` : "";
  }

  function normalizeDictionaryFavorites(value) {
    const seen = new Set();
    return (Array.isArray(value) ? value : []).slice(0, 500).flatMap((entry) => {
      const english = String(entry?.english || "").trim().slice(0, 160);
      const id = dictionaryFavoriteId(english);
      if (!id || seen.has(id)) return [];
      seen.add(id);
      return [{
        id,
        english,
        ipa: String(entry?.ipa || "").trim().slice(0, 160),
        chinese: String(entry?.chinese || "").trim().slice(0, 500)
      }];
    });
  }

  function normalize(candidate) {
    const state = candidate && typeof candidate === "object" ? candidate : {};
    const settings = state.settings && typeof state.settings === "object" ? state.settings : {};
    const rate = Number(settings.rate);
    const currentAppearance = settings.appearanceVersion === APPEARANCE_VERSION;

    return {
      favorites: uniqueStrings(state.favorites),
      dictionaryFavorites: normalizeDictionaryFavorites(state.dictionaryFavorites),
      mastered: uniqueStrings(state.mastered),
      review: uniqueStrings(state.review),
      recentLessons: uniqueStrings(state.recentLessons).slice(0, 5),
      settings: {
        theme: currentAppearance && (settings.theme === "light" || settings.theme === "dark") ? settings.theme : "light",
        voiceURI: typeof settings.voiceURI === "string" ? settings.voiceURI : "",
        accent: settings.accent === "en-GB" ? "en-GB" : "en-US",
        rate: Number.isFinite(rate) && rate >= 0.5 && rate <= 1.3 ? rate : 0.8,
        weather: settings.weather === "rain" || settings.weather === "snow" ? settings.weather : "clear",
        hideChinese: Boolean(settings.hideChinese),
        hideEnglish: Boolean(settings.hideEnglish),
        appearanceVersion: currentAppearance ? APPEARANCE_VERSION : 0
      }
    };
  }

  function read() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return clone(memoryState);
      memoryState = normalize(JSON.parse(raw));
      return clone(memoryState);
    } catch (_error) {
      return clone(memoryState);
    }
  }

  function write(nextState) {
    memoryState = normalize(nextState);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryState));
      window.dispatchEvent(new CustomEvent("hexin:data-changed", { detail: { key: STORAGE_KEY } }));
    } catch (_error) {
      // 浏览器禁用存储时仍保留本次页面会话中的状态。
    }
    return clone(memoryState);
  }

  function update(updater) {
    const draft = read();
    const result = updater(draft) || draft;
    return write(result);
  }

  function toggleFavorite(wordId) {
    return update((state) => {
      const index = state.favorites.indexOf(wordId);
      if (index >= 0) state.favorites.splice(index, 1);
      else state.favorites.push(wordId);
      return state;
    });
  }

  function toggleDictionaryFavorite(entry) {
    return update((state) => {
      const normalized = normalizeDictionaryFavorites([entry])[0];
      if (!normalized) return state;
      const index = state.dictionaryFavorites.findIndex((item) => item.id === normalized.id);
      if (index >= 0) state.dictionaryFavorites.splice(index, 1);
      else state.dictionaryFavorites.push(normalized);
      return state;
    });
  }

  function setWordStatus(wordId, status) {
    return update((state) => {
      const masteredIndex = state.mastered.indexOf(wordId);
      const reviewIndex = state.review.indexOf(wordId);

      if (status === "mastered") {
        if (reviewIndex >= 0) state.review.splice(reviewIndex, 1);
        if (masteredIndex >= 0) state.mastered.splice(masteredIndex, 1);
        else state.mastered.push(wordId);
      } else if (status === "review") {
        if (masteredIndex >= 0) state.mastered.splice(masteredIndex, 1);
        if (reviewIndex >= 0) state.review.splice(reviewIndex, 1);
        else state.review.push(wordId);
      }

      return state;
    });
  }

  function recordLesson(lessonId) {
    return update((state) => {
      state.recentLessons = [lessonId, ...state.recentLessons.filter((id) => id !== lessonId)].slice(0, 5);
      return state;
    });
  }

  function updateSettings(partialSettings) {
    return update((state) => {
      state.settings = { ...state.settings, ...partialSettings };
      return state;
    });
  }

  window.LearningStorage = {
    getState: read,
    toggleFavorite,
    toggleDictionaryFavorite,
    dictionaryFavoriteId,
    setWordStatus,
    recordLesson,
    updateSettings
  };
})();
