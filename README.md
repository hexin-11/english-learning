# 何鑫天下第一帅

一个以 GitHub Pages 为前端、可选轻量 Node.js 后端的英语学习网站。包含第一课到第五课的单词、音标、中文释义、语法例句与文章内容，适合在手机和电脑上点读、搜索、复习，并可通过“小何”学习助手练习英语。

## 功能

- 首页学习概览：课程总数、单词总数、已掌握数量、收藏数量和最近学习课程
- 课程学习：逐课展开/收起、完整中文翻译、整句朗读、隐藏中文自测
- 分级课程编辑：管理员可维护全站公共课程；普通用户只能改名、删除或增删自己新建和导入的私人课程
- 本地课程导入：选择或拖放 PDF、DOCX、图片，在浏览器中自动提取词表和中英句子，预览修改后生成第六课及后续课程
- 扫描件识别：扫描 PDF 与图片可使用浏览器 OCR；原文件不会上传或保存
- 逐词点读：点击句中单词弹出音标，可直接选择美式或英式朗读
- 双层单词搜索：课程词库支持中英文搜索，课程外英文可继续查询在线词典
- 在线词典结果：音标、中文直译、词性、英文释义及美式/英式朗读
- 单词卡：正反面复习、课程筛选、打乱顺序，并自动加载经过语义筛选、带来源标注的单词参考图片；可手动“换一张”并记住选择
- 拼写练习：支持单词、短语和完整句子听写，可按课程筛选，提供提示、跳过、答案检查、正确率和连续正确统计
- 学习状态：已掌握、待复习、最近学习记录，以及可从课程卡片直接加入的独立收藏夹
- 朗读设置：完整列出设备中的英语声音，支持美式/英式切换、声音记忆、语速调整和停止朗读
- 多语言界面：支持中文、English、한국어、日本語，课程教材内容保持原有中英对照
- 课程导出：可将全部课程或单独一课连同当前学习状态导出为 PDF 或 Word 兼容的 `.doc` 文件
- 外观设置：白色简洁界面、个人头像、响应式布局、浅色/深色模式，以及带雨滴溅射和飘雪效果的动态天气氛围
- 小何学习助手：右下角原创黑白猫咪悬浮入口，保留手绘原型并带有呼吸、轻摆与点击笑脸动画；支持自由拖动、可收起对话框、英语对话、句子批改、单词与语法解释、图片识别、四种界面语言和本地聊天记录
- 账号与云同步：提供独立注册、密码登录、找回密码和账号设置页面；首次注册验证邮箱后，可在不同手机和电脑之间同步聊天、结构化课程、课程修改、收藏和学习进度
- 管理员控制台：管理员登录后才显示“管理台”，可选择并发布全站公共课程、查看经过遮挡的账号列表；数据库 RLS 会阻止普通用户发布
- 轻量后端：原生 Node.js HTTP 服务调用 Gemini Developer API，支持高分辨率多模态识图，并包含来源白名单、图片格式与大小校验、频率限制、超时控制和安全错误信息

未登录时使用独立的访客工作区；登录后会切换到该账号自己的个人资料、聊天、课程与学习记录。退出前网站会先同步最新快照，成功后清除这台设备当前页面中的私人数据并恢复“访客”头像与网名，因此共用设备不会继续显示上一个账号的内容。课程导入所用的原始 PDF、Word 和图片不会上传。只有用户主动附加给小何识别的图片会在浏览器压缩后，经自有后端发送给 Gemini 用于本次回答；图片不会写入聊天记录、Supabase 或 Git 仓库。只有小何服务端需要 `GEMINI_API_KEY`，该密钥不会进入网页代码或 GitHub Pages。

## 项目结构

