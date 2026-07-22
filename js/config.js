(function () {
  "use strict";

  const isLocal = ["127.0.0.1", "localhost"].includes(window.location.hostname);

  // 部署 GitHub Pages 时，把空字符串改为已部署的 HTTPS 后端地址。
  // Gemini 密钥只放在后端环境变量中，绝不能写进此文件。
  window.APP_CONFIG = Object.freeze({
    agentApiBase: isLocal ? "http://127.0.0.1:8787" : "",

    // Supabase 项目 URL 与 publishable key 可以安全放在公开前端。
    // 不要在这里填写 secret key 或 service_role key。
    supabaseUrl: "https://ewtvmlyqwfykgvqlysqz.supabase.co",
    supabasePublishableKey: "sb_publishable_RAEpQOBzqwCKltQN9vFmLQ_16PpmQLr",

    // 在 Supabase Auth 中启用微信自定义 OAuth 后填写其 provider 标识，例如 custom:wechat。
    // 微信 AppSecret 只保存在 Supabase，不要写入这里或提交到 GitHub。
    wechatProvider: ""
  });
})();
