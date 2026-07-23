(function () {
  "use strict";

  const CACHE_KEY = "hexin-english-dictionary-cache:v2";
  const CACHE_TTL = 30 * 24 * 60 * 60 * 1000;
  const MAX_CACHE_ITEMS = 80;
  const MAX_PARTS_OF_SPEECH = 6;
  const MAX_DEFINITIONS_PER_PART = 5;
  const TRANSLATION_SEPARATOR = " ||| ";
  const MAX_TRANSLATION_CHARS = 450;

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

    const groupedMeanings = new Map();
    (Array.isArray(entry.meanings) ? entry.meanings : []).forEach((meaning) => {
      const partOfSpeech = String(meaning.partOfSpeech || "meaning").trim().toLocaleLowerCase("en");
      if (!groupedMeanings.has(partOfSpeech) && groupedMeanings.size >= MAX_PARTS_OF_SPEECH) return;
      const current = groupedMeanings.get(partOfSpeech) || [];
      const seenDefinitions = new Set(current.map((item) => item.definition.toLocaleLowerCase("en")));
      (Array.isArray(meaning.definitions) ? meaning.definitions : []).forEach((definition) => {
        const definitionText = String(definition.definition || "").trim();
        const normalized = definitionText.toLocaleLowerCase("en");
        if (!definitionText || seenDefinitions.has(normalized) || current.length >= MAX_DEFINITIONS_PER_PART) return;
        seenDefinitions.add(normalized);
        current.push({
          definition: definitionText,
          chinese: "",
          example: String(definition.example || "").trim()
        });
      });
      if (current.length) groupedMeanings.set(partOfSpeech, current);
    });
    const meanings = [...groupedMeanings].map(([partOfSpeech, definitions]) => ({
      partOfSpeech,
      definitions
    }));

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

  function translationChunks(meanings) {
    const definitions = meanings.flatMap((meaning, meaningIndex) => {
      return meaning.definitions.map((definition, definitionIndex) => ({
        meaningIndex,
        definitionIndex,
        text: definition.definition
      }));
    });
    const chunks = [];
    definitions.forEach((definition) => {
      const current = chunks.at(-1);
      const nextLength = (current?.length ? current.reduce((total, item) => total + item.text.length, 0) + TRANSLATION_SEPARATOR.length * current.length : 0)
        + definition.text.length;
      if (!current || nextLength > MAX_TRANSLATION_CHARS) chunks.push([definition]);
      else current.push(definition);
    });
    return chunks;
  }

  async function attachChineseDefinitions(meanings, signal) {
    if (!meanings.length) return meanings;
    const translatedMeanings = meanings.map((meaning) => ({
      ...meaning,
      definitions: meaning.definitions.map((definition) => ({ ...definition }))
    }));
    const chunks = translationChunks(translatedMeanings);
    await Promise.allSettled(chunks.map(async (chunk) => {
      try {
        const joined = chunk.map((item) => item.text).join(TRANSLATION_SEPARATOR);
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(joined)}&langpair=en%7Czh-CN`;
        const payload = await fetchJSON(url, signal);
        const translated = parseTranslation(payload, joined);
        const parts = translated.split(/\s*\|\|\|\s*/).map((item) => item.trim()).filter(Boolean);
        if (parts.length === chunk.length) {
          chunk.forEach((item, index) => {
            translatedMeanings[item.meaningIndex].definitions[item.definitionIndex].chinese = parts[index];
          });
          return;
        }
      } catch (error) {
        if (error?.name === "AbortError") throw error;
      }

      await Promise.allSettled(chunk.map(async (item) => {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(item.text)}&langpair=en%7Czh-CN`;
        const payload = await fetchJSON(url, signal);
        translatedMeanings[item.meaningIndex].definitions[item.definitionIndex].chinese = parseTranslation(payload, item.text);
      }));
    }));
    if (signal?.aborted) {
      const error = new DOMException("The request was aborted", "AbortError");
      throw error;
    }
    return translatedMeanings;
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

    const meanings = dictionary?.meanings?.length
      ? await attachChineseDefinitions(dictionary.meanings, signal)
      : [];
    const result = {
      query,
      word: dictionary?.word || query,
      phonetics: dictionary?.phonetics || [],
      translation,
      meanings
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
