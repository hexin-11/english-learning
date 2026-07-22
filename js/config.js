(function () {
  "use strict";

  const isLocal = ["127.0.0.1", "localhost"].includes(window.location.hostname);

  // 部署 GitHub Pages 时，把空字符串改为已部署的 HTTPS 后端地址。
  // Gemini 密钥只放在后端环境变量中，绝不能写进此文件。
  window.APP_CONFIG = Object.freeze({
    agentApiBase: isLocal ? "http://127.0.0.1:8787" : ""
  });
})();