```text
.
├── index.html
├── assets/
│   ├── avatar.jpg
│   └── xiaohe-handdrawn.png
├── css/
│   └── style.css
├── js/
│   ├── admin.js
│   ├── app.js
│   ├── cloud-sync.js
│   ├── dictionary.js
│   ├── exporter.js
│   ├── i18n.js
│   ├── images.js
│   ├── importer.js
│   ├── agent.js
│   ├── config.js
│   ├── lesson-editor.js
│   ├── public-content.js
│   ├── speech.js
│   ├── spelling.js
│   ├── storage.js
│   └── weather.js
├── data/
│   ├── lessons.js
│   └── pronunciations.js
├── server/
│   ├── prompt.js
│   └── server.js
├── supabase/
│   ├── schema.sql
│   └── promote-admin.sql
├── .env.example
├── package.json
└── README.md
```

## 本地运行

在项目根目录启动任意静态文件服务器，例如：

```bash
python -m http.server 4173 --bind 127.0.0.1
```

然后访问 `http://127.0.0.1:4173/`。

也可以直接打开 `index.html`，但使用本地静态服务器更接近 GitHub Pages 的运行方式。

### 启动小何后端

需要 Node.js 20 或更高版本。真实密钥只写在项目根目录的 `.env.local`：

```dotenv
GEMINI_API_KEY=你的密钥
GEMINI_MODEL=gemini-flash-latest
PORT=8787
HOST=0.0.0.0
ALLOWED_ORIGINS=http://127.0.0.1:4173,http://localhost:4173,https://hexin-11.github.io
```

`.env.local` 已被 `.gitignore` 排除，不会被正常提交。不要把真实密钥写入 `js/config.js`、HTML、提交记录或聊天消息。启动后端：

```bash
npm start
```

网页默认连接公开的 Cloudflare Worker。需要调试本地 Node.js 后端时，访问 `http://127.0.0.1:4173/?agent=local`，它会连接 `http://127.0.0.1:8787`。可用 `http://127.0.0.1:8787/health` 检查本地后端是否启动；该接口不会显示密钥。

打开小何后，可点击输入框左侧的图片按钮、粘贴截图或把图片拖进输入框。网页会把 JPG、PNG、WebP 压缩为不超过约 1.4 MB 的 JPEG，并保留最长 2048 像素用于小字和截图识别；后端再使用 Gemini 高媒体分辨率完成画面理解。图片只参与当前一轮请求，刷新页面后不会从聊天记录恢复。

### 部署小何后端

公开后端使用 Cloudflare Workers，避免 Render 免费服务休眠后长时间唤醒。Worker 代码位于 `worker/`，Gemini 密钥只保存在 Cloudflare Secret 中。

```bash
npm install
npx wrangler login
npm run worker:secret
npm run worker:deploy
```

执行 `npm run worker:secret` 时在终端安全输入 `GEMINI_API_KEY`，不要把密钥写进 `worker/wrangler.jsonc`、`js/config.js` 或提交到 GitHub。当前公开地址为 `https://xiaohe-english-agent-hexin11.hexin20021111.workers.dev`；访问 `/health` 可以检查 `configured`、`runtime` 和 `capabilities.vision`。`render.yaml` 暂时保留为回滚方案，但网页不再连接 Render。

### 配置账号与云数据库

云同步使用 Supabase Auth 和 Postgres。未配置时账号入口会显示“云同步尚未配置”，其他本地功能不受影响。

1. 在 Supabase 创建项目。
2. 打开 `SQL Editor`，运行 [`supabase/schema.sql`](supabase/schema.sql)。该脚本会创建 `user_snapshots`、`profiles`、`site_content` 三张表，并启用 Row Level Security：每个用户只能访问自己的同步快照，只有管理员能发布全站公共课程。
3. 在项目的 `Connect` 或 `Settings → API Keys` 中复制 Project URL 与 **Publishable key**。
4. 修改 `js/config.js`：

```js
supabaseUrl: "https://你的项目.supabase.co",
supabasePublishableKey: "sb_publishable_你的公开客户端密钥",
wechatProvider: ""
```

5. 在 `Authentication → URL Configuration` 中添加：

```text
http://127.0.0.1:4173/
https://hexin-11.github.io/english-learning/
```

