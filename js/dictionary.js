(function () {
  "use strict";

  const CACHE_KEY = "hexin-english-dictionary-cache:v3";
  const CACHE_TTL = 30 * 24 * 60 * 60 * 1000;
  const MAX_CACHE_ITEMS = 80;
  const MAX_PARTS_OF_SPEECH = 8;
  const MAX_DEFINITIONS_PER_PART = 6;
  const TRANSLATION_SEPARATOR = " ||| ";
  const MAX_TRANSLATION_CHARS = 450;

  function normalizeQuery(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[\u2018\u2019]/g, "'")
      .toLocaleLowerCase("en");
  }

  function isSupportedQuery(value) {
    const query = normalizeQuery(value);
    return query.length >= 2
      && query.length <= 60
      && /^[a-z][a-z' -]*$/i.test(query);
  }

  function isSingleWord(value) {
    return /^[a-z][a-z'-]*$/i.test(normalizeQuery(value));
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

  function normalizePhonetic(value) {
    const phonetic = String(value || "").trim();
    if (!phonetic) return "";
    return phonetic.startsWith("/") || phonetic.startsWith("[") ? phonetic : `/${phonetic}/`;
  }

  function collectMeanings(entries) {
    const groupedMeanings = new Map();
    entries.forEach((entry) => {
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
    });
    return [...groupedMeanings].map(([partOfSpeech, definitions]) => ({ partOfSpeech, definitions }));
  }

  function parseDictionary(payload, fallbackWord) {
    if (!Array.isArray(payload) || !payload.length) return null;
    const normalizedFallback = normalizeQuery(fallbackWord);
    const exactEntries = payload.filter((entry) => normalizeQuery(entry?.word) === normalizedFallback);
    if (!exactEntries.length) return null;
    const entries = exactEntries;
    const phonetics = entries.flatMap((entry) => [
      entry?.phonetic,
      ...(Array.isArray(entry?.phonetics) ? entry.phonetics.map((item) => item?.text) : [])
    ]);
    const uniquePhonetics = [...new Set(phonetics.map(normalizePhonetic).filter(Boolean))].slice(0, 3);
    const meanings = collectMeanings(entries);
    if (!meanings.length) return null;

    return {
      word: String(entries[0]?.word || fallbackWord),
      phonetics: uniquePhonetics,
      meanings,
      source: "free-dictionary"
    };
  }

  const DATAMUSE_PARTS_OF_SPEECH = {
    n: "noun",
    v: "verb",
    adj: "adjective",
    adv: "adverb",
    u: "other"
  };

  function parseDatamuse(payload, query) {
    const items = Array.isArray(payload) ? payload.filter((item) => item?.word) : [];
    const normalizedQuery = normalizeQuery(query);
    const exact = items.find((item) => normalizeQuery(item.word) === normalizedQuery) || null;
    const groupedMeanings = new Map();

    (Array.isArray(exact?.defs) ? exact.defs : []).forEach((rawDefinition) => {
      const [tag, ...definitionParts] = String(rawDefinition).split("\t");
      const definition = definitionParts.join(" ").trim();
      if (!definition) return;
      const partOfSpeech = DATAMUSE_PARTS_OF_SPEECH[tag] || tag || "meaning";
      const current = groupedMeanings.get(partOfSpeech) || [];
      if (current.length >= MAX_DEFINITIONS_PER_PART) return;
      if (current.some((item) => item.definition.toLocaleLowerCase("en") === definition.toLocaleLowerCase("en"))) return;
      current.push({ definition, chinese: "", example: "" });
      groupedMeanings.set(partOfSpeech, current);
    });

    const pronunciationTag = (Array.isArray(exact?.tags) ? exact.tags : [])
      .find((tag) => String(tag).startsWith("pron:"));
    const pronunciation = pronunciationTag ? normalizePhonetic(String(pronunciationTag).slice(5)) : "";
    const suggestions = [...new Set(items
      .map((item) => normalizeQuery(item.word))
      .filter((word) => word && word !== normalizedQuery))].slice(0, 5);

    return {
      entry: exact && groupedMeanings.size ? {
        word: String(exact.word),
        phonetics: pronunciation ? [pronunciation] : [],
        meanings: [...groupedMeanings].map(([partOfSpeech, definitions]) => ({ partOfSpeech, definitions })),
        source: "datamuse"
      } : null,
      baseForm: normalizeQuery(exact?.defHeadword),
      suggestions
    };
  }

  function baseFormCandidates(query) {
    if (!isSingleWord(query)) return [];
    const candidates = [];
    const add = (candidate) => {
      const normalized = normalizeQuery(candidate);
      if (normalized.length >= 2 && normalized !== query && !candidates.includes(normalized)) candidates.push(normalized);
    };
    const undouble = (stem) => /([b-df-hj-np-tv-z])\1$/i.test(stem) ? stem.slice(0, -1) : stem;

    if (query.endsWith("ies") && query.length > 4) add(`${query.slice(0, -3)}y`);
    if (query.endsWith("ied") && query.length > 4) add(`${query.slice(0, -3)}y`);
    if (query.endsWith("ing") && query.length > 5) {
      const stem = query.slice(0, -3);
      add(stem);
      add(undouble(stem));
      add(`${stem}e`);
    }
    if (query.endsWith("ed") && query.length > 4) {
      const stem = query.slice(0, -2);
      add(stem);
      add(undouble(stem));
      add(`${stem}e`);
    }
    if (query.endsWith("es") && query.length > 4) add(query.slice(0, -2));
    if (query.endsWith("s") && !query.endsWith("ss") && query.length > 3) add(query.slice(0, -1));
    return candidates.slice(0, 4);
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
    const definitions = meanings.flatMap((meaning, meaningIndex) => meaning.definitions.map((definition, definitionIndex) => ({
      meaningIndex,
      definitionIndex,
      text: definition.definition
    })));
    const chunks = [];
    definitions.forEach((definition) => {
      const current = chunks.at(-1);
      const currentLength = current?.reduce((total, item) => total + item.text.length, 0) || 0;
      const separatorsLength = current?.length ? TRANSLATION_SEPARATOR.length * current.length : 0;
      if (!current || currentLength + separatorsLength + definition.text.length > MAX_TRANSLATION_CHARS) chunks.push([definition]);
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
    if (signal?.aborted) throw new DOMException("The request was aborted", "AbortError");
    return translatedMeanings;
  }

  async function fetchDictionary(word, signal) {
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
    try {
      return parseDictionary(await fetchJSON(url, signal), word);
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      if (error?.status === 404) return null;
      throw error;
    }
  }

  async function fetchTranslation(text, signal) {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en%7Czh-CN`;
    try {
      return parseTranslation(await fetchJSON(url, signal), text);
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      return "";
    }
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
    const datamuseURL = `https://api.datamuse.com/words?sp=${encodeURIComponent(query)}&md=dprf&ipa=1&max=8`;
    const [dictionaryResponse, translationResponse, datamuseResponse] = await Promise.allSettled([
      fetchDictionary(query, signal),
      fetchTranslation(query, signal),
      isSingleWord(query) ? fetchJSON(datamuseURL, signal) : Promise.resolve([])
    ]);

    if (signal?.aborted) throw new DOMException("The request was aborted", "AbortError");

    let dictionary = dictionaryResponse.status === "fulfilled" ? dictionaryResponse.value : null;
    let translation = translationResponse.status === "fulfilled" ? translationResponse.value : "";
    const datamuse = parseDatamuse(datamuseResponse.status === "fulfilled" ? datamuseResponse.value : [], query);
    let resolvedFrom = "";

    if (!dictionary && datamuse.entry) dictionary = datamuse.entry;

    if (!dictionary && isSingleWord(query)) {
      const candidates = [datamuse.baseForm, ...baseFormCandidates(query)]
        .filter((candidate, index, list) => candidate && candidate !== query && list.indexOf(candidate) === index);
      for (const candidate of candidates) {
        dictionary = await fetchDictionary(candidate, signal);
        if (dictionary) {
          resolvedFrom = query;
          if (dictionary.word !== query) translation = await fetchTranslation(dictionary.word, signal) || translation;
          break;
        }
      }
    }

    if (!dictionary && isSingleWord(query)) {
      const networkUnavailable = dictionaryResponse.status === "rejected" && datamuseResponse.status === "rejected";
      const error = new Error(networkUnavailable ? "在线词典暂时无法连接" : "没有找到这个词");
      error.code = networkUnavailable ? "NETWORK_ERROR" : "NOT_FOUND";
      error.suggestions = datamuse.suggestions;
      throw error;
    }

    if (!dictionary && !translation) {
      const error = new Error("在线词典暂时无法连接");
      error.code = "NETWORK_ERROR";
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
      meanings,
      resolvedFrom,
      source: dictionary?.source || "translation"
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
