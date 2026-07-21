(function () {
  "use strict";

  const CACHE_KEY = "hexin-english-dictionary-cache:v1";
  const CACHE_TTL = 30 * 24 * 60 * 60 * 1000;
  const MAX_CACHE_ITEMS = 80;

  function normalizeQuery(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .replaceAll("’", "'")
      .toLocaleLowerCase("en");
  }

  function isSupportedQuery(value) {
    const query = normalizeQuery(value);
    return query.length >= 2
      && query.length <= 60
      && /^[a-z][a-z' -]*$/i.test(query);
  }

  function readCache() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(CACHE_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_error) {
      return {};
    }
  }

  function getCached(query) {
    const cached = readCache()[query];
    if (!cached || Date.now() - Number(cached.savedAt) > CACHE_TTL) return null;
    return cached.data || null;
  }

  function setCached(query, data) {
    try {
      const cache = readCache();
      cache[query] = { savedAt: Date.now(), data };
      const trimmedEntries = Object.entries(cache)
        .sort((left, right) => Number(right[1].savedAt) - Number(left[1].savedAt))
        .slice(0, MAX_CACHE_ITEMS);
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(trimmedEntries)));
    } catch (_error) {
      // 缓存失败不影响在线查询。
    }
  }

  async function fetchJSON(url, signal) {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal
    });

    if (!response.ok) {
      const error = new Error(`Request failed with status ${response.status}`);
      error.status = response.status;
      throw error;
    }

    return response.json();
  }

  function parseDictionary(payload, fallbackWord) {
    if (!Array.isArray(payload) || !payload.length) return null;
    const entry = payload[0];
    const phonetics = [
      entry.phonetic,
      ...(Array.isArray(entry.phonetics) ? entry.phonetics.map((item) => item.text) : [])
    ].filter(Boolean);
    const uniquePhonetics = [...new Set(phonetics.map((item) => {
      const value = String(item).trim();
      if (!value) return "";
      return value.startsWith("/") || value.startsWith("[") ? value : `/${value}/`;
    }).filter(Boolean))].slice(0, 3);

    const meanings = (Array.isArray(entry.meanings) ? entry.meanings : [])
      .slice(0, 4)
      .map((meaning) => ({
        partOfSpeech: String(meaning.partOfSpeech || "meaning"),
        definitions: (Array.isArray(meaning.definitions) ? meaning.definitions : [])
          .slice(0, 2)
          .map((definition) => ({
            definition: String(definition.definition || "").trim(),
            example: String(definition.example || "").trim()
          }))
          .filter((definition) => definition.definition)
      }))
      .filter((meaning) => meaning.definitions.length);

    return {
      word: String(entry.word || fallbackWord),
      phonetics: uniquePhonetics,
      meanings
    };
  }

  function parseTranslation(payload, query) {
    const translated = String(payload?.responseData?.translatedText || "")
      .replaceAll("&quot;", '"')
      .replaceAll("&#39;", "'")
      .replaceAll("&amp;", "&")
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .trim();
    if (!translated || normalizeQuery(translated) === normalizeQuery(query)) return "";
    return translated;
  }

  async function lookup(value, options) {
    const query = normalizeQuery(value);
    if (!isSupportedQuery(query)) {
      const error = new Error("请输入完整的英文单词或短语");
      error.code = "INVALID_QUERY";
      throw error;
    }

    const cached = getCached(query);
    if (cached) return { ...cached, fromCache: true };

    const signal = options?.signal;
    const dictionaryURL = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(query)}`;
    const translationURL = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(query)}&langpair=en%7Czh-CN`;

    const [dictionaryResponse, translationResponse] = await Promise.allSettled([
      fetchJSON(dictionaryURL, signal),
      fetchJSON(translationURL, signal)
    ]);

    if (signal?.aborted) {
      const error = new DOMException("The request was aborted", "AbortError");
      throw error;
    }

    const dictionary = dictionaryResponse.status === "fulfilled"
      ? parseDictionary(dictionaryResponse.value, query)
      : null;
    const translation = translationResponse.status === "fulfilled"
      ? parseTranslation(translationResponse.value, query)
      : "";

    if (!dictionary && !translation) {
      const bothUnavailable = dictionaryResponse.status === "rejected"
        && translationResponse.status === "rejected"
        && dictionaryResponse.reason?.status !== 404;
      const error = new Error(bothUnavailable ? "在线词典暂时无法连接" : "没有找到这个词");
      error.code = bothUnavailable ? "NETWORK_ERROR" : "NOT_FOUND";
      throw error;
    }

    const result = {
      query,
      word: dictionary?.word || query,
      phonetics: dictionary?.phonetics || [],
      translation,
      meanings: dictionary?.meanings || []
    };

    setCached(query, result);
    return { ...result, fromCache: false };
  }

  window.OnlineDictionary = {
    isSupportedQuery,
    lookup,
    normalizeQuery
  };
})();
