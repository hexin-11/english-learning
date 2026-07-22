(function () {
  "use strict";

  const useLocalAgent = new URLSearchParams(window.location.search).get("agent") === "local";

  // 默认连接 Cloudflare Worker；本地调试后端时使用 ?agent=local。
  // Gemini 密钥只保存在 Worker Secret 或本机 .env.local，绝不能写进此文件。
  window.APP_CONFIG = Object.freeze({
    agentApiBase: useLocalAgent
      ? "http://127.0.0.1:8787"
      : "https://xiaohe-english-agent-hexin11.hexin20021111.workers.dev",

    // Supabase 项目 URL 与 publishable key 可以安全放在公开前端。
    // 不要在这里填写 secret key 或 service_role key。
    supabaseUrl: "https://ewtvmlyqwfykgvqlysqz.supabase.co",
    supabasePublishableKey: "sb_publishable_RAEpQOBzqwCKltQN9vFmLQ_16PpmQLr",

    // 在 Supabase Auth 中启用微信自定义 OAuth 后填写其 provider 标识，例如 custom:wechat。
    // 微信 AppSecret 只保存在 Supabase，不要写入这里或提交到 GitHub。
    wechatProvider: ""
  });
})();
