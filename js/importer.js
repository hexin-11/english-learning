(function () {
  "use strict";

  const STORAGE_KEY = "hexin-english-imported-lessons:v1";
  const MAX_FILE_SIZE = 20 * 1024 * 1024;
  const MAX_PDF_PAGES = 30;
  const MAX_OCR_PAGES = 10;
  const MAX_WORDS = 300;
  const MAX_SENTENCES = 220;
  const PDFJS_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs";
  const PDFJS_WORKER_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
  const MAMMOTH_URL = "https://cdn.jsdelivr.net/npm/mammoth@1.9.1/mammoth.browser.min.js";
  const TESSERACT_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
  const ACCEPTED_EXTENSIONS = new Set(["pdf", "docx", "jpg", "jpeg", "png", "webp", "bmp"]);
  const CHINESE_NUMERALS = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

  let pdfModulePromise = null;
  let mammothPromise = null;
  let tesseractPromise = null;
  let activeFile = null;
  let activeRawText = "";
  let activeWarnings = [];
  let options = {};

  function $(selector) {
    return document.querySelector(selector);
  }

  function safeText(value, maxLength) {
    return String(value || "").replace(/\u0000/g, "").trim().slice(0, maxLength);
  }

  function normalizeSpaces(value) {
    return safeText(value, 120000)
      .replace(/\r\n?/g, "\n")
      .replace(/[\u00a0\u2000-\u200b\u202f\u3000]/g, " ")
      .replace(/[ 	]+/g, " ")
      .replace(/\b([A-Za-z]{2,}(?:-[A-Za-z]{2,})?)\s+([a-z])(?=\s*\/[^/]{1,100}\/)/g, "$1$2")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function normalizeIpa(value) {
    const ipa = safeText(value, 120).replace(/^\[|\]$/g, "").replace(/^\/|\/$/g, "").trim();
    return ipa ? `/${ipa}/` : "/音标待补充/";
  }

  function extensionOf(file) {
    return String(file?.name || "").split(".").pop().toLocaleLowerCase("en");
  }

  function baseName(fileName) {
    return safeText(fileName, 180).replace(/\.[^.]+$/, "") || "导入课程";
  }

  function lessonNumberLabel(number) {
    if (number <= 10) return CHINESE_NUMERALS[number];
    if (number < 20) return `十${CHINESE_NUMERALS[number - 10]}`;
    if (number < 100) {
      const tens = Math.floor(number / 10);
      const ones = number % 10;
      return `${CHINESE_NUMERALS[tens]}十${ones ? CHINESE_NUMERALS[ones] : ""}`;
    }
    return String(number);
  }

  function normalizeLesson(candidate) {
    if (!candidate || typeof candidate !== "object" || !String(candidate.id || "").startsWith("imported-")) return null;
    const words = (Array.isArray(candidate.words) ? candidate.words : [])
      .map((word) => ({
        english: safeText(word?.english, 120),
        ipa: safeText(word?.ipa, 120) || "/音标待补充/",
        chinese: safeText(word?.chinese, 240) || "中文释义待补充"
      }))
      .filter((word) => word.english)
      .slice(0, MAX_WORDS);
    const sentences = (Array.isArray(candidate.sentences) ? candidate.sentences : [])
      .map((sentence) => ({
        english: safeText(sentence?.english, 600),
        chinese: safeText(sentence?.chinese, 800) || "中文翻译待补充"
      }))
      .filter((sentence) => sentence.english)
      .slice(0, MAX_SENTENCES);
    const number = Math.max(1, Math.floor(Number(candidate.number) || 1));

    if (!words.length && !sentences.length) return null;
    return {
      id: safeText(candidate.id, 100),
      number,
      title: safeText(candidate.title, 180) || `第${lessonNumberLabel(number)}课`,
      wordSectionTitle: safeText(candidate.wordSectionTitle, 80) || "单词与短语",
      readingTitle: safeText(candidate.readingTitle, 80) || "课文与例句",
      words,
      sentences,
      studyNotes: [],
      imported: true,
      sourceName: safeText(candidate.sourceName, 180),
      importedAt: Number(candidate.importedAt) || Date.now()
    };
  }

  function getLessons() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed.map(normalizeLesson).filter(Boolean).sort((left, right) => left.number - right.number);
    } catch (_error) {
      return [];
    }
  }

  function writeLessons(lessons) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lessons));
    } catch (_error) {
      const error = new Error("浏览器本地空间不足，无法保存这节课。请减少内容后重试。");
      error.code = "STORAGE_FULL";
      throw error;
    }
  }

  function saveLesson(lesson) {
    const normalized = normalizeLesson(lesson);
    if (!normalized) throw new Error("至少需要一个有效单词或英文句子。");
    const existing = getLessons().filter((item) => item.id !== normalized.id);
    existing.push(normalized);
    writeLessons(existing.sort((left, right) => left.number - right.number));
    return normalized;
  }

  function deleteLesson(lessonId) {
    const lessons = getLessons();
    const nextLessons = lessons.filter((lesson) => lesson.id !== lessonId);
    if (nextLessons.length === lessons.length) return false;
    writeLessons(nextLessons);
    return true;
  }

  function loadScript(url, globalName) {
    if (window[globalName]) return Promise.resolve(window[globalName]);
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-import-library="${globalName}"]`);
      if (existing) {
        existing.addEventListener("load", () => resolve(window[globalName]), { once: true });
        existing.addEventListener("error", () => reject(new Error(`${globalName} 加载失败`)), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = url;
      script.async = true;
      script.dataset.importLibrary = globalName;
      script.onload = () => resolve(window[globalName]);
      script.onerror = () => reject(new Error(`${globalName} 加载失败，请检查网络后重试。`));
      document.head.append(script);
    });
  }

  function getPdfModule() {
    if (!pdfModulePromise) {
      pdfModulePromise = import(PDFJS_URL).then((pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
        return pdfjs;
      });
    }
    return pdfModulePromise;
  }

  function getMammoth() {
    if (!mammothPromise) mammothPromise = loadScript(MAMMOTH_URL, "mammoth");
    return mammothPromise;
  }

  function getTesseract() {
    if (!tesseractPromise) tesseractPromise = loadScript(TESSERACT_URL, "Tesseract");
    return tesseractPromise;
  }

  function setStatus(message, detail, progress, state) {
    const status = $("#import-status");
    const messageNode = $("#import-status-message");
    const detailNode = $("#import-status-detail");
    const progressNode = $("#import-progress");
    if (!status) return;
    status.hidden = false;
    status.dataset.state = state || "working";
    messageNode.textContent = message;
    detailNode.textContent = detail || "";
    const value = Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0;
    progressNode.value = value;
    progressNode.setAttribute("value", String(value));
    progressNode.setAttribute("aria-valuetext", `${Math.round(value)}%`);
    progressNode.textContent = `${Math.round(value)}%`;
  }

  function textContentFromPage(textContent) {
    const lines = [];
    let current = [];
    let previousY = null;
    textContent.items.forEach((item) => {
      const value = String(item.str || "").trim();
      if (!value) return;
      const y = Number(item.transform?.[5]);
      if (previousY !== null && Number.isFinite(y) && Math.abs(y - previousY) > 3 && current.length) {
        lines.push(current.join(" "));
        current = [];
      }
      current.push(value);
      if (Number.isFinite(y)) previousY = y;
    });
    if (current.length) lines.push(current.join(" "));
    return lines.join("\n");
  }

  async function createOcrWorker(onProgress) {
    const Tesseract = await getTesseract();
    return Tesseract.createWorker(["eng", "chi_sim"], 1, {
      logger(event) {
        if (event.status === "recognizing text") onProgress?.(event.progress || 0);
      }
    });
  }

  async function ocrPdf(pdf, pageCount) {
    const worker = await createOcrWorker((progress) => {
      setStatus("正在识别扫描版 PDF", "OCR 首次使用需要下载语言模型，请保持联网。", 35 + progress * 50, "working");
    });
    const pageTexts = [];
    try {
      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        setStatus("正在识别扫描版 PDF", `第 ${pageNumber} / ${pageCount} 页`, 30 + ((pageNumber - 1) / pageCount) * 60, "working");
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.65 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d", { alpha: false });
        await page.render({ canvasContext: context, viewport }).promise;
        const result = await worker.recognize(canvas);
        pageTexts.push(result.data.text || "");
        canvas.width = 1;
        canvas.height = 1;
      }
    } finally {
      await worker.terminate();
    }
    return pageTexts.join("\n\n");
  }

  async function extractPdf(file) {
    setStatus("正在读取 PDF", "加载 PDF 解析器…", 8, "working");
    const pdfjs = await getPdfModule();
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjs.getDocument({ data }).promise;
    const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES);
    const pages = [];

    if (pdf.numPages > MAX_PDF_PAGES) activeWarnings.push(`PDF 共 ${pdf.numPages} 页，本次只读取前 ${MAX_PDF_PAGES} 页。`);
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      setStatus("正在提取 PDF 文字", `第 ${pageNumber} / ${pageCount} 页`, 12 + (pageNumber / pageCount) * 50, "working");
      const page = await pdf.getPage(pageNumber);
      pages.push(textContentFromPage(await page.getTextContent()));
    }

    const extracted = normalizeSpaces(pages.join("\n\n"));
    const usefulCharacters = (extracted.match(/[A-Za-z\u3400-\u9fff]/g) || []).length;
    if (usefulCharacters >= 80) {
      activeWarnings.push("PDF 中的多栏排版或表格可能改变文字顺序，请在预览中核对词条和中英句子的对应关系。");
      return extracted;
    }

    const ocrPages = Math.min(pdf.numPages, MAX_OCR_PAGES);
    if (pdf.numPages > MAX_OCR_PAGES) activeWarnings.push(`扫描版 PDF 的 OCR 只识别前 ${MAX_OCR_PAGES} 页。`);
    activeWarnings.push("没有检测到足够的可复制文字，已自动改用 OCR。请在保存前检查识别结果。");
    return normalizeSpaces(await ocrPdf(pdf, ocrPages));
  }

  async function extractDocx(file) {
    setStatus("正在读取 Word", "加载 DOCX 解析器…", 12, "working");
    const mammoth = await getMammoth();
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    if (Array.isArray(result.messages) && result.messages.length) {
      activeWarnings.push("Word 中的复杂表格或文本框可能需要在预览中手动整理。");
    }
    return normalizeSpaces(result.value);
  }

  async function extractImage(file) {
    setStatus("正在识别图片", "加载浏览器 OCR 与中英文语言模型…", 10, "working");
    const worker = await createOcrWorker((progress) => {
      setStatus("正在识别图片", "图片越清晰，自动分段越准确。", 20 + progress * 70, "working");
    });
    try {
      const result = await worker.recognize(file);
      activeWarnings.push("图片文字由 OCR 识别，请在保存前核对拼写、音标和标点。");
      return normalizeSpaces(result.data.text || "");
    } finally {
      await worker.terminate();
    }
  }

  function containsChinese(value) {
    return /[\u3400-\u9fff]/u.test(value);
  }

  function containsEnglish(value) {
    return /[A-Za-z]/.test(value);
  }

  function looksLikeSentence(value) {
    const wordCount = (String(value).match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || []).length;
    const normalized = String(value).trim();
    if (wordCount < 3 || (/^\/[\s\S]+\/$/.test(normalized) && isLikelyIpa(normalized))) return false;
    const abbreviationEnding = /\b(?:sth|sb|etc)\.$/i.test(normalized);
    return wordCount >= 4 || (!abbreviationEnding && /[.!?]["”']?$/.test(normalized));
  }

  function cleanupEnglish(value) {
    return safeText(value, 600)
      .replace(/^\s*(?:\d{1,3}[.)、]|[-•·])\s*/, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanupChinese(value) {
    return safeText(value, 800)
      .replace(/^\s*(?:\d{1,3}[.)、]|[-•·])\s*/, "")
      .replace(/\s+/g, " ")
      .replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/gu, "$1")
      .trim();
  }

  function splitBilingualLine(line) {
    const firstChinese = line.search(/[\u3400-\u9fff]/u);
    if (firstChinese < 1) return null;
    const english = cleanupEnglish(line.slice(0, firstChinese).replace(/[|｜:：\-–—]+$/, ""));
    const chinese = cleanupChinese(line.slice(firstChinese));
    if (!containsEnglish(english) || !containsChinese(chinese) || /[A-Za-z]{2,}/.test(chinese)) return null;
    return { english, chinese };
  }

  function isLikelyIpa(value) {
    const content = String(value || "").replace(/^\[|\]$/g, "").replace(/^\/|\/$/g, "");
    return /[ˈˌəɪʊɑɒɔɛæʌθðʃʒŋɡɜɚɝɹɐɘʧʤː]/u.test(content) || /[:;]/.test(content);
  }

  function extractInlineVocabularyPairs(line) {
    const pairs = [];
    const pattern = /([A-Za-z][A-Za-z'’.\-]*(?:\s+[A-Za-z][A-Za-z'’.\-]*){0,6})\s*([\u3400-\u9fff][\s\S]*?)(?=\s*[A-Za-z][A-Za-z'’.\-]*(?:\s+[A-Za-z][A-Za-z'’.\-]*){0,6}\s*[\u3400-\u9fff]|$)/g;
    let match;
    while ((match = pattern.exec(line)) !== null) {
      const english = cleanupEnglish(match[1]);
      const chinese = cleanupChinese(match[2]);
      if (english && chinese) pairs.push({ english, ipa: pronunciationFor(english), chinese });
    }
    return pairs;
  }

  function extractInlineIpaVocabularyPairs(line) {
    const pairs = [];
    const pattern = /([A-Za-z][A-Za-z'’.\-]*(?:\s+[A-Za-z][A-Za-z'’.\-]*){0,6})\s*(\/[\s\S]{1,100}?\/|\[[^\]]{1,100}\])\s*([\u3400-\u9fff][\s\S]*?)(?=\s*[A-Za-z][A-Za-z'’.\-]*(?:\s+[A-Za-z][A-Za-z'’.\-]*){0,6}\s*(?:\/|\[)|$)/g;
    let match;
    while ((match = pattern.exec(line)) !== null) {
      const english = cleanupEnglish(match[1]);
      const chinese = cleanupChinese(match[3]);
      if (english && chinese && isLikelyIpa(match[2])) {
        pairs.push({ english, ipa: normalizeIpa(match[2]), chinese });
      }
    }
    return pairs;
  }

  function stripInlineGlosses(value) {
    return cleanupEnglish(String(value || "")
      .replace(/[（(]\s*[\u3400-\u9fff][^）)]*[）)]/gu, " ")
      .replace(/[\u3400-\u9fff]+/gu, " ")
      .replace(/[，。；：、]/gu, " ")
      .replace(/\s+/g, " "));
  }

  function splitEnglishSentences(value) {
    const cleaned = stripInlineGlosses(value);
    return (cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleaned])
      .map((part) => cleanupEnglish(part).replace(/^[)）\]】]+\s*/, ""))
      .filter((part) => /^[A-Za-z]/.test(part) && looksLikeSentence(part));
  }

  function splitChineseSentences(value) {
    return (cleanupChinese(value).match(/[^。！？]+[。！？]+|[^。！？]+$/gu) || [])
      .map((part) => cleanupChinese(part))
      .filter(containsChinese);
  }

  function parseVocabularyLine(line) {
    const cleaned = cleanupEnglish(line);
    const ipaMatch = cleaned.match(/^(.*?)\s*(\/[\s\S]{1,100}?\/|\[[^\]]{1,100}\])\s*(.*)$/);
    const ipaEnglish = ipaMatch ? cleanupEnglish(ipaMatch[1]) : "";
    const ipaEnglishWordCount = (ipaEnglish.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || []).length;
    if (ipaMatch
      && ipaEnglishWordCount >= 1
      && ipaEnglishWordCount <= 7
      && !looksLikeSentence(ipaEnglish)
      && containsChinese(ipaMatch[3])
      && !/[A-Za-z]{2,}/.test(ipaMatch[3])) {
      return {
        english: ipaEnglish,
        ipa: isLikelyIpa(ipaMatch[2]) ? normalizeIpa(ipaMatch[2]) : pronunciationFor(ipaEnglish),
        chinese: cleanupChinese(ipaMatch[3])
      };
    }

    const bilingual = splitBilingualLine(cleaned);
    if (!bilingual || looksLikeSentence(bilingual.english)) return null;
    const wordCount = (bilingual.english.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || []).length;
    if (wordCount > 7) return null;
    return { ...bilingual, ipa: pronunciationFor(bilingual.english) };
  }

  function pronunciationFor(word) {
    const normalized = String(word || "").toLocaleLowerCase("en").replaceAll("’", "'");
    return window.WORD_PRONUNCIATIONS?.[normalized]?.ipa || "/音标待补充/";
  }

  function deriveWords(sentences) {
    const stopWords = new Set(["the", "and", "that", "this", "with", "from", "have", "has", "had", "was", "were", "are", "is", "am", "for", "you", "your", "they", "their", "his", "her", "our", "but", "not", "can", "could", "would", "should", "will", "shall", "into", "onto", "about", "there", "here", "what", "when", "where", "which", "who", "why", "how", "than", "then", "them", "these", "those", "been", "being", "does", "did", "doing", "too", "very", "also"]);
    const counts = new Map();
    sentences.forEach((sentence) => {
      (sentence.english.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || []).forEach((token) => {
        const word = token.toLocaleLowerCase("en").replaceAll("’", "'");
        if (word.length < 3 || stopWords.has(word)) return;
        counts.set(word, (counts.get(word) || 0) + 1);
      });
    });
    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "en"))
      .slice(0, 36)
      .map(([english]) => ({ english, ipa: pronunciationFor(english), chinese: "中文释义待补充" }));
  }

  function structureText(rawText) {
    const lines = normalizeSpaces(rawText).split("\n").map((line) => line.trim()).filter(Boolean);
    const words = [];
    const sentences = [];
    const used = new Set();
    const wordKeys = new Set();
    const sentenceKeys = new Set();

    function addWord(word) {
      const english = cleanupEnglish(word.english);
      const key = english.toLocaleLowerCase("en");
      if (!english || !containsEnglish(english) || wordKeys.has(key) || words.length >= MAX_WORDS) return;
      wordKeys.add(key);
      const candidateIpa = !word.ipa || String(word.ipa).includes("待补充") ? pronunciationFor(english) : word.ipa;
      words.push({ english, ipa: normalizeIpa(candidateIpa), chinese: cleanupChinese(word.chinese) || "中文释义待补充" });
    }

    function addSentence(sentence) {
      const english = cleanupEnglish(sentence.english);
      const key = english.toLocaleLowerCase("en");
      if (!english || !containsEnglish(english) || sentenceKeys.has(key) || sentences.length >= MAX_SENTENCES) return;
      sentenceKeys.add(key);
      sentences.push({ english, chinese: cleanupChinese(sentence.chinese) || "中文翻译待补充" });
    }

    for (let index = 0; index < lines.length; index += 1) {
      if (used.has(index)) continue;
      const line = lines[index];
      if (/^(?:page\s*)?\d{1,3}(?:\s*\/\s*\d{1,3})?$/i.test(line)) continue;

      const inlineIpaWords = extractInlineIpaVocabularyPairs(line);
      if (inlineIpaWords.length && inlineIpaWords.every((word) => !looksLikeSentence(word.english))) {
        inlineIpaWords.forEach(addWord);
        used.add(index);
        continue;
      }

      const inlineWords = extractInlineVocabularyPairs(line);
      if (inlineWords.length >= 2 && inlineWords.every((word) => !looksLikeSentence(word.english))) {
        inlineWords.forEach(addWord);
        used.add(index);
        continue;
      }

      const explicitWord = parseVocabularyLine(line);
      if (explicitWord) {
        addWord(explicitWord);
        used.add(index);
        continue;
      }

      const englishOnly = containsEnglish(line) && !containsChinese(line);
      const mixedEnglish = containsEnglish(line) && containsChinese(line);
      const previous = lines[index - 1] || "";
      const next = lines[index + 1] || "";
      const nextNext = lines[index + 2] || "";
      const englishWithIpa = line.match(/^(.*?)\s*(\/[\s\S]{1,120}\/|\[[^\]]{1,120}\])$/);
      if (englishWithIpa && containsEnglish(englishWithIpa[1]) && isLikelyIpa(englishWithIpa[2]) && !looksLikeSentence(englishWithIpa[1])) {
        const hasNextTranslation = containsChinese(next) && !containsEnglish(next);
        addWord({
          english: englishWithIpa[1],
          ipa: englishWithIpa[2],
          chinese: hasNextTranslation ? next : "中文释义待补充"
        });
        used.add(index);
        if (hasNextTranslation) {
          used.add(index + 1);
          index += 1;
        }
        continue;
      }
      const nextIsIpa = /^(?:\/[^/]{1,100}\/|\[[^\]]{1,100}\])$/.test(next);
      if (englishOnly && !looksLikeSentence(line) && nextIsIpa && containsChinese(nextNext)) {
        addWord({ english: line, ipa: next, chinese: nextNext });
        used.add(index);
        used.add(index + 1);
        used.add(index + 2);
        index += 2;
        continue;
      }

      const bilingual = splitBilingualLine(line);
      if (bilingual && looksLikeSentence(bilingual.english)) {
        addSentence(bilingual);
        used.add(index);
        continue;
      }

      const previousIsProseTranslation = containsChinese(previous)
        && !containsEnglish(previous)
        && /[。！？]$/u.test(previous)
        && previous.length >= 12;
      if ((mixedEnglish || englishOnly) && previousIsProseTranslation && !used.has(index - 1)) {
        const englishParts = splitEnglishSentences(line);
        const chineseParts = splitChineseSentences(previous);
        if (englishParts.length) {
          englishParts.forEach((english, sentenceIndex) => addSentence({
            english,
            chinese: chineseParts[sentenceIndex] || (chineseParts.length === 1 ? chineseParts[0] : "中文翻译待补充")
          }));
          used.add(index - 1);
          used.add(index);
          continue;
        }
      }

      if (mixedEnglish && looksLikeSentence(stripInlineGlosses(line))) {
        splitEnglishSentences(line).forEach((english) => addSentence({ english, chinese: "中文翻译待补充" }));
        used.add(index);
        continue;
      }

      if (englishOnly && looksLikeSentence(line) && containsChinese(next) && !containsEnglish(next)) {
        addSentence({ english: line, chinese: next });
        used.add(index);
        used.add(index + 1);
        index += 1;
        continue;
      }
    }

    lines.forEach((line, index) => {
      if (used.has(index) || !containsEnglish(line) || containsChinese(line) || !looksLikeSentence(line)) return;
      splitEnglishSentences(line).forEach((english) => addSentence({ english, chinese: "中文翻译待补充" }));
    });

    if (!words.length && sentences.length) {
      deriveWords(sentences).forEach(addWord);
      activeWarnings.push("未识别到独立词表，已从英文句子中提取高频词；中文释义可在预览中补充。");
    }

    return { words, sentences };
  }

  function rowsToWords(value) {
    return String(value || "").split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
      const parts = line.split("|").map((part) => part.trim());
      return {
        english: parts[0] || "",
        ipa: parts[1] || "/音标待补充/",
        chinese: parts.slice(2).join(" | ") || "中文释义待补充"
      };
    }).filter((word) => containsEnglish(word.english)).slice(0, MAX_WORDS);
  }

  function rowsToSentences(value) {
    return String(value || "").split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
      const parts = line.split("|").map((part) => part.trim());
      return {
        english: parts[0] || "",
        chinese: parts.slice(1).join(" | ") || "中文翻译待补充"
      };
    }).filter((sentence) => containsEnglish(sentence.english)).slice(0, MAX_SENTENCES);
  }

  function renderPreview(structured) {
    const imported = getLessons();
    const staticNumbers = Array.isArray(window.ENGLISH_LESSONS) ? window.ENGLISH_LESSONS.map((lesson) => Number(lesson.number) || 0) : [];
    const nextNumber = Math.max(0, ...staticNumbers, ...imported.map((lesson) => Number(lesson.number) || 0)) + 1;
    $("#import-title").value = `第${lessonNumberLabel(nextNumber)}课 · ${baseName(activeFile.name)}`;
    $("#import-words").value = structured.words.map((word) => `${word.english} | ${word.ipa} | ${word.chinese}`).join("\n");
    $("#import-sentences").value = structured.sentences.map((sentence) => `${sentence.english} | ${sentence.chinese}`).join("\n");
    $("#import-raw-text").value = activeRawText;
    $("#import-preview-counts").textContent = `识别出 ${structured.words.length} 个词条 · ${structured.sentences.length} 个句子`;
    $("#import-warning-list").innerHTML = activeWarnings.length
      ? activeWarnings.map((warning) => `<li>${String(warning).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</li>`).join("")
      : "";
    $("#import-warning-list").hidden = !activeWarnings.length;
    $("#import-preview").hidden = false;
    $("#import-save").dataset.lessonNumber = String(nextNumber);
    setStatus("解析完成，可以检查和修改", "原文件不会保存；只有下面确认后的课程内容会写入浏览器。", 100, "complete");
    $("#import-preview").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetImporter() {
    activeFile = null;
    activeRawText = "";
    activeWarnings = [];
    $("#lesson-file-input").value = "";
    $("#import-preview").hidden = true;
    $("#import-status").hidden = true;
  }

  async function handleFile(file) {
    if (!file) return;
    const fileInput = $("#lesson-file-input");
    if (fileInput) fileInput.value = "";
    const extension = extensionOf(file);
    if (extension === "doc") {
      setStatus("暂不支持旧版 .doc", "请在 Word 中另存为 .docx 后再导入。", 0, "error");
      return;
    }
    if (!ACCEPTED_EXTENSIONS.has(extension)) {
      setStatus("文件格式不支持", "请选择 PDF、DOCX、JPG、PNG、WEBP 或 BMP。", 0, "error");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setStatus("文件超过 20 MB", "请压缩文件或拆分后再导入。", 0, "error");
      return;
    }

    activeFile = file;
    activeWarnings = [];
    $("#import-preview").hidden = true;
    try {
      if (extension === "pdf") activeRawText = await extractPdf(file);
      else if (extension === "docx") activeRawText = await extractDocx(file);
      else activeRawText = await extractImage(file);

      if (!activeRawText || (activeRawText.match(/[A-Za-z\u3400-\u9fff]/g) || []).length < 3) {
        throw new Error("没有识别到足够的中英文文字。请换一张更清晰的图片或检查文件内容。");
      }
      setStatus("正在整理课程结构", "自动匹配词表、音标和中英句子…", 94, "working");
      const structured = structureText(activeRawText);
      if (!structured.words.length && !structured.sentences.length) {
        throw new Error("已读取文字，但暂时无法自动分出词表或英文句子。可尝试排版更清晰的文件。");
      }
      renderPreview(structured);
    } catch (error) {
      const networkHint = /加载失败|fetch|network|importing/i.test(String(error?.message || error));
      setStatus("导入失败", networkHint ? "解析组件未能加载，请检查网络后重试。" : (error?.message || "请检查文件后重试。"), 0, "error");
    }
  }

  function init(initOptions) {
    options = initOptions || {};
    const input = $("#lesson-file-input");
    const dropzone = $("#lesson-dropzone");
    if (!input || !dropzone) return;

    input.addEventListener("change", () => handleFile(input.files?.[0]));
    ["dragenter", "dragover"].forEach((eventName) => {
      dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropzone.classList.add("is-dragging");
      });
    });
    ["dragleave", "drop"].forEach((eventName) => {
      dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropzone.classList.remove("is-dragging");
      });
    });
    dropzone.addEventListener("drop", (event) => handleFile(event.dataTransfer?.files?.[0]));

    $("#import-reset").addEventListener("click", resetImporter);
    $("#import-save").addEventListener("click", () => {
      const number = Math.max(1, Number($("#import-save").dataset.lessonNumber) || 1);
      const lesson = {
        id: `imported-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        number,
        title: $("#import-title").value,
        wordSectionTitle: "单词与短语",
        readingTitle: "课文与例句",
        words: rowsToWords($("#import-words").value),
        sentences: rowsToSentences($("#import-sentences").value),
        studyNotes: [],
        imported: true,
        sourceName: activeFile?.name || "本地文件",
        importedAt: Date.now()
      };
      try {
        const saved = saveLesson(lesson);
        setStatus("课程已保存", "正在打开新生成的课程页面…", 100, "complete");
        options.onSaved?.(saved);
      } catch (error) {
        setStatus("无法保存课程", error.message, 100, "error");
      }
    });
  }

  window.LessonImporter = {
    init,
    getLessons,
    saveLesson,
    deleteLesson,
    structureText
  };
})();
