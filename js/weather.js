(function () {
  "use strict";

  const modes = ["clear", "rain", "snow"];
  const labels = {
    zh: { control: "天气氛围", clear: "晴朗", rain: "下雨", snow: "下雪" },
    en: { control: "Weather ambience", clear: "Clear", rain: "Rain", snow: "Snow" },
    ko: { control: "날씨 분위기", clear: "맑음", rain: "비", snow: "눈" },
    ja: { control: "天気の演出", clear: "晴れ", rain: "雨", snow: "雪" }
  };

  let mode = "clear";
  let particles = [];
  let splashes = [];
  let frame = 0;
  let lastTime = 0;
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let resizeTimer = 0;
  let reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const canvas = document.getElementById("weather-canvas");
  const atmosphere = document.getElementById("weather-atmosphere");
  const context = canvas?.getContext("2d", { alpha: true });

  function locale() {
    const selected = window.SiteI18n?.current?.() || "zh";
    return labels[selected] ? selected : "zh";
  }

  function text(key) {
    return labels[locale()][key] || labels.zh[key] || key;
  }

  function random(min, max) {
    return min + Math.random() * (max - min);
  }

  function readSavedMode() {
    const saved = window.LearningStorage?.getState?.().settings?.weather;
    return modes.includes(saved) ? saved : "clear";
  }

  function saveMode(nextMode) {
    window.LearningStorage?.updateSettings?.({ weather: nextMode });
  }

  function resizeCanvas() {
    if (!canvas || !context) return;
    width = window.innerWidth;
    height = window.innerHeight;
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    seedParticles();
  }

  function rainDrop(initial) {
    return {
      x: random(-80, width + 80),
      y: initial ? random(-height, height) : random(-180, -20),
      length: random(11, 28),
      speed: random(16, 28),
      wind: random(2.5, 5.5),
      width: random(0.55, 1.25),
      alpha: random(0.2, 0.55)
    };
  }

  function snowFlake(initial) {
    return {
      x: random(-20, width + 20),
      y: initial ? random(-height, height) : random(-90, -10),
      radius: random(1.2, 4.2),
      speed: random(0.55, 1.65),
      drift: random(0.25, 0.9),
      phase: random(0, Math.PI * 2),
      phaseSpeed: random(0.009, 0.025),
      alpha: random(0.38, 0.9)
    };
  }

  function seedParticles() {
    if (!width || !height || mode === "clear") {
      particles = [];
      splashes = [];
      return;
    }
    const area = width * height;
    const normalCount = mode === "rain"
      ? Math.min(190, Math.max(70, Math.round(area / 10500)))
      : Math.min(125, Math.max(42, Math.round(area / 17500)));
    const count = reducedMotion ? Math.min(24, normalCount) : normalCount;
    particles = Array.from({ length: count }, () => mode === "rain" ? rainDrop(true) : snowFlake(true));
    splashes = [];
  }

  function resetRain(drop) {
    Object.assign(drop, rainDrop(false));
  }

  function resetSnow(flake) {
    Object.assign(flake, snowFlake(false));
  }

  function drawRain(delta) {
    const dark = document.documentElement.dataset.theme === "dark";
    context.lineCap = "round";
    particles.forEach((drop) => {
      drop.x += drop.wind * delta;
      drop.y += drop.speed * delta;

      context.beginPath();
      context.moveTo(drop.x, drop.y);
      context.lineTo(drop.x - drop.wind * 1.7, drop.y - drop.length);
      context.lineWidth = drop.width;
      context.strokeStyle = dark
        ? `rgba(188, 211, 228, ${drop.alpha})`
        : `rgba(67, 86, 101, ${drop.alpha * 0.82})`;
      context.stroke();

      if (drop.y > height + drop.length) {
        if (!reducedMotion && splashes.length < 28 && Math.random() > 0.58) {
          splashes.push({ x: drop.x, y: height - random(1, 10), age: 0, life: random(8, 15), alpha: drop.alpha });
        }
        resetRain(drop);
      }
      if (drop.x > width + 100) drop.x = random(-100, -20);
    });

    splashes = splashes.filter((splash) => {
      splash.age += delta;
      const progress = splash.age / splash.life;
      if (progress >= 1) return false;
      const spread = 3 + progress * 7;
      const lift = Math.sin(progress * Math.PI) * 3.5;
      context.beginPath();
      context.moveTo(splash.x - spread, splash.y);
      context.quadraticCurveTo(splash.x - spread * 0.45, splash.y - lift, splash.x, splash.y);
      context.quadraticCurveTo(splash.x + spread * 0.45, splash.y - lift, splash.x + spread, splash.y);
      context.lineWidth = 0.7;
      context.strokeStyle = dark
        ? `rgba(188, 211, 228, ${(1 - progress) * splash.alpha})`
        : `rgba(67, 86, 101, ${(1 - progress) * splash.alpha * 0.8})`;
      context.stroke();
      return true;
    });
  }

  function drawSnow(delta) {
    const dark = document.documentElement.dataset.theme === "dark";
    particles.forEach((flake) => {
      flake.phase += flake.phaseSpeed * delta;
      flake.x += (Math.sin(flake.phase) * flake.drift + 0.14) * delta;
      flake.y += flake.speed * delta;

      context.save();
      context.beginPath();
      context.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
      context.fillStyle = dark
        ? `rgba(250, 252, 255, ${flake.alpha})`
        : `rgba(111, 128, 143, ${flake.alpha * 0.72})`;
      context.shadowBlur = flake.radius > 3 ? 5 : 2;
      context.shadowColor = dark ? "rgba(255,255,255,.4)" : "rgba(122,145,164,.26)";
      context.fill();
      context.restore();

      if (flake.y > height + 12) resetSnow(flake);
      if (flake.x > width + 25) flake.x = -20;
      if (flake.x < -25) flake.x = width + 20;
    });
  }

  function drawStaticFrame() {
    if (!context || mode === "clear") return;
    context.clearRect(0, 0, width, height);
    if (mode === "rain") drawRain(0);
    else drawSnow(0);
  }

  function animate(time) {
    if (mode === "clear" || document.hidden || reducedMotion) {
      frame = 0;
      return;
    }
    const delta = lastTime ? Math.min(2.2, (time - lastTime) / 16.67) : 1;
    lastTime = time;
    context.clearRect(0, 0, width, height);
    if (mode === "rain") drawRain(delta);
    else drawSnow(delta);
    frame = window.requestAnimationFrame(animate);
  }

  function startAnimation() {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    if (mode === "clear") {
      context?.clearRect(0, 0, width, height);
      return;
    }
    if (reducedMotion) drawStaticFrame();
    else frame = window.requestAnimationFrame(animate);
  }

  function updateControls() {
    const toggle = document.getElementById("weather-toggle");
    const currentLabel = document.getElementById("weather-label");
    if (!toggle || !currentLabel) return;
    toggle.setAttribute("aria-label", `${text("control")}：${text(mode)}`);
    toggle.title = text("control");
    currentLabel.textContent = text(mode);
    document.querySelectorAll("[data-weather-mode]").forEach((button) => {
      const optionMode = button.dataset.weatherMode;
      button.setAttribute("aria-checked", String(optionMode === mode));
      const optionLabel = button.querySelector(".weather-option-label");
      if (optionLabel) optionLabel.textContent = text(optionMode);
    });
    const heading = document.getElementById("weather-menu-title");
    if (heading) heading.textContent = text("control");
  }

  function setMode(nextMode, persist) {
    mode = modes.includes(nextMode) ? nextMode : "clear";
    document.documentElement.dataset.weather = mode;
    canvas.hidden = mode === "clear";
    atmosphere.hidden = mode === "clear";
    updateControls();
    seedParticles();
    startAnimation();
    if (persist) saveMode(mode);
  }

  function closeMenu(returnFocus) {
    const menu = document.getElementById("weather-menu");
    const toggle = document.getElementById("weather-toggle");
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    if (returnFocus) toggle.focus();
  }

  function setupControls() {
    const control = document.getElementById("weather-control");
    const toggle = document.getElementById("weather-toggle");
    const menu = document.getElementById("weather-menu");
    if (!control || !toggle || !menu) return;

    toggle.addEventListener("click", () => {
      const open = menu.hidden;
      menu.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
      if (open) menu.querySelector(`[data-weather-mode="${mode}"]`)?.focus();
    });

    menu.addEventListener("click", (event) => {
      const option = event.target.closest("[data-weather-mode]");
      if (!option) return;
      setMode(option.dataset.weatherMode, true);
      closeMenu(true);
    });

    document.addEventListener("click", (event) => {
      if (!control.contains(event.target)) closeMenu(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu(true);
    });
  }

  function init() {
    if (!canvas || !context || !atmosphere) return;
    setupControls();
    resizeCanvas();
    setMode(readSavedMode(), false);

    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resizeCanvas, 140);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (frame) window.cancelAnimationFrame(frame);
        frame = 0;
      } else {
        startAnimation();
      }
    });
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    motionQuery.addEventListener?.("change", (event) => {
      reducedMotion = event.matches;
      seedParticles();
      startAnimation();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