6. 邮箱采用“注册时验证邮箱，之后使用密码登录”。请在 `Authentication → Sign In / Providers → Email` 保持邮箱登录和 `Confirm email` 开启，并继续使用已经配置好的自定义 SMTP。注册邮件使用 `Authentication → Emails → Confirm sign up` 模板；“设置或忘记密码”使用 `Reset password` 模板。两个模板都必须保留 `{{ .ConfirmationURL }}` 链接。Supabase 只负责加密认证，密码不会写入网页代码、`profiles` 或 `user_snapshots`。
7. 已经通过旧版邮箱验证码登录过的账号不需要重新注册。打开网站登录页，点击“设置或忘记密码”，在邮件链接打开的页面设置一次密码即可。登录后的“账号设置”可以修改密码或发送邮箱变更确认；用户 ID、管理员角色和学习数据不会因此改变。
8. 在 SQL Editor 运行 [`supabase/enable-password-auth-and-private-owner.sql`](supabase/enable-password-auth-and-private-owner.sql)，确保第 1–5 课绑定到原 Gmail 用户 ID。这样该账号以后修改登录邮箱，私人课程也会继续保留。

### 设置第一个管理员

普通注册账号默认都是 `user`，不会看到管理台，也不能修改全站公共课程。设置站主账号时：

1. 先在网站完成一次注册并验证邮箱，让 `profiles` 表生成该账号。
2. 打开 [`supabase/promote-admin.sql`](supabase/promote-admin.sql)，把 `YOUR_ADMIN_EMAIL` 替换成需要设为管理员的登录邮箱。
3. 在 Supabase `SQL Editor` 运行修改后的脚本。
4. 回到网站退出再登录，或刷新页面。顶部会出现“管理台”，账号窗口会显示“管理员”。
5. 在管理台勾选需要公开的课程，再连续点击两次“发布为全站公共课程”。

不需要维护两套网站或两个注册页面：所有人使用同一个登录入口，Supabase 中的角色决定登录后显示普通学习页面还是额外的管理员控制台。前端隐藏按钮只是交互层，真正的发布权限由数据库 RLS 强制执行。

### 可选：启用微信登录

微信登录没有在前端保存 AppSecret。正式启用前需要：

1. 在微信开放平台申请并通过网站应用审核，取得 AppID 与 AppSecret，并配置授权回调域名。
2. 在 Supabase `Authentication → Providers` 新建自定义 OAuth2 Provider，标识使用 `custom:wechat`。微信账号通常不返回邮箱，配置时需要允许邮箱为空。
3. 将 Supabase 显示的 Callback URL 填入微信开放平台，并在 Supabase 保存微信 OAuth 的授权、Token 和用户信息端点。
4. 仅在配置完成后，将 `js/config.js` 中的 `wechatProvider` 改为：

```js
wechatProvider: "custom:wechat"
```

AppSecret 只保存在 Supabase 服务端配置中，绝不能写入 `js/config.js`、`.env.example` 或公开仓库。手机号短信登录目前未启用，因此不会产生验证码短信费用。

Publishable key 是给网页客户端使用的公开低权限密钥，安全性由登录会话和数据库 RLS 策略保证。绝不能把 Supabase Secret key、`service_role` key 或数据库密码写入前端。

首次启用账号隔离时，已经登录的原账号会自动接管升级前的本机记录。之后每次登录都会清除访客工作区并读取该账号自己的云端快照；退出时先同步，若同步失败则暂停退出，避免无提示地丢失学习记录。

## 维护课程内容

课程数据集中保存在 `data/lessons.js`。课文中常用单词的本地发音条目保存在 `data/pronunciations.js`。新增课程时，沿用现有的课程对象结构并填写：

- `id`、`number`、`title`
- `wordSectionTitle`、`readingTitle`
- `words`：英文、音标、中文释义
- `sentences`：英文句子和中文翻译

页面统计、课程列表、搜索和单词卡会自动读取课程数据，无需在多个文件中重复维护。也可以直接在“课程”页面导入自己的学习资料；确认后的结构化课程保存在当前浏览器的 `localStorage`，原始 PDF、Word 或图片不会保存。

