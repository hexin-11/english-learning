(function () {
  "use strict";

  const speechState = {
    voices: [],
    voiceSelect: null,
    voiceLabel: null,
    reloadButton: null,
    accentInputs: [],
    rateInput: null,
    rateOutput: null,
    status: null,
    stopButton: null,
    retryTimers: [],
    utterance: null
  };

  function t(key, variables) {
    return window.SiteI18n?.t?.(key, variables) || key;
  }

  function setStatus(message) {
    if (speechState.status) speechState.status.textContent = message;
  }

  function getAccent() {
    const checked = speechState.accentInputs.find((input) => input.checked);
    return checked ? checked.value : "en-US";
  }

  function englishVoices() {
    const synth = window.speechSynthesis;
    if (!synth) return [];

    const seen = new Set();
    return synth.getVoices()
      .filter((voice) => typeof voice.lang === "string" && voice.lang.toLowerCase().startsWith("en"))
      .filter((voice) => {
        const key = voice.voiceURI || `${voice.name}|${voice.lang}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((left, right) => {
        if (left.default !== right.default) return left.default ? -1 : 1;
        return `${left.lang} ${left.name}`.localeCompare(`${right.lang} ${right.name}`, "en");
      });
  }

  function normalizeLanguageTag(language) {
    return String(language || "")
      .trim()
      .replace(/_/g, "-")
      .toLowerCase();
  }

  function isNoveltyVoice(voice) {
    const name = String(voice?.name || "").toLowerCase();
    return /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox)\b/.test(name);
  }

  function naturalVoiceScore(voice) {
    const name = String(voice?.name || "").toLowerCase();
    let score = 0;
    if (voice?.default) score += 100;
    if (/natural|neural|premium|enhanced/.test(name)) score += 50;
    if (/google|microsoft|samantha|daniel|ava|allison|susan|alex|tom/.test(name)) score += 25;
    if (voice?.localService) score += 5;
    if (isNoveltyVoice(voice)) score -= 1000;
    return score;
  }

  function voicesForAccent(accent) {
    const normalized = normalizeLanguageTag(accent);
    const exact = speechState.voices.filter((voice) => normalizeLanguageTag(voice.lang) === normalized);
    if (exact.length) return exact;

    const language = normalized.split("-")[0];
    const sameLanguage = speechState.voices.filter((voice) => normalizeLanguageTag(voice.lang).startsWith(`${language}-`));
    return sameLanguage.length ? sameLanguage : speechState.voices;
  }

  function preferredAccentVoice(accent) {
    const normalizedAccent = normalizeLanguageTag(accent);
    const exact = speechState.voices
      .filter((voice) => normalizeLanguageTag(voice.lang) === normalizedAccent)
      .sort((left, right) => naturalVoiceScore(right) - naturalVoiceScore(left));
    if (!exact.length) return null;

    const selected = selectedVoice();
    if (selected
      && normalizeLanguageTag(selected.lang) === normalizedAccent
      && !isNoveltyVoice(selected)) {
      return selected;
    }

    return exact[0] || null;
  }

  function preferredVoice(voices, accent, savedURI) {
    const saved = savedURI ?? window.LearningStorage.getState().settings.voiceURI;
    return voices.find((voice) => voice.voiceURI === saved)
      || voices.find((voice) => voice.lang.toLowerCase() === accent.toLowerCase() && voice.default)
      || voices.find((voice) => voice.lang.toLowerCase() === accent.toLowerCase())
      || voices.find((voice) => voice.default)
      || voices[0]
      || null;
  }

  function updateVoiceLabel() {
    if (!speechState.voiceLabel) return;
    speechState.voiceLabel.textContent = speechState.voices.length
      ? t("speech.voiceCount", { count: speechState.voices.length })
      : t("speech.voice");
  }

  function renderVoiceOptions() {
    if (!speechState.voiceSelect) return;

    const previousURI = speechState.voiceSelect.value;
    const settings = window.LearningStorage.getState().settings;
    const requestedURI = settings.voiceURI || previousURI;
    const selectedVoice = preferredVoice(speechState.voices, settings.accent, requestedURI);

    speechState.voiceSelect.replaceChildren();

    if (!speechState.voices.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = t("speech.defaultVoice", { accent: getAccent() });
      speechState.voiceSelect.append(option);
      updateVoiceLabel();
      return;
    }

    speechState.voices.forEach((voice) => {
      const option = document.createElement("option");
      option.value = voice.voiceURI;
      option.textContent = `${voice.name} (${voice.lang})${voice.default ? ` · ${t("speech.defaultMark")}` : ""}`;
      option.selected = Boolean(selectedVoice && voice.voiceURI === selectedVoice.voiceURI);
      speechState.voiceSelect.append(option);
    });

    updateVoiceLabel();
    if (selectedVoice && settings.voiceURI !== selectedVoice.voiceURI) {
      window.LearningStorage.updateSettings({ voiceURI: selectedVoice.voiceURI });
    }
  }

  function loadVoices(options = {}) {
    if (!window.speechSynthesis || !speechState.voiceSelect) return 0;

    const nextVoices = englishVoices();
    if (nextVoices.length) speechState.voices = nextVoices;
    renderVoiceOptions();

    if (options.announce) {
      setStatus(speechState.voices.length
        ? `已载入 ${speechState.voices.length} 个英语声音，点击列表即可选择`
        : "系统声音仍在载入，请稍后再点一次刷新");
    }

    return speechState.voices.length;
  }

  function clearVoiceRetries() {
    speechState.retryTimers.forEach((timer) => window.clearTimeout(timer));
    speechState.retryTimers = [];
  }

  function scheduleVoiceLoads(announce = false) {
    clearVoiceRetries();
    const delays = [0, 120, 500, 1200, 2500, 5000];
    speechState.retryTimers = delays.map((delay, index) => window.setTimeout(() => {
      const count = loadVoices({ announce: announce && index === delays.length - 1 });
      if (count) clearVoiceRetries();
    }, delay));
  }

  function selectedVoice() {
    const selectedURI = speechState.voiceSelect?.value;
    return speechState.voices.find((voice) => voice.voiceURI === selectedURI) || null;
  }

  function getVoice(accentOverride) {
    if (!accentOverride) {
      return selectedVoice() || preferredVoice(speechState.voices, getAccent());
    }

    return preferredAccentVoice(accentOverride);
  }

  function accentName(lang) {
    const normalized = String(lang || "").toLowerCase();
    if (normalized === "en-gb") return t("speech.uk");
    if (normalized === "en-us") return t("speech.us");
    if (normalized === "en-au") return t("speech.accentAU");
    return t("speech.accentEnglish");
  }

  function speak(text, accentOverride) {
    const content = String(text || "").trim();
    if (!content) return;

    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      setStatus("当前浏览器不支持朗读");
      return;
    }

    loadVoices();
    const requestedAccent = accentOverride === "en-GB" || accentOverride === "en-US"
      ? accentOverride
      : null;
    const voice = getVoice(requestedAccent);
    const fallbackAccent = requestedAccent || getAccent();
    const rate = Number(speechState.rateInput ? speechState.rateInput.value : 0.8);
    const utterance = new SpeechSynthesisUtterance(content);

    window.speechSynthesis.cancel();
    utterance.lang = voice ? String(voice.lang).replace(/_/g, "-") : fallbackAccent;
    utterance.rate = Number.isFinite(rate) ? rate : 0.8;
    utterance.pitch = 1;
    utterance.volume = 1;
    if (voice) utterance.voice = voice;

    speechState.utterance = utterance;
    const voiceDescription = voice ? `${voice.name}（${voice.lang}）` : `${accentName(utterance.lang)}系统声音`;
    utterance.addEventListener("start", () => setStatus(`正在使用 ${voiceDescription} 朗读：${content}`));
    utterance.addEventListener("end", () => {
      if (speechState.utterance === utterance) speechState.utterance = null;
      setStatus("朗读完成，可以继续点击英文");
    });
    utterance.addEventListener("error", (event) => {
      if (speechState.utterance === utterance) speechState.utterance = null;
      if (event.error !== "canceled" && event.error !== "interrupted") {
        setStatus("朗读未能开始，请刷新声音列表后重试");
      }
    });

    window.speechSynthesis.resume?.();
    window.speechSynthesis.speak(utterance);
  }

  function stop() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    speechState.utterance = null;
    setStatus("朗读已停止");
  }

  function setAccent(accent) {
    const normalizedAccent = accent === "en-GB" ? "en-GB" : "en-US";
    speechState.accentInputs.forEach((input) => {
      input.checked = input.value === normalizedAccent;
    });

    loadVoices();
    const voice = preferredVoice(voicesForAccent(normalizedAccent), normalizedAccent, "");
    if (voice && speechState.voiceSelect) speechState.voiceSelect.value = voice.voiceURI;

    window.LearningStorage.updateSettings({
      accent: normalizedAccent,
      voiceURI: voice ? voice.voiceURI : ""
    });
    setStatus(normalizedAccent === "en-GB" ? "已切换为英式发音" : "已切换为美式发音");
  }

  function handleVoiceSelection() {
    const voice = selectedVoice();
    if (!voice) {
      window.LearningStorage.updateSettings({ voiceURI: "" });
      setStatus("将使用系统默认英语声音");
      return;
    }

    const normalizedLang = voice.lang.toLowerCase();
    const matchingAccent = normalizedLang === "en-gb" ? "en-GB" : normalizedLang === "en-us" ? "en-US" : null;
    if (matchingAccent) {
      speechState.accentInputs.forEach((input) => {
        input.checked = input.value === matchingAccent;
      });
    }

    window.LearningStorage.updateSettings({
      voiceURI: voice.voiceURI,
      ...(matchingAccent ? { accent: matchingAccent } : {})
    });
    setStatus(`已选择 ${voice.name}（${voice.lang}），点击英文可试听`);
  }

  function init(options) {
    speechState.voiceSelect = options.voiceSelect;
    speechState.voiceLabel = options.voiceLabel;
    speechState.reloadButton = options.reloadButton;
    speechState.accentInputs = [...(options.accentInputs || [])];
    speechState.rateInput = options.rateInput;
    speechState.rateOutput = options.rateOutput;
    speechState.status = options.status;
    speechState.stopButton = options.stopButton;

    const settings = window.LearningStorage.getState().settings;
    speechState.rateInput.value = String(settings.rate);
    speechState.rateOutput.value = `${settings.rate.toFixed(1)}×`;
    speechState.rateOutput.textContent = `${settings.rate.toFixed(1)}×`;
    speechState.accentInputs.forEach((input) => {
      input.checked = input.value === settings.accent;
    });

    if (!("speechSynthesis" in window)) {
      speechState.voiceSelect.disabled = true;
      speechState.rateInput.disabled = true;
      speechState.stopButton.disabled = true;
      if (speechState.reloadButton) speechState.reloadButton.disabled = true;
      speechState.accentInputs.forEach((input) => { input.disabled = true; });
      speechState.voiceSelect.innerHTML = `<option>${t("speech.unsupportedSystem")}</option>`;
      setStatus("当前浏览器不支持朗读");
      return;
    }

    scheduleVoiceLoads();
    if (typeof window.speechSynthesis.addEventListener === "function") {
      window.speechSynthesis.addEventListener("voiceschanged", () => loadVoices());
    } else {
      window.speechSynthesis.onvoiceschanged = () => loadVoices();
    }

    window.addEventListener("pageshow", () => scheduleVoiceLoads());
    window.addEventListener("focus", () => loadVoices());
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) scheduleVoiceLoads();
    });

    speechState.accentInputs.forEach((input) => {
      input.addEventListener("change", () => {
        if (input.checked) setAccent(input.value);
      });
    });

    speechState.voiceSelect.addEventListener("pointerdown", () => loadVoices());
    speechState.voiceSelect.addEventListener("focus", () => loadVoices());
    speechState.voiceSelect.addEventListener("change", handleVoiceSelection);

    if (speechState.reloadButton) {
      speechState.reloadButton.addEventListener("click", () => {
        setStatus("正在从设备载入英语声音…");
        scheduleVoiceLoads(true);
      });
    }

    speechState.rateInput.addEventListener("input", () => {
      const rate = Number(speechState.rateInput.value);
      speechState.rateOutput.value = `${rate.toFixed(1)}×`;
      speechState.rateOutput.textContent = `${rate.toFixed(1)}×`;
    });

    speechState.rateInput.addEventListener("change", () => {
      window.LearningStorage.updateSettings({ rate: Number(speechState.rateInput.value) });
    });

    speechState.stopButton.addEventListener("click", stop);
  }

  window.SpeechController = { init, speak, stop, setAccent };
})();
