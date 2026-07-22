(function () {
  "use strict";

  const STORAGE_KEY = "hexin-xiaohe-chat:v1";
  const POSITION_STORAGE_KEY = "hexin-xiaohe-position:v1";
  const MAX_STORED_MESSAGES = 20;
  const MAX_SENT_HISTORY = 12;
  const REQUEST_TIMEOUT_MS = 45000;
  const DRAG_THRESHOLD = 5;
  const VIEWPORT_MARGIN = 8;

  const copy = {
    zh: {
      open: "找小何聊聊",
      close: "关闭小何",
      clear: "清空对话",
      clearAgain: "再点一次确认清空",
      title: "小何",
      subtitle: "英语学习助手",
      online: "在线",
      checking: "正在连接",
      offline: "后端未连接",
      unconfigured: "后端未配置",
      welcome: "我是可爱的小何，请和我聊天吧~",
      dialogue: "英语对话",
      correct: "批改句子",
      explain: "解释单词",
      grammar: "解析语法",
      dialoguePrompt: "请和我进行一段适合初学者的英语对话，每次只说一到两句，并在需要时纠正我。",
      correctPrompt: "请帮我批改这句话：",
      explainPrompt: "请解释这个单词，并给我两个带中文翻译的例句：",
      grammarPrompt: "请解析这句话的语法结构，说明时态、句型和重点语法，并给出中文翻译：",
      placeholder: "问小何英语问题…",
      send: "发送",
      you: "我",
      typing: "小何正在想",
      noBackend: "小何的后端还没有连接。你可以先在本地启动后端，或为线上网站配置 HTTPS 后端地址。",
      failed: "小何暂时没有听清，请稍后重试。",
      timeout: "小何想得有点久，请再试一次。",
      localHistory: "对话记录仅保存在当前浏览器"
    },
    en: {
      open: "Chat with Xiao He",
      close: "Close Xiao He",
      clear: "Clear chat",
      clearAgain: "Click again to clear",
      title: "Xiao He",
      subtitle: "English learning assistant",
      online: "Online",
      checking: "Connecting",
      offline: "Backend offline",
      unconfigured: "Backend not configured",
      welcome: "I’m Xiao He. I can practise English with you, correct sentences, and explain words or grammar.",
      dialogue: "English chat",
      correct: "Correct a sentence",
      explain: "Explain a word",
      grammar: "Analyse grammar",
      dialoguePrompt: "Have a beginner-friendly English conversation with me. Use only one or two sentences each turn and correct me when needed.",
      correctPrompt: "Please correct this sentence: ",
      explainPrompt: "Please explain this word and give me two examples with Chinese translations: ",
      grammarPrompt: "Please analyse the grammar of this sentence, including its tense, sentence pattern, key grammar points, and Chinese translation: ",
      placeholder: "Ask Xiao He about English…",
      send: "Send",
      you: "Me",
      typing: "Xiao He is thinking",
      noBackend: "Xiao He's backend is not connected. Start it locally or configure an HTTPS backend for the live site.",
      failed: "Xiao He could not answer just now. Please try again.",
      timeout: "Xiao He took too long to think. Please try again.",
      localHistory: "Chat history is saved only in this browser"
    },
    ko: {
      open: "샤오허와 대화",
      close: "샤오허 닫기",
      clear: "대화 지우기",
      clearAgain: "한 번 더 눌러 지우기",
      title: "샤오허",
      subtitle: "영어 학습 도우미",
      online: "온라인",
      checking: "연결 중",
      offline: "백엔드 연결 안 됨",
      unconfigured: "백엔드 설정 필요",
      welcome: "저는 샤오허예요. 영어 대화, 문장 교정, 단어와 문법 설명을 도와드릴게요.",
      dialogue: "영어 대화",
      correct: "문장 교정",
      explain: "단어 설명",
      grammar: "문법 분석",
      dialoguePrompt: "초보자 수준으로 영어 대화를 해 주세요. 한 번에 한두 문장만 말하고 필요할 때 제 문장을 고쳐 주세요.",
      correctPrompt: "이 문장을 고쳐 주세요: ",
      explainPrompt: "이 단어를 설명하고 중국어 번역이 있는 예문 두 개를 주세요: ",
      grammarPrompt: "이 문장의 문법 구조, 시제, 문형과 핵심 문법을 분석하고 중국어 번역도 제공해 주세요: ",
      placeholder: "샤오허에게 영어 질문하기…",
      send: "보내기",
      you: "나",
      typing: "샤오허가 생각 중",
      noBackend: "샤오허 백엔드가 연결되지 않았습니다. 로컬 백엔드를 시작하거나 온라인용 HTTPS 주소를 설정하세요.",
      failed: "지금은 답변할 수 없습니다. 잠시 후 다시 시도해 주세요.",
      timeout: "생각하는 시간이 길어졌어요. 다시 시도해 주세요.",
      localHistory: "대화 기록은 현재 브라우저에만 저장됩니다"
    },
    ja: {
      open: "シャオホーと話す",
      close: "シャオホーを閉じる",
      clear: "会話を消去",
      clearAgain: "もう一度押して消去",
      title: "シャオホー",
      subtitle: "英語学習アシスタント",
      online: "オンライン",
      checking: "接続中",
      offline: "バックエンド未接続",
      unconfigured: "バックエンド未設定",
      welcome: "シャオホーです。英会話、文の添削、単語や文法の説明をお手伝いします。",
      dialogue: "英会話",
      correct: "文を添削",
      explain: "単語を説明",
      grammar: "文法を解析",
      dialoguePrompt: "初心者向けの英会話をしてください。毎回1〜2文にして、必要なら私の文を直してください。",
      correctPrompt: "この文を添削してください：",
      explainPrompt: "この単語を説明し、中国語訳付きの例文を2つください：",
      grammarPrompt: "この文の文法構造、時制、文型、重要な文法を解析し、中国語訳も付けてください：",
      placeholder: "英語について質問する…",
      send: "送信",
      you: "私",
      typing: "考えています",
      noBackend: "バックエンドに接続できません。ローカルで起動するか、公開サイト用のHTTPS URLを設定してください。",
      failed: "今は回答できませんでした。もう一度お試しください。",
      timeout: "考えるのに時間がかかりました。もう一度お試しください。",
      localHistory: "会話履歴はこのブラウザにのみ保存されます"
    }
  };

  const state = {
    messages: loadHistory(),
    busy: false,
    checked: false,
    drag: {
      pointerId: null,
      startX: 0,
      startY: 0,
      startLeft: 0,
      startTop: 0,
      moved: false,
      suppressClick: false
    }
  };

  function locale() {
    const value = window.SiteI18n?.current?.() || "zh";
    return copy[value] ? value : "zh";
  }

  function text(key) {
    return copy[locale()][key] || copy.zh[key] || key;
  }

  function $(selector) {
    return document.querySelector(selector);
  }

  function apiBase() {
    return String(window.APP_CONFIG?.agentApiBase || "").replace(/\/$/, "");
  }

  function cleanAssistantText(value) {
    return String(value || "")
      .replace(/\r\n?/g, "\n")
      .replace(/^\s{0,3}#{1,6}\s*/gm, "")
      .replace(/^\s*[-*+]\s+/gm, "• ")
      .replace(/\*\*([^*\n]+)\*\*/g, "$1")
      .replace(/__([^_\n]+)__/g, "$1")
      .replace(/`{1,3}([^`\n]+)`{1,3}/g, "$1")
      .replace(/\*([^*\n]+)\*/g, "$1")
      .replace(/_([^_\n]+)_/g, "$1")
      .replace(/\*{2,}|_{2,}|#{2,}/g, "")
      .replace(/[ \t]+([，。！？；：,.!?;:])/g, "$1")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function loadHistory() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed.slice(-MAX_STORED_MESSAGES).flatMap((item) => {
        const role = item?.role === "assistant" ? "assistant" : item?.role === "user" ? "user" : "";
        const rawContent = typeof item?.content === "string" ? item.content.trim().slice(0, 4000) : "";
        const content = role === "assistant" ? cleanAssistantText(rawContent) : rawContent;
        return role && content ? [{ role, content }] : [];
      });
    } catch (_error) {
      return [];
    }
  }

  function saveHistory() {
    state.messages = state.messages.slice(-MAX_STORED_MESSAGES);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.messages));
    } catch (_error) {
      // 对话仍可继续，只是不再持久保存。
    }
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), Math.max(min, max));
  }

  function loadLauncherPosition() {
    try {
      const value = JSON.parse(window.localStorage.getItem(POSITION_STORAGE_KEY) || "null");
      if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y)) return null;
      return { x: clamp(value.x, 0, 1), y: clamp(value.y, 0, 1) };
    } catch (_error) {
      return null;
    }
  }

  function saveLauncherPosition(left, top) {
    const launcher = $("#agent-launcher");
    const maxLeft = Math.max(1, window.innerWidth - launcher.offsetWidth);
    const maxTop = Math.max(1, window.innerHeight - launcher.offsetHeight);
    try {
      window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify({
        x: clamp(left / maxLeft, 0, 1),
        y: clamp(top / maxTop, 0, 1)
      }));
    } catch (_error) {
      // 拖拽仍然可用，只是不保存位置。
    }
  }

  function placePanel() {
    const panel = $("#agent-panel");
    if (!panel || panel.hidden) return;

    const launcherRect = $("#agent-launcher").getBoundingClientRect();
    const gap = 12;
    const panelWidth = Math.min(390, window.innerWidth - VIEWPORT_MARGIN * 2);
    panel.style.width = `${panelWidth}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";

    const panelHeight = panel.offsetHeight;
    const maxLeft = window.innerWidth - panelWidth - VIEWPORT_MARGIN;
    const maxTop = window.innerHeight - panelHeight - VIEWPORT_MARGIN;
    const left = clamp(
      launcherRect.left + launcherRect.width / 2 - panelWidth / 2,
      VIEWPORT_MARGIN,
      maxLeft
    );
    let top = launcherRect.top - panelHeight - gap;
    if (top < VIEWPORT_MARGIN) top = launcherRect.bottom + gap;
    top = clamp(top, VIEWPORT_MARGIN, maxTop);

    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
    panel.style.transformOrigin = `${launcherRect.left < window.innerWidth / 2 ? "left" : "right"} ${top < launcherRect.top ? "bottom" : "top"}`;
  }

  function setLauncherPosition(left, top, persist) {
    const launcher = $("#agent-launcher");
    const maxLeft = window.innerWidth - launcher.offsetWidth - VIEWPORT_MARGIN;
    const maxTop = window.innerHeight - launcher.offsetHeight - VIEWPORT_MARGIN;
    const nextLeft = clamp(left, VIEWPORT_MARGIN, maxLeft);
    const nextTop = clamp(top, VIEWPORT_MARGIN, maxTop);
    launcher.style.left = `${Math.round(nextLeft)}px`;
    launcher.style.top = `${Math.round(nextTop)}px`;
    launcher.style.right = "auto";
    launcher.style.bottom = "auto";
    launcher.classList.toggle("is-near-left", nextLeft < 150);
    if (persist) saveLauncherPosition(nextLeft, nextTop);
    placePanel();
  }

  function restoreLauncherPosition() {
    const position = loadLauncherPosition();
    if (!position) return;
    const launcher = $("#agent-launcher");
    const maxLeft = Math.max(0, window.innerWidth - launcher.offsetWidth);
    const maxTop = Math.max(0, window.innerHeight - launcher.offsetHeight);
    setLauncherPosition(position.x * maxLeft, position.y * maxTop, false);
  }

  function startLauncherDrag(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const launcher = $("#agent-launcher");
    const rect = launcher.getBoundingClientRect();
    state.drag.pointerId = event.pointerId;
    state.drag.startX = event.clientX;
    state.drag.startY = event.clientY;
    state.drag.startLeft = rect.left;
    state.drag.startTop = rect.top;
    state.drag.moved = false;
    try {
      launcher.setPointerCapture?.(event.pointerId);
    } catch (_error) {
      // 某些旧浏览器仍可继续通过 pointermove 完成拖拽。
    }
  }

  function moveLauncher(event) {
    if (event.pointerId !== state.drag.pointerId) return;
    const deltaX = event.clientX - state.drag.startX;
    const deltaY = event.clientY - state.drag.startY;
    if (!state.drag.moved && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return;
    state.drag.moved = true;
    event.preventDefault();
    $("#agent-launcher").classList.add("is-dragging");
    setLauncherPosition(state.drag.startLeft + deltaX, state.drag.startTop + deltaY, false);
  }

  function finishLauncherDrag(event) {
    if (event.pointerId !== state.drag.pointerId) return;
    const launcher = $("#agent-launcher");
    if (state.drag.moved) {
      const rect = launcher.getBoundingClientRect();
      saveLauncherPosition(rect.left, rect.top);
      state.drag.suppressClick = true;
      window.setTimeout(() => { state.drag.suppressClick = false; }, 0);
    }
    launcher.classList.remove("is-dragging");
    try {
      if (launcher.hasPointerCapture?.(event.pointerId)) launcher.releasePointerCapture(event.pointerId);
    } catch (_error) {
      // 指针已经释放时无需再次处理。
    }
    state.drag.pointerId = null;
  }

  function applyCopy() {
    const launcher = $("#agent-launcher");
    const panel = $("#agent-panel");
    launcher.setAttribute("aria-label", text("open"));
    $("#agent-launcher-label").textContent = text("open");
    panel.setAttribute("aria-label", `${text("title")} · ${text("subtitle")}`);
    $("#agent-title").textContent = text("title");
    $("#agent-subtitle").textContent = text("subtitle");
    $("#agent-close").setAttribute("aria-label", text("close"));
    $("#agent-clear").setAttribute("aria-label", text("clear"));
    $("#agent-input").placeholder = text("placeholder");
    $("#agent-send").setAttribute("aria-label", text("send"));
    $("#agent-send-label").textContent = text("send");
    $("#agent-history-note").textContent = text("localHistory");
    document.querySelectorAll("[data-agent-copy]").forEach((element) => {
      element.textContent = text(element.dataset.agentCopy);
    });
    setStatus(apiBase() ? "checking" : "offline");
  }

  function setStatus(status) {
    const element = $("#agent-status");
    const labels = { online: "online", checking: "checking", offline: "offline", unconfigured: "unconfigured" };
    element.dataset.status = status;
    element.textContent = text(labels[status] || "offline");
  }

  function messageElement(role, content, temporary) {
    const item = document.createElement("article");
    item.className = `agent-message agent-message-${role}${temporary ? " is-typing" : ""}`;
    if (temporary) item.dataset.agentTyping = "true";

    const label = document.createElement("span");
    label.className = "agent-message-role";
    label.textContent = role === "assistant" ? text("title") : text("you");

    const body = document.createElement("p");
    body.textContent = role === "assistant" ? cleanAssistantText(content) : content;

    if (temporary) {
      const dots = document.createElement("span");
      dots.className = "agent-typing-dots";
      dots.setAttribute("aria-hidden", "true");
      dots.append(document.createElement("i"), document.createElement("i"), document.createElement("i"));
      body.append(dots);
    }
    item.append(label, body);
    return item;
  }

  function renderHistory() {
    const list = $("#agent-messages");
    list.replaceChildren();
    if (!state.messages.length) list.append(messageElement("assistant", text("welcome"), false));
    state.messages.forEach((message) => list.append(messageElement(message.role, message.content, false)));
    scrollToLatest();
  }

  function scrollToLatest() {
    const list = $("#agent-messages");
    window.requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
  }

  function setOpen(open) {
    const panel = $("#agent-panel");
    const launcher = $("#agent-launcher");
    panel.hidden = !open;
    launcher.setAttribute("aria-expanded", String(open));
    $("#agent-widget").classList.toggle("is-open", open);
    if (open) {
      renderHistory();
      checkBackend();
      window.requestAnimationFrame(placePanel);
      window.setTimeout(() => $("#agent-input").focus(), 120);
    } else {
      launcher.focus();
    }
  }

  function resizeInput() {
    const input = $("#agent-input");
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 112)}px`;
  }

  async function checkBackend() {
    if (state.checked || !apiBase()) {
      if (!apiBase()) setStatus("offline");
      return;
    }
    setStatus("checking");
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(`${apiBase()}/health`, { cache: "no-store", signal: controller.signal });
      const payload = await response.json().catch(() => ({}));
      state.checked = response.ok;
      setStatus(response.ok && payload.configured ? "online" : response.ok ? "unconfigured" : "offline");
    } catch (_error) {
      setStatus("offline");
    } finally {
      window.clearTimeout(timer);
    }
  }

  function setBusy(busy) {
    state.busy = busy;
    $("#agent-send").disabled = busy;
    $("#agent-input").disabled = busy;
    document.querySelectorAll(".agent-quick-action").forEach((button) => { button.disabled = busy; });
  }

  async function requestReply(message, history) {
    if (!apiBase()) throw new Error("NO_BACKEND");
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${apiBase()}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history: history.slice(-MAX_SENT_HISTORY) }),
        signal: controller.signal
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(payload.message || "REQUEST_FAILED");
        error.code = payload.error;
        throw error;
      }
      if (typeof payload.reply !== "string" || !payload.reply.trim()) throw new Error("EMPTY_REPLY");
      return payload.reply.trim();
    } catch (error) {
      if (error?.name === "AbortError") {
        const timeoutError = new Error("TIMEOUT");
        timeoutError.code = "TIMEOUT";
        throw timeoutError;
      }
      throw error;
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function sendMessage(rawMessage) {
    const message = String(rawMessage || "").trim().slice(0, 2000);
    if (!message || state.busy) return;

    const previous = state.messages.slice(-MAX_SENT_HISTORY);
    state.messages.push({ role: "user", content: message });
    saveHistory();
    renderHistory();
    $("#agent-input").value = "";
    resizeInput();
    setBusy(true);

    const list = $("#agent-messages");
    list.append(messageElement("assistant", text("typing"), true));
    scrollToLatest();

    try {
      const reply = cleanAssistantText(await requestReply(message, previous));
      list.querySelector("[data-agent-typing]")?.remove();
      state.messages.push({ role: "assistant", content: reply });
      saveHistory();
      list.append(messageElement("assistant", reply, false));
      setStatus("online");
    } catch (error) {
      list.querySelector("[data-agent-typing]")?.remove();
      const noBackend = error?.message === "NO_BACKEND";
      const notConfigured = error?.code === "AGENT_NOT_CONFIGURED";
      const content = noBackend ? text("noBackend") : error?.code === "TIMEOUT" ? text("timeout") : (error?.message && error.message !== "REQUEST_FAILED" ? error.message : text("failed"));
      list.append(messageElement("assistant", content, false));
      setStatus(noBackend || notConfigured ? "unconfigured" : "offline");
    } finally {
      setBusy(false);
      scrollToLatest();
      $("#agent-input").focus();
    }
  }

  function init() {
    const widget = $("#agent-widget");
    if (!widget) return;
    applyCopy();
    renderHistory();

    const launcher = $("#agent-launcher");
    launcher.addEventListener("pointerdown", startLauncherDrag);
    launcher.addEventListener("pointermove", moveLauncher);
    launcher.addEventListener("pointerup", finishLauncherDrag);
    launcher.addEventListener("pointercancel", finishLauncherDrag);
    launcher.addEventListener("click", (event) => {
      if (state.drag.suppressClick) {
        event.preventDefault();
        return;
      }
      setOpen($("#agent-panel").hidden);
    });
    $("#agent-close").addEventListener("click", () => setOpen(false));
    $("#agent-clear").addEventListener("click", () => {
      const button = $("#agent-clear");
      if (button.dataset.confirm !== "true") {
        button.dataset.confirm = "true";
        button.setAttribute("aria-label", text("clearAgain"));
        window.setTimeout(() => {
          delete button.dataset.confirm;
          button.setAttribute("aria-label", text("clear"));
        }, 3000);
        return;
      }
      delete button.dataset.confirm;
      button.setAttribute("aria-label", text("clear"));
      state.messages = [];
      saveHistory();
      renderHistory();
    });
    $("#agent-form").addEventListener("submit", (event) => {
      event.preventDefault();
      sendMessage($("#agent-input").value);
    });
    $("#agent-input").addEventListener("input", resizeInput);
    $("#agent-input").addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        $("#agent-form").requestSubmit();
      }
    });
    document.querySelectorAll(".agent-quick-action").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.agentPrompt;
        const prompt = text(key);
        if (key === "dialoguePrompt") {
          sendMessage(prompt);
          return;
        }
        $("#agent-input").value = prompt;
        resizeInput();
        $("#agent-input").focus();
      });
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !$("#agent-panel").hidden) setOpen(false);
    });
    window.requestAnimationFrame(restoreLauncherPosition);
    window.addEventListener("resize", () => {
      window.requestAnimationFrame(() => {
        restoreLauncherPosition();
        placePanel();
      });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