管理员可在网页中修改公开课程，并从管理台发布到 `site_content`；普通用户打开公共课程时只能学习、点读、收藏和记录进度，不会看到修改或删除入口。课程卡片右侧的拖动把手支持鼠标、触摸和键盘上下键排序，新建或导入的课时固定放在列表最前面；顺序保存在课程编辑状态中，登录后同步到该账号自己的 `user_snapshots`。每个人仍可使用课时旁边的加号、文件导入功能创建私人课程，私人课程的改名、整课删除和内容增删先保存在 `localStorage`，不会被其他账号看到。所有删除和全站发布操作都采用二次点击确认。

第一至第五课被标记为 `hexin20021111@gmail.com` 的账号专属课程：其他账号和访客不会加载，管理台不会列出，发布接口也会再次过滤。若旧版本曾把它们写入 `site_content`，请在 SQL Editor 运行 [`supabase/remove-private-lessons-from-public.sql`](supabase/remove-private-lessons-from-public.sql) 清除旧公共副本；该脚本不会修改任何用户的 `user_snapshots`。

## 部署到 GitHub Pages

1. 将项目提交并推送到 GitHub 仓库。
2. 打开仓库的 `Settings → Pages`。
3. 在 `Build and deployment` 中选择 `Deploy from a branch`。
4. 选择需要发布的分支以及 `/ (root)`，保存设置。

前端仍只使用相对路径，可直接运行在 GitHub Pages。Supabase Auth 与云数据库可以直接从 GitHub Pages 前端访问；小何由独立的 Cloudflare Worker 提供 HTTPS 接口。`js/config.js` 只包含公开的 Worker 地址，Gemini 密钥保存在 Cloudflare Secret 中，不会进入前端或 GitHub。

## 浏览器说明

朗读功能基于浏览器 `SpeechSynthesis`。声音列表会自动等待系统载入，也可以点击“刷新”重新读取；可用英语声音取决于操作系统和浏览器，建议使用最新版 Chrome、Edge 或 Safari。未登录状态使用“访客”资料；已经完成云同步的账号可以在任何设备重新登录并恢复自己的头像、网名和学习记录。

课程内容、学习进度和中英文课程搜索都可在本机完成。查询课程外的英文单词时需要联网，输入内容会发送至 [Free Dictionary API](https://dictionaryapi.dev/) 获取音标和英文释义，并发送至 [MyMemory](https://mymemory.translated.net/doc/spec.php) 获取中文直译。单词卡图片通过 [Openverse](https://openverse.org/) 检索，结合课程词义、图片标题和标签进行相关度筛选，并显示作者、许可和来源链接；抽象词或低置信度结果不会强行配图。候选图片、人工选择和相邻卡片预加载都会保存在当前浏览器中，以减少重复请求和等待。以上服务均无需在项目中配置 API key。

导入功能按需从 CDN 加载 [PDF.js](https://mozilla.github.io/pdf.js/)（PDF 文字与页面渲染）、[Mammoth](https://github.com/mwilliamson/mammoth.js)（DOCX 纯文本提取）和 [Tesseract.js](https://github.com/naptha/tesseract.js)（图片与扫描页 OCR）。PDF 导出按需加载 html2pdf.js；因此首次导出 PDF 也需要联网，Word 兼容文件可直接在浏览器中生成。文件内容只在当前浏览器中处理；首次使用对应解析器时需要联网。旧版 `.doc` 请先另存为 `.docx`。OCR 不支持手写文字，识别结果应在预览区核对后保存。

## 发音数据说明

课程词表优先显示教材中原有音标；课文逐词弹层的补充北美英语音标由 [CMU Pronouncing Dictionary](https://github.com/cmusphinx/cmudict) 派生。CMUdict 版权归 Carnegie Mellon University 所有，项目文件中保留了其许可与免责声明摘要，完整条款以源仓库 `LICENSE` 为准。英式与美式的实际朗读由浏览器中对应地区的系统语音生成。
