(function () {
  "use strict";

  let lessons = [];
  let profiles = [];
  let publicRow = null;
  let publishArmed = false;
  let publishTimer = 0;
  let loading = false;

  function $(selector) {
    return document.querySelector(selector);
  }

  function t(key, variables) {
    return window.SiteI18n?.t?.(`admin.${key}`, variables) || key;
  }

  function escapeHTML(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function state() {
    return window.CloudAuth?.getState?.() || {
      signedIn: false,
      role: "user",
      roleStatus: "checking"
    };
  }

  function isAdmin() {
    const current = state();
    return current.signedIn && current.role === "admin";
  }

  function getLessons() {
    const active = window.EnglishLearningApp?.getLessons?.() || window.PublicLessons?.getActiveLessons?.() || [];
    const publishable = window.CoursePrivacy?.filterPublishable?.(active) || active;
    return JSON.parse(JSON.stringify(Array.isArray(publishable) ? publishable : []));
  }

  function maskEmail(email) {
    const value = String(email || "");
    const separator = value.indexOf("@");
    if (separator < 1) return value || "—";
    const name = value.slice(0, separator);
    const domain = value.slice(separator);
    const visible = name.length < 3 ? name.slice(0, 1) : name.slice(0, 2);
    return `${visible}${"*".repeat(Math.max(2, Math.min(6, name.length - visible.length)))}${domain}`;
  }

  function formatDate(value) {
    if (!value) return t("notPublished");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t("notPublished");
    return new Intl.DateTimeFormat(window.SiteI18n?.current?.() || "zh-CN", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }

  function setStatus(message, kind) {
    const box = $("#admin-status");
    if (!box) return;
    box.textContent = message || "";
    box.dataset.kind = kind || "";
  }

  function setAccess(title, message, kind) {
    const access = $("#admin-access");
    const dashboard = $("#admin-dashboard");
    if (!access || !dashboard) return;
    $("#admin-access-title").textContent = title;
    $("#admin-access-message").textContent = message;
    access.dataset.kind = kind || "";
    access.hidden = kind === "granted";
    dashboard.hidden = kind !== "granted";
  }

  function publicUpdatedAt() {
    return publicRow?.updated_at || publicRow?.content?.publishedAt || "";
  }

  function checkedLessonIds() {
    return [...document.querySelectorAll("[data-admin-lesson]:checked")].map((input) => input.value);
  }

  function renderStats() {
    const container = $("#admin-stats");
    if (!container) return;
    const selectedCount = checkedLessonIds().length;
    const items = [
      { value: lessons.length, label: t("courseCount") },
      { value: selectedCount, label: t("publicCount") },
      { value: profiles.length, label: t("usersCount") }
    ];
    container.innerHTML = items.map((item) => `
      <article class="admin-stat-card">
        <strong>${item.value}</strong>
        <span>${escapeHTML(item.label)}</span>
      </article>
    `).join("");
  }

  function renderSelection() {
    const selected = checkedLessonIds().length;
    const summary = $("#admin-selection-summary");
    const meta = $("#admin-public-meta");
    if (summary) summary.textContent = t("selection", { count: selected, total: lessons.length });
    if (meta) meta.textContent = t("publishedAt", { date: formatDate(publicUpdatedAt()) });
    renderStats();
  }

  function renderLessons() {
    lessons = getLessons();
    const container = $("#admin-course-list");
    if (!container) return;
    if (!lessons.length) {
      container.innerHTML = `<p class="admin-empty">${escapeHTML(t("noCourses"))}</p>`;
      renderSelection();
      return;
    }
    container.innerHTML = lessons.map((lesson) => {
      const sentenceCount = (lesson.sentences || []).length + (lesson.studyNotes || []).reduce((total, note) => total + (note.examples || []).length, 0);
      return `
        <label class="admin-course-row">
          <input type="checkbox" value="${escapeHTML(lesson.id)}" data-admin-lesson ${lesson._public ? "checked" : ""}>
          <span class="admin-course-number">${Number(lesson.number) || "—"}</span>
          <span class="admin-course-copy">
            <strong>${escapeHTML(lesson.title)}</strong>
            <small>${escapeHTML(t("courseMeta", { words: (lesson.words || []).length, sentences: sentenceCount }))}</small>
          </span>
          <span class="admin-course-badge" data-kind="${lesson._public ? "public" : "private"}">${escapeHTML(t(lesson._public ? "publicCourse" : "privateCourse"))}</span>
        </label>
      `;
    }).join("");
    container.querySelectorAll("[data-admin-lesson]").forEach((input) => {
      input.addEventListener("change", renderSelection);
    });
    renderSelection();
  }

  function renderProfiles() {
    const container = $("#admin-user-list");
    if (!container) return;
    if (!profiles.length) {
      container.innerHTML = `<p class="admin-empty">${escapeHTML(t("noUsers"))}</p>`;
      return;
    }
    container.innerHTML = profiles.map((profile) => `
      <article class="admin-user-row">
        <span class="admin-user-avatar" aria-hidden="true">${escapeHTML(String(profile.email || "U").slice(0, 1).toUpperCase())}</span>
        <span class="admin-user-copy">
          <strong>${escapeHTML(maskEmail(profile.email))}</strong>
          <small>${escapeHTML(t("joinedAt", { date: formatDate(profile.created_at) }))}</small>
        </span>
        <span class="admin-role-badge" data-role="${profile.role === "admin" ? "admin" : "user"}">${escapeHTML(t(profile.role === "admin" ? "roleAdmin" : "roleUser"))}</span>
      </article>
    `).join("");
  }

  function renderAccess() {
    const current = state();
    const nav = $("#admin-nav");
    if (nav) nav.hidden = !(current.signedIn && current.role === "admin");

    if (!window.CloudAuth?.isConfigured?.()) {
      setAccess(t("unconfigured"), t("unconfiguredHint"), "denied");
      return false;
    }
    if (!current.signedIn) {
      setAccess(t("loginRequired"), t("loginRequiredHint"), "denied");
      return false;
    }
    if (current.roleStatus === "checking") {
      setAccess(t("checking"), t("checkingHint"), "checking");
      return false;
    }
    if (current.roleStatus === "schema-missing") {
      setAccess(t("schemaMissing"), t("schemaMissingHint"), "error");
      return false;
    }
    if (current.role !== "admin") {
      setAccess(t("accessDenied"), t("accessDeniedHint"), "denied");
      return false;
    }
    setAccess(t("accessGranted"), t("accessGrantedHint"), "granted");
    return true;
  }

  async function loadCloudState(options) {
    if (loading || !isAdmin()) return;
    loading = true;
    setStatus(t("refreshing"));
    $("#admin-refresh").disabled = true;
    try {
      const [contentResult, profileResult] = await Promise.all([
        window.CloudAuth.fetchPublicContent(),
        window.CloudAuth.listProfiles()
      ]);
      if (contentResult.error) throw contentResult.error;
      publicRow = contentResult.row;
      profiles = profileResult;
      renderLessons();
      renderProfiles();
      setStatus(options?.quiet ? "" : t("refreshed"), "success");
    } catch (error) {
      const message = String(error?.message || error || "");
      if (/relation|profiles|site_content/i.test(message)) {
        setStatus(t("schemaMissingHint"), "error");
      } else if (/admin_required|row-level security|permission/i.test(message)) {
        setStatus(t("accessDeniedHint"), "error");
      } else {
        setStatus(t("loadFailed", { message }), "error");
      }
    } finally {
      loading = false;
      $("#admin-refresh").disabled = false;
    }
  }

  function resetPublishConfirmation() {
    publishArmed = false;
    window.clearTimeout(publishTimer);
    const button = $("#admin-publish");
    if (button) button.textContent = t("publish");
  }

  async function publish() {
    if (!isAdmin()) {
      setStatus(t("accessDeniedHint"), "error");
      return;
    }
    const selectedIds = new Set(checkedLessonIds());
    const selectedLessons = lessons.filter((lesson) => selectedIds.has(lesson.id));
    if (!selectedLessons.length) {
      setStatus(t("selectOne"), "error");
      return;
    }
    if (!publishArmed) {
      publishArmed = true;
      $("#admin-publish").textContent = t("publishConfirm");
      setStatus(t("publishWarning", { count: selectedLessons.length }), "warning");
      publishTimer = window.setTimeout(resetPublishConfirmation, 12000);
      return;
    }

    resetPublishConfirmation();
    const button = $("#admin-publish");
    button.disabled = true;
    setStatus(t("publishing"));
    try {
      publicRow = await window.CloudAuth.publishOfficialLessons(selectedLessons);
      setStatus(t("published", { count: selectedLessons.length }), "success");
      window.setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      const message = String(error?.message || error || "");
      setStatus(/admin_required|permission|row-level security/i.test(message)
        ? t("accessDeniedHint")
        : t("publishFailed", { message }), "error");
    } finally {
      button.disabled = false;
    }
  }

  function selectCourses(mode) {
    document.querySelectorAll("[data-admin-lesson]").forEach((input) => {
      const lesson = lessons.find((item) => item.id === input.value);
      input.checked = mode === "all" || Boolean(lesson?._public);
    });
    resetPublishConfirmation();
    renderSelection();
  }

  function handleAuthChange() {
    const granted = renderAccess();
    if (granted) {
      renderLessons();
      loadCloudState({ quiet: true });
    }
  }

  function init() {
    if (!$("#admin-access")) return;
    $("#admin-select-public").addEventListener("click", () => selectCourses("public"));
    $("#admin-select-all").addEventListener("click", () => selectCourses("all"));
    $("#admin-refresh").addEventListener("click", () => loadCloudState());
    $("#admin-publish").addEventListener("click", publish);
    window.addEventListener("hexin:auth-changed", handleAuthChange);
    window.addEventListener("hexin:app-ready", () => {
      if (renderAccess()) renderLessons();
    });
    handleAuthChange();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
