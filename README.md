# 何鑫天下第一帅

一个以 GitHub Pages 为前端、可选轻量 Node.js 后端的英语学习网站。包含第一课到第五课的单词、音标、中文释义、语法例句与文章内容，适合在手机和电脑上点读、搜索、复习，并可通过“小何”学习助手练习英语。

## 功能

- 首页学习概览：课程总数、单词总数、已掌握数量、收藏数量和最近学习课程
- 课程学习：逐课展开/收起、完整中文翻译、整句朗读、隐藏中文自测
- 课程编辑：课时右上角提供三点菜单和新增按钮；所有课程均可改名或删除，词条、语法、例句、文章和句子也可直接增删
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
- 小何学习助手：右下角原创黑白猫咪悬浮入口、可收起对话框、英语对话、句子批改、单词与语法解释、四种界面语言和本地聊天记录
- 轻量后端：原生 Node.js HTTP 服务调用 Gemini Developer API，包含来源白名单、请求大小限制、频率限制、超时控制和安全错误信息

学习进度、设置和小何的聊天记录使用 `localStorage` 保存在当前浏览器中，不需要账号或数据库。只有小何的服务端需要 `GEMINI_API_KEY`，密钥不会进入网页代码或 GitHub Pages。

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
│   ├── app.js
│   ├── dictionary.js
│   ├── exporter.js
│   ├── i18n.js
│   ├── images.js
│   ├── importer.js
│   ├── agent.js
│   ├── config.js
│   ├── lesson-editor.js
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
GEMINI_MODEL=gemini-3.5-flash
PORT=8787
HOST=0.0.0.0
ALLOWED_ORIGINS=http://127.0.0.1:4173,http://localhost:4173,https://hexin-11.github.io
```

`.env.local` 已被 `.gitignore` 排除，不会被正常提交。不要把真实密钥写入 `js/config.js`、HTML、提交记录或聊天消息。启动后端：

```bash
npm start
```

本地前端继续使用 `http://127.0.0.1:4173/`，会自动连接 `http://127.0.0.1:8787`。可用 `http://127.0.0.1:8787/health` 检查后端是否启动；该接口不会显示密钥。

## 维护课程内容

课程数据集中保存在 `data/lessons.js`。课文中常用单词的本地发音条目保存在 `data/pronunciations.js`。新增课程时，沿用现有的课程对象结构并填写：

- `id`、`number`、`title`
- `wordSectionTitle`、`readingTitle`
- `words`：英文、音标、中文释义
- `sentences`：英文句子和中文翻译

页面统计、课程列表、搜索和单词卡会自动读取课程数据，无需在多个文件中重复维护。也可以直接在“课程”页面导入自己的学习资料；确认后的结构化课程保存在当前浏览器的 `localStorage`，原始 PDF、Word 或图片不会保存。

网页中的课程改名、课程新增、整课删除和内容增删同样保存在当前浏览器的 `localStorage`，不会直接覆写 `data/lessons.js`。课时右上角的三点菜单用于改名或删除，旁边的加号可创建空白本地课程。内置课程的删除属于当前浏览器中的软删除，源文件仍然保留；所有删除操作均采用二次点击确认。

## 部署到 GitHub Pages

1. 将项目提交并推送到 GitHub 仓库。
2. 打开仓库的 `Settings → Pages`。
3. 在 `Build and deployment` 中选择 `Deploy from a branch`。
4. 选择需要发布的分支以及 `/ (root)`，保存设置。

前端仍只使用相对路径，可直接运行在 GitHub Pages。GitHub Pages 不能运行 Node.js，所以公开版小何需要把 `server/` 单独部署到支持 Node.js 与环境变量的 HTTPS 服务，再把 `js/config.js` 的线上 `agentApiBase` 改为该后端地址。只把域名写进前端，密钥仍必须保存在后端平台的环境变量中。

## 浏览器说明

朗读功能基于浏览器 `SpeechSynthesis`。声音列表会自动等待系统载入，也可以点击“刷新”重新读取；可用英语声音取决于操作系统和浏览器，建议使用最新版 Chrome、Edge 或 Safari。学习数据只保存在当前浏览器，清除网站数据会同时清除学习记录。

课程内容、学习进度和中英文课程搜索都可在本机完成。查询课程外的英文单词时需要联网，输入内容会发送至 [Free Dictionary API](https://dictionaryapi.dev/) 获取音标和英文释义，并发送至 [MyMemory](https://mymemory.translated.net/doc/spec.php) 获取中文直译。单词卡图片通过 [Openverse](https://openverse.org/) 检索，结合课程词义、图片标题和标签进行相关度筛选，并显示作者、许可和来源链接；抽象词或低置信度结果不会强行配图。候选图片、人工选择和相邻卡片预加载都会保存在当前浏览器中，以减少重复请求和等待。以上服务均无需在项目中配置 API key。

导入功能按需从 CDN 加载 [PDF.js](https://mozilla.github.io/pdf.js/)（PDF 文字与页面渲染）、[Mammoth](https://github.com/mwilliamson/mammoth.js)（DOCX 纯文本提取）和 [Tesseract.js](https://github.com/naptha/tesseract.js)（图片与扫描页 OCR）。PDF 导出按需加载 html2pdf.js；因此首次导出 PDF 也需要联网，Word 兼容文件可直接在浏览器中生成。文件内容只在当前浏览器中处理；首次使用对应解析器时需要联网。旧版 `.doc` 请先另存为 `.docx`。OCR 不支持手写文字，识别结果应在预览区核对后保存。

## 发音数据说明

课程词表优先显示教材中原有音标；课文逐词弹层的补充北美英语音标由 [CMU Pronouncing Dictionary](https://github.com/cmusphinx/cmudict) 派生。CMUdict 版权归 Carnegie Mellon University 所有，项目文件中保留了其许可与免责声明摘要，完整条款以源仓库 `LICENSE` 为准。英式与美式的实际朗读由浏览器中对应地区的系统语音生成。
