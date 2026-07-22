(function () {
  "use strict";

  const HTML2PDF_URL = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
  let html2PdfPromise = null;

  function escapeHTML(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function safeFilename(value) {
    return String(value || "课程学习资料")
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) || "课程学习资料";
  }

  function wordStatus(wordId, state) {
    const labels = [];
    if (state?.mastered?.includes(wordId)) labels.push("已掌握");
    if (state?.review?.includes(wordId)) labels.push("待复习");
    if (state?.favorites?.includes(wordId)) labels.push("已收藏");
    return labels.join("、") || "未标记";
  }

  function sentenceHTML(sentence) {
    return `
      <div class="export-sentence">
        <p class="export-english">${escapeHTML(sentence.english)}</p>
        ${sentence.ipa ? `<p class="export-ipa">${escapeHTML(sentence.ipa)}</p>` : ""}
        <p>${escapeHTML(sentence.chinese)}</p>
      </div>
    `;
  }

  function lessonHTML(lesson, state) {
    const words = (lesson.words || []).map((word, index) => {
      const wordId = `${lesson.id}:${word._id || index}`;
      return `
        <tr>
          <td>${escapeHTML(word.english)}</td>
          <td>${escapeHTML(word.ipa)}</td>
          <td>${escapeHTML(word.chinese)}</td>
          <td>${escapeHTML(wordStatus(wordId, state))}</td>
        </tr>
      `;
    }).join("");

    const notes = (lesson.studyNotes || []).map((note) => `
      <section class="export-note">
        <h3>${escapeHTML(note.title)}</h3>
        ${note.description ? `<p>${escapeHTML(note.description)}</p>` : ""}
        ${(note.structures || []).length ? `<ul>${note.structures.map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul>` : ""}
        ${(note.examples || []).map(sentenceHTML).join("")}
      </section>
    `).join("");

    return `
      <article class="export-lesson">
        <header>
          <span>LESSON ${escapeHTML(lesson.number)}</span>
          <h1>${escapeHTML(lesson.title)}</h1>
          <p>${lesson.words.length} 个词条 · ${(lesson.sentences || []).length} 条文章/句子</p>
        </header>
        <h2>${escapeHTML(lesson.wordSectionTitle || "单词与短语")}</h2>
        <table>
          <thead><tr><th>英文</th><th>音标</th><th>中文</th><th>学习状态</th></tr></thead>
          <tbody>${words || '<tr><td colspan="4">暂无词条</td></tr>'}</tbody>
        </table>
        ${notes ? `<h2>语法与例句</h2>${notes}` : ""}
        <h2>${escapeHTML(lesson.readingTitle || "文章与句子")}</h2>
        ${(lesson.sentences || []).map(sentenceHTML).join("") || "<p>暂无文章或句子。</p>"}
      </article>
    `;
  }

  function documentHTML(lessons, state) {
    return `
      <div class="export-document">
        ${lessons.map((lesson) => lessonHTML(lesson, state)).join("")}
      </div>
    `;
  }

  function exportStyles() {
    return `
      .export-document{box-sizing:border-box;width:100%;padding:24px;background:#fff;color:#181818;font-family:Arial,"Microsoft YaHei","PingFang SC",sans-serif;font-size:13px;line-height:1.65}
      .export-document *{box-sizing:border-box}.export-lesson{page-break-after:always}.export-lesson:last-child{page-break-after:auto}
      .export-lesson header{padding-bottom:14px;border-bottom:2px solid #181818}.export-lesson header span{font-size:10px;letter-spacing:.12em;color:#666}
      .export-lesson h1{margin:4px 0 0;font-size:28px}.export-lesson h2{margin:24px 0 10px;font-size:18px}.export-lesson h3{margin:18px 0 5px;font-size:15px}
      .export-lesson p{margin:5px 0}.export-lesson table{width:100%;border-collapse:collapse;page-break-inside:auto}
      .export-lesson th,.export-lesson td{padding:7px 8px;border:1px solid #bbb;text-align:left;vertical-align:top}.export-lesson th{background:#f1f1f1}
      .export-ipa{color:#666}.export-sentence{margin:8px 0;padding:10px 12px;border-left:3px solid #bbb;background:#f7f7f7;page-break-inside:avoid}
      .export-english{font-weight:600}.export-note{page-break-inside:avoid}
    `;
  }

  function loadHtml2Pdf() {
    if (window.html2pdf) return Promise.resolve(window.html2pdf);
    if (html2PdfPromise) return html2PdfPromise;
    html2PdfPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = HTML2PDF_URL;
      script.async = true;
      script.onload = () => resolve(window.html2pdf);
      script.onerror = () => reject(new Error("PDF 导出组件加载失败，请检查网络。"));
      document.head.append(script);
    });
    return html2PdfPromise;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportWord(lessons, state, title) {
    const body = documentHTML(lessons, state);
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>${exportStyles()}</style></head><body>${body}</body></html>`;
    const blob = new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" });
    downloadBlob(blob, `${safeFilename(title)}.doc`);
  }

  async function exportPdf(lessons, state, title) {
    const html2pdf = await loadHtml2Pdf();
    if (typeof html2pdf !== "function") throw new Error("PDF 导出组件没有正确加载。");
    const wrapper = document.createElement("div");
    wrapper.className = "export-render-host";
    wrapper.style.cssText = "position:fixed;left:-100000px;top:0;width:794px;background:#fff;z-index:-1";
    wrapper.innerHTML = `<style>${exportStyles()}</style>${documentHTML(lessons, state)}`;
    document.body.append(wrapper);
    try {
      await html2pdf().set({
        margin: [9, 9, 9, 9],
        filename: `${safeFilename(title)}.pdf`,
        image: { type: "jpeg", quality: 0.96 },
        html2canvas: { scale: 1.5, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] }
      }).from(wrapper.querySelector(".export-document")).save();
    } finally {
      wrapper.remove();
    }
  }

  window.CourseExporter = { exportPdf, exportWord };
})();
