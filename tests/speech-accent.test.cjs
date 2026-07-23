const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "js", "speech.js"), "utf8");

function runSpeechTest(voices, settings) {
  let spoken = null;
  let resumed = false;
  const voiceSelect = {
    value: "",
    options: [],
    disabled: false,
    replaceChildren() {
      this.options = [];
      this.value = "";
    },
    append(option) {
      this.options.push(option);
      if (option.selected || this.options.length === 1) this.value = option.value;
    },
    addEventListener() {}
  };
  const control = (extra = {}) => ({
    value: "",
    textContent: "",
    checked: false,
    disabled: false,
    addEventListener() {},
    ...extra
  });
  const document = {
    hidden: false,
    createElement() {
      return { value: "", textContent: "", selected: false };
    },
    addEventListener() {}
  };
  class Utterance {
    constructor(text) {
      this.text = text;
      this.voice = null;
      this.lang = "";
      this.rate = 1;
      this.pitch = 1;
      this.volume = 1;
    }
    addEventListener() {}
  }
  const state = { settings: { rate: 0.8, ...settings } };
  const window = {
    document,
    SpeechSynthesisUtterance: Utterance,
    speechSynthesis: {
      getVoices: () => voices,
      cancel() {},
      resume() { resumed = true; },
      speak(utterance) { spoken = utterance; },
      addEventListener() {}
    },
    LearningStorage: {
      getState: () => state,
      updateSettings(next) { state.settings = { ...state.settings, ...next }; }
    },
    SiteI18n: { t: (key) => key },
    addEventListener() {},
    setTimeout(callback) { callback(); return 1; },
    clearTimeout() {}
  };
  vm.runInNewContext(source, {
    window,
    document,
    SpeechSynthesisUtterance: Utterance,
    console
  }, { filename: "speech.js" });
  window.SpeechController.init({
    voiceSelect,
    voiceLabel: control(),
    reloadButton: control(),
    accentInputs: [control({ value: "en-US" }), control({ value: "en-GB" })],
    rateInput: control(),
    rateOutput: control(),
    status: control(),
    stopButton: control()
  });
  window.SpeechController.speak("coding", "en-US");
  return { spoken, resumed };
}

{
  const result = runSpeechTest([
    { name: "Bad News", lang: "en-US", voiceURI: "bad", default: false, localService: true },
    { name: "Google US English", lang: "en-US", voiceURI: "google-us", default: false, localService: false },
    { name: "Daniel", lang: "en-GB", voiceURI: "daniel", default: true, localService: true }
  ], { accent: "en-US", voiceURI: "bad" });
  assert.equal(result.spoken.voice.voiceURI, "google-us");
  assert.equal(result.spoken.lang, "en-US");
  assert.equal(result.spoken.pitch, 1);
  assert.equal(result.spoken.volume, 1);
  assert.equal(result.resumed, true);
}

{
  const result = runSpeechTest([
    { name: "Daniel", lang: "en-GB", voiceURI: "daniel", default: true, localService: true }
  ], { accent: "en-GB", voiceURI: "daniel" });
  assert.equal(result.spoken.voice, null);
  assert.equal(result.spoken.lang, "en-US");
}

{
  const result = runSpeechTest([
    { name: "Samantha", lang: "en_US", voiceURI: "samantha", default: true, localService: true }
  ], { accent: "en-US", voiceURI: "samantha" });
  assert.equal(result.spoken.voice.voiceURI, "samantha");
  assert.equal(result.spoken.lang, "en-US");
}

console.log("Speech accent selection tests passed.");
