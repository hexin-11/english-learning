# 何鑫的英语学习网站

一个可直接部署到 GitHub Pages 的纯前端英语学习网站。包含第一课到第五课的单词、音标、中文释义、语法例句与文章内容，适合在手机和电脑上点读、搜索和复习。

## 功能

- 首页学习概览：课程总数、单词总数、已掌握数量、收藏数量和最近学习课程
- 课程学习：逐课展开/收起、完整中文翻译、整句朗读、隐藏中文自测
- 本地课程导入：选择或拖放 PDF、DOCX、图片，在浏览器中自动提取词表和中英句子，预览修改后生成第六课及后续课程
- 扫描件识别：扫描 PDF 与图片可使用浏览器 OCR；原文件不会上传或保存
- 逐词点读：点击句中单词弹出音标，可直接选择美式或英式朗读
- 双层单词搜索：课程词库支持中英文搜索，课程外英文可继续查询在线词典
- 在线词典结果：音标、中文直译、词性、英文释义及美式/英式朗读
- 单词卡：正反面复习、课程筛选、打乱顺序
- 学习状态：已掌握、待复习、收藏和最近学习记录
- 朗读设置：完整列出设备中的英语声音，支持美式/英式切换、声音记忆、语速调整和停止朗读
- 外观设置：白色简洁界面、个人头像、响应式布局、浅色/深色模式

学习进度和设置使用 `localStorage` 保存在当前浏览器中，不需要账号、API key 或数据库。

## 项目结构

```text
.
├── index.html
├── assets/
│   └── avatar.jpg
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   ├── dictionary.js
│   ├── importer.js
│   ├── speech.js
│   └── storage.js
├── data/
│   ├── lessons.js
│   └── pronunciations.js
└── README.md
```

## 本地运行

在项目根目录启动任意静态文件服务器，例如：

```bash
python -m http.server 4173 --bind 127.0.0.1
```

然后访问 `http://127.0.0.1:4173/`。

也可以直接打开 `index.html`，但使用本地静态服务器更接近 GitHub Pages 的运行方式。

## 维护课程内容

课程数据集中保存在 `data/lessons.js`。课文中常用单词的本地发音条目保存在 `data/pronunciations.js`。新增课程时，沿用现有的课程对象结构并填写：

- `id`、`number`、`title`
- `wordSectionTitle`、`readingTitle`
- `words`：英文、音标、中文释义
- `sentences`：英文句子和中文翻译

页面统计、课程列表、搜索和单词卡会自动读取课程数据，无需在多个文件中重复维护。也可以直接在“课程”页面导入自己的学习资料；确认后的结构化课程保存在当前浏览器的 `localStorage`，原始 PDF、Word 或图片不会保存。

## 部署到 GitHub Pages

1. 将项目提交并推送到 GitHub 仓库。
2. 打开仓库的 `Settings → Pages`。
3. 在 `Build and deployment` 中选择 `Deploy from a branch`。
4. 选择需要发布的分支以及 `/ (root)`，保存设置。

本项目仅使用相对路径和浏览器原生能力，可直接运行在 GitHub Pages。

## 浏览器说明

朗读功能基于浏览器 `SpeechSynthesis`。声音列表会自动等待系统载入，也可以点击“刷新”重新读取；可用英语声音取决于操作系统和浏览器，建议使用最新版 Chrome、Edge 或 Safari。学习数据只保存在当前浏览器，清除网站数据会同时清除学习记录。

课程内容、学习进度和中英文课程搜索都可在本机完成。查询课程外的英文单词时需要联网，输入内容会发送至 [Free Dictionary API](https://dictionaryapi.dev/) 获取音标和英文释义，并发送至 [MyMemory](https://mymemory.translated.net/doc/spec.php) 获取中文直译。两项服务均无需在项目中配置 API key。成功结果会在当前浏览器缓存 30 天，最多保存 80 条。

导入功能按需从 CDN 加载 [PDF.js](https://mozilla.github.io/pdf.js/)（PDF 文字与页面渲染）、[Mammoth](https://github.com/mwilliamson/mammoth.js)（DOCX 纯文本提取）和 [Tesseract.js](https://github.com/naptha/tesseract.js)（图片与扫描页 OCR）。文件内容只在当前浏览器中处理；首次使用对应解析器时需要联网。旧版 `.doc` 请先另存为 `.docx`。OCR 不支持手写文字，识别结果应在预览区核对后保存。

## 发音数据说明

课程词表优先显示教材中原有音标；课文逐词弹层的补充北美英语音标由 [CMU Pronouncing Dictionary](https://github.com/cmusphinx/cmudict) 派生。CMUdict 版权归 Carnegie Mellon University 所有，项目文件中保留了其许可与免责声明摘要，完整条款以源仓库 `LICENSE` 为准。英式与美式的实际朗读由浏览器中对应地区的系统语音生成。
