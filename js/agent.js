(function () {
  "use strict";

  const STORAGE_KEY = "hexin-xiaohe-chat:v1";
  const POSITION_STORAGE_KEY = "hexin-xiaohe-position:v1";
  const MAX_STORED_MESSAGES = 20;
  const MAX_SENT_HISTORY = 12;
  const MAX_TOOL_ROUNDS = 4;
  const REQUEST_TIMEOUT_MS = 65000;
  const DRAG_THRESHOLD = 5;
  const VIEWPORT_MARGIN = 8;
  const MAX_IMAGE_FILE_BYTES = 12 * 1024 * 1024;
  const MAX_IMAGE_BYTES = 1400 * 1024;
  const MAX_IMAGE_DIMENSION = 2048;
  const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

  const copy = {
    zh: {
      open: "找小何聊聊",
      close: "关闭小何",
      clear: "清空对话",
      clearAgain: "再点一次确认清空",
      title: "小何",
      subtitle: "自主学习 Agent",
      online: "在线",
      checking: "正在连接",
      offline: "后端未连接",
      unconfigured: "后端未配置",
      welcome: "我是可爱的小何，请和我聊天吧~",
      dialogue: "英语对话",
      correct: "批改句子",
      explain: "解释单词",
      grammar: "解析语法",
      presentation: "制作 PPT",
      attach: "添加图片",
      removeImage: "移除图片",
      imageOptimizing: "正在优化图片，保留文字与细节…",
      imageReady: "已优化至 {size}，图片只用于本次识别",
      imageTooLarge: "图片过大，请选择小于 12 MB 的图片。",
      imageInvalid: "请选择 JPG、PNG 或 WebP 图片。",
      imageFailed: "图片处理失败，请换一张重试。",
      imagePrompt: "请仔细识别这张图片。先说明你实际看见的内容；如果有英文，请准确抄写、翻译并讲解，不确定的文字要明确标出。",
      dialoguePrompt: "请和我进行一段适合初学者的英语对话，每次只说一到两句，并在需要时纠正我。",
      correctPrompt: "请帮我批改这句话：",
      explainPrompt: "请解释这个单词，并给我两个带中文翻译的例句：",
      grammarPrompt: "请解析这句话的语法结构，说明时态、句型和重点语法，并给出中文翻译：",
      presentationPrompt: "请根据以下主题制作并下载一份中英双语学习 PPT：",
      placeholder: "问小何英语问题…",
      send: "发送",
      you: "我",
      typing: "小何正在想",
      working: "小何正在执行任务",
      verifying: "小何正在核验结果",
      approval: "小何计划执行以下操作：",
      approvalQuestion: "\n\n是否允许执行？",
      denied: "你没有授权这项操作，我没有修改任何数据。",
      refreshing: "任务已经完成，正在刷新课程页面…",
      noBackend: "小何的后端还没有连接。你可以先在本地启动后端，或为线上网站配置 HTTPS 后端地址。",
      failed: "小何暂时没有听清，请稍后重试。",
      timeout: "小何想得有点久，请再试一次。",
      localHistory: "登录后对话与学习记忆会自动同步"
    },
    en: {
      open: "Chat with Xiao He",
      close: "Close Xiao He",
      clear: "Clear chat",
      clearAgain: "Click again to clear",
      title: "Xiao He",
      subtitle: "Autonomous learning agent",
      online: "Online",
      checking: "Connecting",
      offline: "Backend offline",
      unconfigured: "Backend not configured",
      welcome: "I’m Xiao He. I can practise English with you, correct sentences, and explain words or grammar.",
      dialogue: "English chat",
      correct: "Correct a sentence",
      explain: "Explain a word",
      grammar: "Analyse grammar",
      presentation: "Create PPT",
      attach: "Add an image",
      removeImage: "Remove image",
      imageOptimizing: "Optimising the image while keeping text and details…",
      imageReady: "Optimised to {size}; used only for this request",
      imageTooLarge: "Choose an image smaller than 12 MB.",
      imageInvalid: "Choose a JPG, PNG, or WebP image.",
      imageFailed: "The image could not be processed. Try another one.",
      imagePrompt: "Analyse this image carefully. First describe only what you can actually see. If it contains English, transcribe it accurately, translate it, and explain it. Mark any uncertain text clearly.",
      dialoguePrompt: "Have a beginner-friendly English conversation with me. Use only one or two sentences each turn and correct me when needed.",
      correctPrompt: "Please correct this sentence: ",
      explainPrompt: "Please explain this word and give me two examples with Chinese translations: ",
      grammarPrompt: "Please analyse the grammar of this sentence, including its tense, sentence pattern, key grammar points, and Chinese translation: ",
      presentationPrompt: "Create and download a bilingual English-learning PowerPoint about: ",
      placeholder: "Ask Xiao He about English…",
      send: "Send",
      you: "Me",
      typing: "Xiao He is thinking",
      working: "Xiao He is running the task",
      verifying: "Xiao He is verifying the result",
      approval: "Xiao He plans to perform these actions:",
      approvalQuestion: "\n\nAllow these actions?",
      denied: "You did not approve the action, so no data was changed.",
      refreshing: "Task complete. Refreshing the lessons…",
      noBackend: "Xiao He's backend is not connected. Start it locally or configure an HTTPS backend for the live site.",
      failed: "Xiao He could not answer just now. Please try again.",
      timeout: "Xiao He took too long to think. Please try again.",
      localHistory: "Sign in to sync chats and learning memory"
    },
    ko: {
      open: "샤오허와 대화",
      close: "샤오허 닫기",
      clear: "대화 지우기",
      clearAgain: "한 번 더 눌러 지우기",
      title: "샤오허",
      subtitle: "자율 학습 Agent",
      online: "온라인",
      checking: "연결 중",
      offline: "백엔드 연결 안 됨",
      unconfigured: "백엔드 설정 필요",
      welcome: "저는 샤오허예요. 영어 대화, 문장 교정, 단어와 문법 설명을 도와드릴게요.",
      dialogue: "영어 대화",
      correct: "문장 교정",
      explain: "단어 설명",
      grammar: "문법 분석",
      presentation: "PPT 만들기",
      attach: "이미지 추가",
      removeImage: "이미지 제거",
      imageOptimizing: "글자와 세부 정보를 유지하며 이미지를 최적화하는 중…",
      imageReady: "{size}로 최적화됨 · 이번 요청에만 사용",
      imageTooLarge: "12MB보다 작은 이미지를 선택하세요.",
      imageInvalid: "JPG, PNG 또는 WebP 이미지를 선택하세요.",
      imageFailed: "이미지를 처리하지 못했습니다. 다른 이미지를 사용해 보세요.",
      imagePrompt: "이 이미지를 자세히 분석해 주세요. 실제로 보이는 내용부터 설명하고, 영어가 있다면 정확히 옮겨 적고 번역과 설명을 제공하세요. 확실하지 않은 글자는 명확히 표시하세요.",
      dialoguePrompt: "초보자 수준으로 영어 대화를 해 주세요. 한 번에 한두 문장만 말하고 필요할 때 제 문장을 고쳐 주세요.",
      correctPrompt: "이 문장을 고쳐 주세요: ",
      explainPrompt: "이 단어를 설명하고 중국어 번역이 있는 예문 두 개를 주세요: ",
      grammarPrompt: "이 문장의 문법 구조, 시제, 문형과 핵심 문법을 분석하고 중국어 번역도 제공해 주세요: ",
      presentationPrompt: "다음 주제로 중영 이중 언어 학습 PPT를 만들고 다운로드해 주세요: ",
      placeholder: "샤오허에게 영어 질문하기…",
      send: "보내기",
      you: "나",
      typing: "샤오허가 생각 중",
      working: "샤오허가 작업을 실행 중",
      verifying: "샤오허가 결과를 확인 중",
      approval: "샤오허가 다음 작업을 실행하려고 합니다:",
      approvalQuestion: "\n\n실행을 허용할까요?",
      denied: "작업이 승인되지 않아 데이터를 변경하지 않았습니다.",
      refreshing: "작업이 완료되어 수업 페이지를 새로고침합니다…",
      noBackend: "샤오허 백엔드가 연결되지 않았습니다. 로컬 백엔드를 시작하거나 온라인용 HTTPS 주소를 설정하세요.",
      failed: "지금은 답변할 수 없습니다. 잠시 후 다시 시도해 주세요.",
      timeout: "생각하는 시간이 길어졌어요. 다시 시도해 주세요.",
      localHistory: "로그인하면 대화와 학습 기억이 동기화됩니다"
    },
    ja: {
      open: "シャオホーと話す",
      close: "シャオホーを閉じる",
      clear: "会話を消去",
      clearAgain: "もう一度押して消去",
      title: "シャオホー",
      subtitle: "自律学習Agent",
      online: "オンライン",
      checking: "接続中",
      offline: "バックエンド未接続",
      unconfigured: "バックエンド未設定",
      welcome: "シャオホーです。英会話、文の添削、単語や文法の説明をお手伝いします。",
      dialogue: "英会話",
      correct: "文を添削",
      explain: "単語を説明",
      grammar: "文法を解析",
      presentation: "PPTを作成",
      attach: "画像を追加",
      removeImage: "画像を削除",
      imageOptimizing: "文字と細部を保ちながら画像を最適化しています…",
      imageReady: "{size}に最適化済み・今回の認識だけに使用",
      imageTooLarge: "12MB未満の画像を選んでください。",
      imageInvalid: "JPG、PNG、WebP画像を選んでください。",
      imageFailed: "画像を処理できませんでした。別の画像をお試しください。",
      imagePrompt: "この画像を注意深く分析してください。実際に見える内容を先に説明し、英語が含まれる場合は正確に書き起こして翻訳・解説してください。不確かな文字は明示してください。",
      dialoguePrompt: "初心者向けの英会話をしてください。毎回1〜2文にして、必要なら私の文を直してください。",
      correctPrompt: "この文を添削してください：",
      explainPrompt: "この単語を説明し、中国語訳付きの例文を2つください：",
      grammarPrompt: "この文の文法構造、時制、文型、重要な文法を解析し、中国語訳も付けてください：",
      presentationPrompt: "次のテーマで中英バイリンガル学習PPTを作成してダウンロードしてください：",
      placeholder: "英語について質問する…",
      send: "送信",
      you: "私",
      typing: "考えています",
      working: "タスクを実行しています",
      verifying: "結果を確認しています",
      approval: "次の操作を実行します:",
      approvalQuestion: "\n\n実行を許可しますか？",
      denied: "許可されなかったため、データは変更していません。",
      refreshing: "タスクが完了しました。レッスンを更新します…",
      noBackend: "バックエンドに接続できません。ローカルで起動するか、公開サイト用のHTTPS URLを設定してください。",
      failed: "今は回答できませんでした。もう一度お試しください。",
      timeout: "考えるのに時間がかかりました。もう一度お試しください。",
      localHistory: "ログインすると会話と学習記憶が同期されます"
    }
  };

  const state = {
    messages: loadHistory(),
    busy: false,
    checked: false,
    attachment: null,
    processingImage: false,
    catReactionTimer: null,
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
      const storedMessages = state.messages.map((message) => ({
        role: message.role,
        content: message.content
      }));
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storedMessages));
      window.dispatchEvent(new CustomEvent("hexin:data-changed", { detail: { key: STORAGE_KEY } }));
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

  function triggerCatLaugh() {
    const launcher = $("#agent-launcher");
    window.clearTimeout(state.catReactionTimer);
    launcher.classList.remove("is-happy");
    void launcher.offsetWidth;
    launcher.classList.add("is-happy");
    state.catReactionTimer = window.setTimeout(() => {
      launcher.classList.remove("is-happy");
      state.catReactionTimer = null;
    }, 900);
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
    launcher.classList.add("is-poked");
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
    $("#agent-launcher").classList.remove("is-poked");
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
    launcher.classList.remove("is-dragging", "is-poked");
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
    $("#agent-attach").setAttribute("title", text("attach"));
    $("#agent-attach span").textContent = text("attach");
    $("#agent-attachment-remove").setAttribute("aria-label", text("removeImage"));
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

  function messageElement(role, content, temporary, imagePreview) {
    const item = document.createElement("article");
    item.className = `agent-message agent-message-${role}${temporary ? " is-typing" : ""}`;
    if (temporary) item.dataset.agentTyping = "true";

    const label = document.createElement("span");
    label.className = "agent-message-role";
    label.textContent = role === "assistant" ? text("title") : text("you");

    const body = document.createElement("p");
    body.textContent = role === "assistant" ? cleanAssistantText(content) : content;

    let image = null;
    if (role === "user" && imagePreview) {
      image = document.createElement("img");
      image.className = "agent-message-image";
      image.src = imagePreview;
      image.alt = text("attach");
      image.loading = "lazy";
    }

    if (temporary) {
      const dots = document.createElement("span");
      dots.className = "agent-typing-dots";
      dots.setAttribute("aria-hidden", "true");
      dots.append(document.createElement("i"), document.createElement("i"), document.createElement("i"));
      body.append(dots);
    }
    item.append(label);
    if (image) item.append(image);
    item.append(body);
    return item;
  }

  function renderHistory() {
    const list = $("#agent-messages");
    list.replaceChildren();
    if (!state.messages.length) list.append(messageElement("assistant", text("welcome"), false));
    state.messages.forEach((message) => list.append(messageElement(message.role, message.content, false, message.imagePreview)));
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
    $("#agent-image-input").disabled = busy;
    $("#agent-attachment-remove").disabled = busy;
    $("#agent-form").classList.toggle("is-busy", busy);
    document.querySelectorAll(".agent-quick-action").forEach((button) => { button.disabled = busy; });
  }

  function formatBytes(bytes) {
    const kilobytes = Math.max(1, Math.round(Number(bytes || 0) / 1024));
    return `${new Intl.NumberFormat(locale()).format(kilobytes)} KB`;
  }

  function showAttachmentState(name, meta, kind, preview) {
    const container = $("#agent-attachment");
    const image = $("#agent-attachment-preview");
    container.hidden = false;
    $("#agent-attachment-name").textContent = String(name || text("attach")).slice(0, 100);
    $("#agent-attachment-meta").textContent = meta;
    $("#agent-attachment-meta").dataset.kind = kind || "ready";
    image.hidden = !preview;
    if (preview) image.src = preview;
    else image.removeAttribute("src");
  }

  function clearAttachment() {
    state.attachment = null;
    $("#agent-image-input").value = "";
    $("#agent-attachment").hidden = true;
    $("#agent-attachment-preview").removeAttribute("src");
    $("#agent-attachment-preview").hidden = true;
    delete $("#agent-attachment-meta").dataset.kind;
    placePanel();
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("IMAGE_INVALID"));
      };
      image.src = objectUrl;
    });
  }

  function canvasToBlob(canvas, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("IMAGE_PROCESSING_FAILED"));
      }, "image/jpeg", quality);
    });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("IMAGE_PROCESSING_FAILED"));
      reader.readAsDataURL(blob);
    });
  }

  async function prepareImage(file) {
    const type = String(file?.type || "").toLowerCase();
    if (!file || !SUPPORTED_IMAGE_TYPES.has(type)) {
      const error = new Error("IMAGE_INVALID");
      error.userMessage = text("imageInvalid");
      throw error;
    }
    if (file.size > MAX_IMAGE_FILE_BYTES) {
      const error = new Error("IMAGE_TOO_LARGE");
      error.userMessage = text("imageTooLarge");
      throw error;
    }

    const source = await loadImage(file);
    const sourceWidth = source.naturalWidth || source.width;
    const sourceHeight = source.naturalHeight || source.height;
    if (!sourceWidth || !sourceHeight) throw new Error("IMAGE_INVALID");

    const attempts = [
      [MAX_IMAGE_DIMENSION, 0.9],
      [1800, 0.86],
      [1600, 0.82],
      [1280, 0.78],
      [1024, 0.74]
    ];
    let bestBlob = null;
    for (const [dimension, quality] of attempts) {
      const scale = Math.min(1, dimension / Math.max(sourceWidth, sourceHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(sourceWidth * scale));
      canvas.height = Math.max(1, Math.round(sourceHeight * scale));
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("IMAGE_PROCESSING_FAILED");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      bestBlob = await canvasToBlob(canvas, quality);
      if (bestBlob.size <= MAX_IMAGE_BYTES) break;
    }
    if (!bestBlob || bestBlob.size > MAX_IMAGE_BYTES) {
      const error = new Error("IMAGE_TOO_LARGE");
      error.userMessage = text("imageTooLarge");
      throw error;
    }

    const preview = await blobToDataUrl(bestBlob);
    const data = preview.split(",", 2)[1] || "";
    if (!data) throw new Error("IMAGE_PROCESSING_FAILED");
    return {
      name: String(file.name || "image.jpg").slice(0, 100),
      mimeType: "image/jpeg",
      data,
      bytes: bestBlob.size,
      preview
    };
  }

  async function handleImageFile(file) {
    if (!file || state.busy || state.processingImage) return;
    state.processingImage = true;
    $("#agent-attach").classList.add("is-busy");
    showAttachmentState(file.name, text("imageOptimizing"), "working", "");
    placePanel();
    try {
      state.attachment = await prepareImage(file);
      showAttachmentState(
        state.attachment.name,
        text("imageReady").replace("{size}", formatBytes(state.attachment.bytes)),
        "ready",
        state.attachment.preview
      );
    } catch (error) {
      state.attachment = null;
      showAttachmentState(
        file.name,
        error?.userMessage || (error?.message === "IMAGE_INVALID" ? text("imageInvalid") : text("imageFailed")),
        "error",
        ""
      );
    } finally {
      state.processingImage = false;
      $("#agent-attach").classList.remove("is-busy");
      $("#agent-image-input").value = "";
      placePanel();
    }
  }

  async function requestReply(message, history, attachment, trace, finalOnly = false) {
    if (!apiBase()) throw new Error("NO_BACKEND");
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${apiBase()}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history: history.slice(-MAX_SENT_HISTORY).map((item) => ({ role: item.role, content: item.content })),
          image: attachment ? { mimeType: attachment.mimeType, data: attachment.data } : null,
          context: window.XiaoHeTools?.context?.(message) || {},
          trace: Array.isArray(trace) ? trace : [],
          finalOnly
        }),
        signal: controller.signal
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(payload.message || "REQUEST_FAILED");
        error.code = payload.error;
        throw error;
      }
      const toolCalls = Array.isArray(payload.toolCalls) ? payload.toolCalls.slice(0, 6).filter((call) => {
        return call && typeof call.name === "string" && call.args && typeof call.args === "object";
      }) : [];
      const reply = typeof payload.reply === "string" ? payload.reply.trim() : "";
      if (!reply && !toolCalls.length) throw new Error("EMPTY_REPLY");
      return { reply, toolCalls };
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

  function toolExecutionKey(call) {
    try {
      return `${call?.name || ""}:${JSON.stringify(call?.args || {})}`;
    } catch (_error) {
      return `${call?.name || ""}:unserializable`;
    }
  }

  async function executeToolCalls(calls, completedMutations, completedReads) {
    if (!window.XiaoHeTools?.execute) {
      return calls.map((call) => ({ id: call.id || "", name: call.name, result: { ok: false, error: "TOOLS_UNAVAILABLE" } }));
    }
    const confirmationKeys = new Set();
    const guarded = calls.filter((call) => {
      if (!window.XiaoHeTools.requiresConfirmation(call)) return false;
      const key = toolExecutionKey(call);
      if (completedMutations?.has(key) || confirmationKeys.has(key)) return false;
      confirmationKeys.add(key);
      return true;
    });
    let approved = true;
    if (guarded.length) {
      const plan = guarded.map((call, index) => `${index + 1}. ${window.XiaoHeTools.describe(call)}`).join("\n");
      approved = window.confirm(`${text("approval")}\n\n${plan}${text("approvalQuestion")}`);
    }
    const results = [];
    for (const call of calls) {
      const needsApproval = window.XiaoHeTools.requiresConfirmation(call);
      const key = toolExecutionKey(call);
      let result;
      if (needsApproval && completedMutations?.has(key)) {
        result = { ...completedMutations.get(key), repeatedCallSkipped: true };
      } else if (!needsApproval && completedReads?.has(key)) {
        result = { ...completedReads.get(key), repeatedCallSkipped: true };
      } else {
        result = needsApproval && !approved
          ? { ok: false, error: "USER_DENIED", message: text("denied") }
          : await window.XiaoHeTools.execute(call);
        if (needsApproval && result?.ok && window.XiaoHeTools?.verify) {
          updateTypingStatus(`${text("verifying")} · ${window.XiaoHeTools.describe(call)}`);
          const verification = await window.XiaoHeTools.verify(call, result);
          result = { ...result, verification };
          if (!verification?.verified) result = { ...result, ok: false, error: "ACTION_NOT_VERIFIED" };
        }
        if (needsApproval && result?.ok) completedMutations?.set(key, result);
        if (!needsApproval && result?.ok) completedReads?.set(key, result);
      }
      results.push({ id: call.id || "", name: call.name, result });
    }
    return results;
  }

  function updateTypingStatus(message) {
    const typing = document.querySelector("[data-agent-typing] p");
    if (!typing) return;
    typing.replaceChildren(document.createTextNode(message));
    const dots = document.createElement("span");
    dots.className = "agent-typing-dots";
    dots.setAttribute("aria-hidden", "true");
    dots.append(document.createElement("i"), document.createElement("i"), document.createElement("i"));
    typing.append(dots);
    scrollToLatest();
  }

  async function sendMessage(rawMessage) {
    const attachment = state.attachment;
    const typedMessage = String(rawMessage || "").trim().slice(0, 2000);
    const message = typedMessage || (attachment ? text("imagePrompt") : "");
    if (!message || state.busy || state.processingImage) return;

    const previous = state.messages.slice(-MAX_SENT_HISTORY);
    window.XiaoHeMemory?.observeUserMessage?.(message);
    state.messages.push({ role: "user", content: message, imagePreview: attachment?.preview || "" });
    saveHistory();
    renderHistory();
    $("#agent-input").value = "";
    clearAttachment();
    resizeInput();
    setBusy(true);

    const list = $("#agent-messages");
    list.append(messageElement("assistant", text("typing"), true));
    scrollToLatest();

    try {
      const trace = [];
      const completedMutations = new Map();
      const completedReads = new Map();
      let reply = "";
      const directCalls = attachment ? [] : (window.XiaoHeTools?.matchDirectCommand?.(message) || []);
      if (directCalls.length) {
        updateTypingStatus(`${text("working")} · ${directCalls.map((call) => call.name).join("、")}`);
        const results = await executeToolCalls(directCalls, completedMutations, completedReads);
        trace.push({ calls: directCalls, results });
        reply = window.XiaoHeTools?.summarizeTrace?.(trace) || "";
      } else {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
          const response = await requestReply(message, previous, attachment, trace);
          if (!response.toolCalls.length) {
            reply = cleanAssistantText(response.reply);
            break;
          }
          updateTypingStatus(`${text("working")} · ${response.toolCalls.map((call) => call.name).join("、")}`);
          const results = await executeToolCalls(response.toolCalls, completedMutations, completedReads);
          trace.push({ calls: response.toolCalls, results });
        }
        if (!reply && trace.length) {
          updateTypingStatus(text("verifying"));
          const finalResponse = await requestReply(message, previous, attachment, trace, true);
          reply = cleanAssistantText(finalResponse.reply);
        }
      }
      if (!reply) {
        reply = window.XiaoHeTools?.summarizeTrace?.(trace)
          || "我没有完成这次操作，请再说一次你要修改的课程和内容。";
      }
      list.querySelector("[data-agent-typing]")?.remove();
      state.messages.push({ role: "assistant", content: reply });
      if (trace.length) {
        const traceSucceeded = trace.every((round) => (round.results || []).every((entry) => entry.result?.ok !== false));
        window.XiaoHeMemory?.recordTask?.(message, reply, traceSucceeded);
      }
      saveHistory();
      list.append(messageElement("assistant", reply, false));
      setStatus("online");
      if (window.XiaoHeTools?.takeReloadRequest?.()) {
        state.messages.push({ role: "assistant", content: text("refreshing") });
        saveHistory();
        list.append(messageElement("assistant", text("refreshing"), false));
        window.setTimeout(() => window.location.reload(), 1400);
      }
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
      triggerCatLaugh();
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
      clearAttachment();
      saveHistory();
      renderHistory();
    });
    const form = $("#agent-form");
    const input = $("#agent-input");
    const imageInput = $("#agent-image-input");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      sendMessage(input.value);
    });
    imageInput.addEventListener("change", () => handleImageFile(imageInput.files?.[0]));
    $("#agent-attachment-remove").addEventListener("click", clearAttachment);
    input.addEventListener("paste", (event) => {
      const imageItem = Array.from(event.clipboardData?.items || []).find((item) => item.type.startsWith("image/"));
      const file = imageItem?.getAsFile();
      if (!file) return;
      event.preventDefault();
      handleImageFile(file);
    });
    form.addEventListener("dragover", (event) => {
      if (!Array.from(event.dataTransfer?.types || []).includes("Files")) return;
      event.preventDefault();
      form.classList.add("is-dragover");
    });
    form.addEventListener("dragleave", (event) => {
      if (!form.contains(event.relatedTarget)) form.classList.remove("is-dragover");
    });
    form.addEventListener("drop", (event) => {
      event.preventDefault();
      form.classList.remove("is-dragover");
      const file = Array.from(event.dataTransfer?.files || []).find((item) => item.type.startsWith("image/"));
      if (file) handleImageFile(file);
    });
    input.addEventListener("input", resizeInput);
    input.addEventListener("keydown", (event) => {
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
