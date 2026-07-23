(function () {
  "use strict";

  const API_URL = "https://api.openverse.org/v1/images/";
  const CACHE_KEY = "hexin-word-images:v5";
  const CHOICE_KEY = "hexin-word-image-choices:v2";
  const CACHE_TTL = 30 * 24 * 60 * 60 * 1000;
  const REQUEST_TIMEOUT = 6500;
  const MAX_CACHE_ITEMS = 160;
  const MAX_CANDIDATES = 8;

  const VISUAL_SCENES = {
    available: {
      search: "empty chair available seat waiting room",
      queries: ["empty chair", "available seat", "waiting room chairs"],
      anchors: ["empty", "chair", "seat", "waiting", "room"]
    },
    "focus on": { search: "student focused studying desk", anchors: ["student", "studying", "desk", "focus"] },
    seasonal: { search: "seasonal fruit farmers market", anchors: ["seasonal", "fruit", "market", "harvest"] },
    private: { search: "private room closed door", anchors: ["private", "room", "closed", "door"] },
    deal: { search: "business handshake agreement", anchors: ["business", "handshake", "agreement"] },
    "concentrate on": { search: "student concentrating studying desk", anchors: ["student", "studying", "desk", "concentrating"] },
    reputation: { search: "customer five star review service", anchors: ["customer", "review", "service", "star"] },
    technique: { search: "hands teaching practical skill", anchors: ["hands", "teaching", "skill", "practice"] },
    cancellation: { search: "cancelled flight airport passenger", anchors: ["cancelled", "flight", "airport", "passenger"] },
    reasonable: { search: "fair price shopping comparison", anchors: ["fair", "price", "shopping"] },
    inform: { search: "people sharing information conversation", anchors: ["people", "information", "conversation", "talking"] },
    propose: { search: "business proposal meeting presentation", anchors: ["business", "proposal", "meeting", "presentation"] },
    summarize: { search: "student writing summary notes", anchors: ["student", "writing", "summary", "notes"] },
    noticeable: { search: "red umbrella crowd noticeable", anchors: ["red", "umbrella", "crowd"] },
    cause: { search: "domino chain reaction", anchors: ["domino", "chain", "reaction"] },
    quality: { search: "product quality inspection factory", anchors: ["product", "quality", "inspection", "factory"] },
    overall: { search: "project overview team meeting", anchors: ["project", "overview", "team", "meeting"] },
    concern: { search: "worried person thinking", anchors: ["worried", "person", "thinking"] },
    response: { search: "person answering question classroom", anchors: ["person", "answering", "question", "classroom"] },
    proposal: { search: "business proposal team meeting", anchors: ["business", "proposal", "team", "meeting"] },
    representative: { search: "customer service representative office", anchors: ["customer", "service", "representative", "office"] },
    improvement: { search: "home improvement renovation work", anchors: ["home", "improvement", "renovation", "work"] },
    eventually: { search: "road reaching destination journey", anchors: ["road", "destination", "journey"] },
    optional: { search: "menu choices selection", anchors: ["menu", "choices", "selection"] },
    ambitious: { search: "mountain climber reaching summit", anchors: ["mountain", "climber", "summit"] },
    "a great number of": { search: "large crowd many people", anchors: ["large", "crowd", "people"] },
    "have a go at": { search: "beginner trying new activity", anchors: ["beginner", "trying", "activity"] },
    exactly: { search: "precision measuring ruler", anchors: ["precision", "measuring", "ruler"] },
    afterward: { search: "cleaning table after dinner", anchors: ["cleaning", "table", "dinner"] },
    own: { search: "person holding house keys", anchors: ["person", "house", "keys"] }
  };

  const QUERY_OVERRIDES = {
    cookery: "cooking class chef students",
    products: "retail products goods",
    client: "client business meeting",
    specialist: "professional specialist expert",
    calorie: "food calories nutrition",
    recipe: "recipe book cooking food",
    ingredient: "cooking ingredients food",
    vegetarian: "vegetarian food vegetables",
    carnivore: "carnivore animal",
    sharpen: "sharpening pencil",
    sharpener: "pencil sharpener",
    chop: "chopping vegetables",
    barbecue: "barbecue food grill",
    brunch: "brunch food table",
    budget: "budget finance planning",
    buffet: "buffet food restaurant",
    discount: "discount sale shopping",
    entertainment: "entertainment concert audience",
    expense: "expenses receipt money",
    expensive: "expensive luxury price",
    facility: "public facility building",
    leaflet: "printed leaflet flyer",
    perishable: "perishable fresh food",
    resort: "holiday resort hotel",
    slicer: "food slicer kitchen",
    slippery: "slippery wet floor",
    "well-equipped": "well equipped kitchen",
    equipment: "tools equipment",
    chairman: "chairman meeting boardroom",
    committee: "committee meeting people",
    form: "application form document",
    regulation: "rules regulation document",
    "online shopping": "online shopping phone parcel",
    customer: "customer shopping store",
    item: "retail item product",
    "pay for": "payment card shopping",
    product: "retail product goods",
    screen: "computer screen display",
    return: "returning online shopping parcel",
    volume: "box volume measurement",
    survey: "survey questionnaire clipboard",
    resident: "neighborhood residents people",
    visibility: "road visibility fog",
    complaint: "customer complaint service",
    congestion: "traffic congestion road",
    fume: "vehicle exhaust fumes",
    lorry: "lorry truck road",
    council: "city council meeting",
    slide: "presentation slide screen",
    junction: "road junction intersection",
    pedestrian: "pedestrian walking street",
    forbid: "prohibited sign no entry",
    bend: "road bend curve",
    disabled: "wheelchair accessibility",
    arrangement: "calendar schedule planning",
    widen: "road widening construction",
    pavement: "sidewalk pavement street",
    incorporate: "combine pieces together",
    intersection: "road intersection traffic",
    load: "loading cargo truck",
    unload: "unloading cargo truck",
    convert: "building conversion renovation",
    cycling: "cycling bicycle road",
    district: "city district neighborhood",
    drive: "driving car road",
    footpath: "footpath walking trail",
    outskirts: "city outskirts suburb",
    redevelopment: "urban redevelopment construction",
    reorient: "compass change direction",
    "residential area": "residential neighborhood houses",
    shade: "tree shade park",
    shelter: "bus shelter refuge",
    suburb: "suburban neighborhood houses",
    urban: "urban city street",
    vehicle: "road vehicle car",
    germination: "seed germination sprout",
    module: "learning module blocks",
    dissertation: "university dissertation thesis",
    laboratory: "science laboratory",
    assignment: "student assignment homework",
    plates: "dinner plates table",
    "spare time": "leisure free time",
    "prepare meals": "meal preparation cooking",
    dishes: "washing dishes kitchen"
  };

  const NON_VISUAL_TERMS = new Set([
    "in", "on", "at", "for", "since", "however", "hardly", "quite"
  ]);

  const LOW_VALUE_WORDS = new Set(["a", "an", "the", "of", "to", "and", "or", "for", "on", "in", "at"]);
  const BAD_VISUAL_TERMS = /\b(?:logo|icon|clipart|poster|typography|wordmark|screenshot|book cover|album cover|diagram|chart|map|flag)\b/i;
  let memoryCache = readJSON(CACHE_KEY, {});
  let choices = readJSON(CHOICE_KEY, {});
  const pendingRequests = new Map();
  const warmingImages = [];

  function readJSON(key, fallback) {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(key) || "null");
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch (_error) {
      return fallback;
    }
  }

  function normalizeQuery(value) {
    return String(value || "")
      .toLocaleLowerCase("en")
      .replace(/\b(?:sth|sb|someone|something)\b\.?/g, " ")
      .replace(/[^a-z0-9' -]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeInput(value) {
    if (value && typeof value === "object") {
      return {
        english: normalizeQuery(value.english),
        chinese: String(value.chinese || "").trim()
      };
    }
    return { english: normalizeQuery(value), chinese: "" };
  }

  function querySpec(value) {
    const input = normalizeInput(value);
    const english = input.english;
    const compact = english.replace(/\b(?:sth|sb)\b\.?/g, " ").replace(/\s+/g, " ").trim();
    const scene = VISUAL_SCENES[compact];
    const search = scene?.search || QUERY_OVERRIDES[compact] || compact;
    const searchWords = search.split(" ").filter(Boolean);
    const contextualQueries = scene?.queries || [
      searchWords.slice(0, 2).join(" "),
      searchWords.slice(-2).join(" "),
      searchWords.slice(0, 3).join(" ")
    ];
    return {
      key: compact,
      primary: compact,
      search,
      searchQueries: [...new Set((scene ? contextualQueries : [search]).filter(Boolean))],
      anchors: scene?.anchors || [],
      isContextual: Boolean(scene),
      isNonVisual: NON_VISUAL_TERMS.has(compact),
      chinese: input.chinese
    };
  }

  function safeHttpUrl(value) {
    try {
      const url = new URL(String(value || ""));
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
    } catch (_error) {
      return "";
    }
  }

  function saveCaches() {
    const entries = Object.entries(memoryCache)
      .sort((left, right) => Number(right[1]?.savedAt || 0) - Number(left[1]?.savedAt || 0))
      .slice(0, MAX_CACHE_ITEMS);
    memoryCache = Object.fromEntries(entries);
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(memoryCache));
      window.localStorage.setItem(CHOICE_KEY, JSON.stringify(choices));
      window.dispatchEvent(new CustomEvent("hexin:data-changed", { detail: { key: CHOICE_KEY } }));
    } catch (_error) {
      // 存储不可用时，仍在当前页面会话中缓存。
    }
  }

  function cachedCandidates(key) {
    const cached = memoryCache[key];
    if (!cached || Date.now() - Number(cached.savedAt || 0) > CACHE_TTL) return undefined;
    return Array.isArray(cached.candidates) ? cached.candidates : [];
  }

  function licenseLabel(result) {
    const license = String(result.license || "").toUpperCase();
    const version = String(result.license_version || "").trim();
    if (!license) return "开放许可";
    if (license === "PDM") return "公有领域";
    if (license === "CC0") return "CC0";
    return `CC ${license}${version ? ` ${version}` : ""}`;
  }

  function searchableMetadata(result) {
    const tags = (Array.isArray(result?.tags) ? result.tags : [])
      .map((tag) => typeof tag === "string" ? tag : tag?.name)
      .filter(Boolean)
      .join(" ");
    return normalizeQuery(`${result?.title || ""} ${tags}`);
  }

  function tokenVariants(token) {
    const values = new Set([token]);
    if (token.length > 5 && token.endsWith("ies")) values.add(`${token.slice(0, -3)}y`);
    if (token.length > 4 && token.endsWith("s")) values.add(token.slice(0, -1));
    if (token.length > 6 && token.endsWith("ing")) values.add(token.slice(0, -3));
    if (token.length > 5 && token.endsWith("ed")) values.add(token.slice(0, -2));
    return [...values];
  }

  function hasToken(metadataTokens, token) {
    return tokenVariants(token).some((variant) => metadataTokens.has(variant));
  }

  function relevanceScore(result, spec) {
    if (result?.mature === true || !result?.thumbnail) return -1000;
    const title = normalizeQuery(result.title);
    const metadata = searchableMetadata(result);
    if (BAD_VISUAL_TERMS.test(`${result.title || ""} ${metadata}`)) return -1000;
    const titleTokens = new Set(title.split(" ").filter(Boolean));
    const metadataTokens = new Set(metadata.split(" ").filter(Boolean));
    const primaryTokens = spec.primary.split(" ").filter((token) => token.length > 2 && !LOW_VALUE_WORDS.has(token));
    const searchTokens = spec.search.split(" ").filter((token) => token.length > 2 && !LOW_VALUE_WORDS.has(token));
    const anchorTokens = (spec.anchors || []).filter((token) => token.length > 2);
    const primaryHits = primaryTokens.filter((token) => hasToken(metadataTokens, token)).length;
    const titleHits = primaryTokens.filter((token) => hasToken(titleTokens, token)).length;
    const contextHits = searchTokens.filter((token) => hasToken(metadataTokens, token)).length;
    const anchorHits = anchorTokens.filter((token) => hasToken(metadataTokens, token)).length;
    let score = primaryHits * 13 + titleHits * 9 + contextHits * 5;

    if (spec.primary.length > 3 && title.includes(spec.primary)) score += 28;
    if (spec.search.length > 3 && metadata.includes(spec.search)) score += 12;
    if (primaryTokens.length && primaryHits === primaryTokens.length) score += 14;
    if (spec.isContextual) {
      score += anchorHits * 7;
      if (anchorHits >= 2) score += 14;
      if (anchorHits < 2) score -= 42;
    } else if (!primaryHits && contextHits >= 2) score += 10;
    else if (!primaryHits && contextHits < 2) score -= 28;
    if (/\b(?:no|not|without|missing|unavailable)\b/i.test(result.title || "")
      && !/\b(?:no|not|without|missing|unavailable)\b/i.test(spec.primary)) score -= 16;
    if (Number(result.width) >= 640 && Number(result.height) >= 420) score += 3;
    if (Number(result.width) < 260 || Number(result.height) < 180) score -= 8;
    return score;
  }

  function normalizeImage(result, score, spec) {
    const thumbnail = safeHttpUrl(result.thumbnail);
    if (!thumbnail) return null;
    return {
      thumbnail,
      landingUrl: safeHttpUrl(result.foreign_landing_url),
      title: String(result.title || "参考图片").trim(),
      creator: String(result.creator || "Openverse contributor").trim(),
      license: licenseLabel(result),
      source: String(result.source || "Openverse").trim(),
      score,
      matchType: spec.isContextual ? "scene" : "direct"
    };
  }

  function uniqueCandidates(candidates) {
    const seen = new Set();
    return candidates.filter((candidate) => {
      const keys = [candidate.thumbnail, candidate.landingUrl].filter(Boolean);
      if (!keys.length || keys.some((key) => seen.has(key))) return false;
      keys.forEach((key) => seen.add(key));
      return true;
    });
  }

  async function fetchWithTimeout(url, externalSignal) {
    const controller = new AbortController();
    const abortFromOutside = () => controller.abort();
    if (externalSignal?.aborted) controller.abort();
    else externalSignal?.addEventListener("abort", abortFromOutside, { once: true });
    const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    try {
      return await window.fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal
      });
    } finally {
      window.clearTimeout(timer);
      externalSignal?.removeEventListener("abort", abortFromOutside);
    }
  }

  async function candidatesFor(value, options = {}) {
    const spec = querySpec(value);
    if (!spec.key || spec.isNonVisual) return { spec, candidates: [] };

    const cached = cachedCandidates(spec.key);
    if (cached !== undefined) return { spec, candidates: cached };

    if (pendingRequests.has(spec.key)) {
      const candidates = await pendingRequests.get(spec.key);
      return { spec, candidates };
    }

    const request = (async () => {
      const collectedResults = [];
      const fetchSearchResults = async (searchQuery) => {
        const url = new URL(API_URL);
        url.searchParams.set("q", searchQuery);
        url.searchParams.set("page_size", spec.isContextual ? "24" : "20");
        url.searchParams.set("mature", "false");

        const response = await fetchWithTimeout(url.href, options.signal);
        if (!response.ok) throw new Error(`Openverse request failed: ${response.status}`);
        const payload = await response.json();
        return Array.isArray(payload.results) ? payload.results : [];
      };
      const viableCount = () => uniqueCandidates(collectedResults
          .map((result) => ({ result, score: relevanceScore(result, spec) }))
          .filter((item) => item.score >= (spec.isContextual ? 24 : 18))
          .map((item) => normalizeImage(item.result, item.score, spec))
          .filter(Boolean)).length;

      const [firstQuery, ...fallbackQueries] = spec.searchQueries;
      collectedResults.push(...await fetchSearchResults(firstQuery));
      if (spec.isContextual && viableCount() < 4 && fallbackQueries.length) {
        const fallbackResponses = await Promise.allSettled(fallbackQueries.map(fetchSearchResults));
        fallbackResponses.forEach((response) => {
          if (response.status === "fulfilled") collectedResults.push(...response.value);
        });
      }

      const scored = collectedResults
        .map((result) => ({ result, score: relevanceScore(result, spec) }))
        .filter((item) => item.score >= (spec.isContextual ? 24 : 18))
        .sort((left, right) => right.score - left.score)
        .map((item) => normalizeImage(item.result, item.score, spec))
        .filter(Boolean);
      const candidates = uniqueCandidates(scored).slice(0, MAX_CANDIDATES);
      memoryCache[spec.key] = { savedAt: Date.now(), candidates };
      saveCaches();
      return candidates;
    })();

    pendingRequests.set(spec.key, request);
    try {
      return { spec, candidates: await request };
    } finally {
      if (pendingRequests.get(spec.key) === request) pendingRequests.delete(spec.key);
    }
  }

  function selectedCandidate(spec, candidates, advance) {
    if (!candidates.length) return null;
    const savedChoice = String(choices[spec.key] || "");
    let index = candidates.findIndex((candidate) => (candidate.landingUrl || candidate.thumbnail) === savedChoice);
    if (index < 0) index = 0;
    if (advance && candidates.length > 1) index = (index + 1) % candidates.length;
    const choiceValue = candidates[index].landingUrl || candidates[index].thumbnail;
    if (choices[spec.key] !== choiceValue) {
      choices[spec.key] = choiceValue;
      saveCaches();
    }
    return { ...candidates[index], candidateCount: candidates.length, choiceIndex: index };
  }

  async function find(value, options = {}) {
    const { spec, candidates } = await candidatesFor(value, options);
    return selectedCandidate(spec, candidates, false);
  }

  async function next(value, options = {}) {
    const { spec, candidates } = await candidatesFor(value, options);
    return selectedCandidate(spec, candidates, true);
  }

  async function preload(value) {
    try {
      const result = await find(value);
      if (!result?.thumbnail) return;
      const image = new Image();
      image.decoding = "async";
      image.src = result.thumbnail;
      warmingImages.push(image);
      if (warmingImages.length > 8) warmingImages.shift();
    } catch (_error) {
      // 预加载失败不影响当前卡片。
    }
  }

  window.WordImages = { find, next, preload };
})();
