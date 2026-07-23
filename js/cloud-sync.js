(function () {
  "use strict";

  const SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  const TABLE_NAME = "user_snapshots";
  const PROFILE_TABLE = "profiles";
  const CONTENT_TABLE = "site_content";
  const PUBLIC_LESSONS_KEY = "official_lessons";
  const WORKSPACE = window.AccountWorkspace;
  const SYNC_CORE = window.CloudSyncCore;
  const META_KEY = WORKSPACE?.metaKey || "hexin-cloud-sync-meta:v1";
  const ROLE_KEY = "hexin-auth-role:v1";
  const PRIVATE_LESSON_OWNERS_KEY = "hexin-private-lesson-owners:v1";
  const REMEMBER_LOGIN_KEY = "hexin-auth-remember:v1";
  const REMEMBER_LOGIN_MS = 30 * 24 * 60 * 60 * 1000;
  const SYNC_KEYS = WORKSPACE?.dataKeys || [
    "hexin-english-learning:v1",
    "hexin-english-imported-lessons:v1",
    "hexin-lesson-edits:v1",
    "hexin-xiaohe-chat:v1",
    "hexin-xiaohe-memory:v1",
    "hexin-profile:v1",
    "hexin-spelling-preferences:v1",
    "hexin-word-image-choices:v2"
  ];
  const UPLOAD_DELAY_MS = 1200;
  const AUTO_SYNC_POLL_MS = 15000;
  const FOREGROUND_SYNC_THROTTLE_MS = 2000;

  let client = null;
  let activeUser = null;
  let activeRole = readRoleHint();
  let activeOwnsPrivateLessons = readPrivateLessonOwnerHint();
  let roleStatus = "checking";
  let initializedUserId = "";
  let pendingCloudRow = null;
  let recoveryMode = false;
  let uploadTimer = 0;
  let backgroundSyncTimer = 0;
  let pollTimer = 0;
  let syncChannel = null;
  let syncInFlight = false;
  let lastBackgroundSyncAt = 0;
  let busy = false;
  let authPersistenceMode = "session";
  let authPersistenceExpiresAt = 0;
  let authPersistenceInitialized = false;
  const authStorageKeys = new Set();

  function $(selector) {
    return document.querySelector(selector);
  }

  function t(key, variables) {
    return window.SiteI18n?.t?.(`cloud.${key}`, variables) || key;
  }

  function storageGet(storage, key) {
    try { return storage?.getItem?.(key) || null; } catch (_error) { return null; }
  }

  function storageSet(storage, key, value) {
    try { storage?.setItem?.(key, value); return true; } catch (_error) { return false; }
  }

  function storageRemove(storage, key) {
    try { storage?.removeItem?.(key); } catch (_error) { /* no-op */ }
  }

  function initializeAuthPersistence() {
    if (authPersistenceInitialized) return;
    authPersistenceInitialized = true;
    try {
      const saved = JSON.parse(window.localStorage.getItem(REMEMBER_LOGIN_KEY) || "null");
      const expiresAt = Number(saved?.expiresAt) || 0;
      if (saved?.enabled === true && expiresAt > Date.now()) {
        authPersistenceMode = "persistent";
        authPersistenceExpiresAt = expiresAt;
        return;
      }
    } catch (_error) {
      // 无效配置会在下面清理，并退回当前浏览器会话。
    }
    storageRemove(window.localStorage, REMEMBER_LOGIN_KEY);
    authPersistenceMode = "session";
    authPersistenceExpiresAt = 0;
  }

  function authPersistenceSnapshot() {
    initializeAuthPersistence();
    return { mode: authPersistenceMode, expiresAt: authPersistenceExpiresAt };
  }

  function prepareAuthPersistence(remember) {
    initializeAuthPersistence();
    authPersistenceMode = remember ? "persistent" : "session";
    authPersistenceExpiresAt = remember ? Date.now() + REMEMBER_LOGIN_MS : 0;
  }

  function migrateAuthStorage(remember) {
    for (const key of authStorageKeys) {
      const localValue = storageGet(window.localStorage, key);
      const sessionValue = storageGet(window.sessionStorage, key);
      const value = remember ? (localValue || sessionValue) : (sessionValue || localValue);
      if (value) {
        storageSet(remember ? window.localStorage : window.sessionStorage, key, value);
      }
      storageRemove(remember ? window.sessionStorage : window.localStorage, key);
    }
  }

  function commitAuthPersistence(remember) {
    prepareAuthPersistence(remember);
    migrateAuthStorage(remember);
    if (remember) {
      storageSet(window.localStorage, REMEMBER_LOGIN_KEY, JSON.stringify({
        enabled: true,
        expiresAt: authPersistenceExpiresAt
      }));
    } else {
      storageRemove(window.localStorage, REMEMBER_LOGIN_KEY);
    }
  }

  function restoreAuthPersistence(snapshot) {
    authPersistenceMode = snapshot?.mode === "persistent" ? "persistent" : "session";
    authPersistenceExpiresAt = Number(snapshot?.expiresAt) || 0;
  }

  function forgetAuthPersistence() {
    authPersistenceMode = "session";
    authPersistenceExpiresAt = 0;
    storageRemove(window.localStorage, REMEMBER_LOGIN_KEY);
    migrateAuthStorage(false);
    for (const key of authStorageKeys) {
      storageRemove(window.localStorage, key);
      storageRemove(window.sessionStorage, key);
    }
  }

  function createAuthStorage() {
    initializeAuthPersistence();
    return {
      getItem(key) {
        authStorageKeys.add(key);
        if (authPersistenceMode === "persistent") {
          if (authPersistenceExpiresAt > Date.now()) {
            return storageGet(window.localStorage, key);
          }
          authPersistenceMode = "session";
          authPersistenceExpiresAt = 0;
          storageRemove(window.localStorage, REMEMBER_LOGIN_KEY);
          storageRemove(window.localStorage, key);
          storageRemove(window.sessionStorage, key);
          return null;
        }

        const sessionValue = storageGet(window.sessionStorage, key);
        if (sessionValue) return sessionValue;

        // 旧版本曾把登录状态永久保存在 localStorage。首次升级时只迁移到
        // 当前标签页，避免用户在未勾选的情况下继续长期自动登录。
        const legacyValue = storageGet(window.localStorage, key);
        if (!legacyValue) return null;
        storageSet(window.sessionStorage, key, legacyValue);
        storageRemove(window.localStorage, key);
        return legacyValue;
      },
      setItem(key, value) {
        authStorageKeys.add(key);
        const persistent = authPersistenceMode === "persistent"
          && authPersistenceExpiresAt > Date.now();
        storageSet(persistent ? window.localStorage : window.sessionStorage, key, value);
        storageRemove(persistent ? window.sessionStorage : window.localStorage, key);
      },
      removeItem(key) {
        authStorageKeys.add(key);
        storageRemove(window.localStorage, key);
        storageRemove(window.sessionStorage, key);
        storageRemove(window.localStorage, REMEMBER_LOGIN_KEY);
      }
    };
  }

  function readRoleHint() {
    try {
      return window.localStorage.getItem(ROLE_KEY) === "admin" ? "admin" : "user";
    } catch (_error) {
      return "user";
    }
  }

  function readPrivateLessonOwners() {
    try {
      const value = JSON.parse(window.localStorage.getItem(PRIVATE_LESSON_OWNERS_KEY) || "[]");
      return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item) : [];
    } catch (_error) {
      return [];
    }
  }

  function readPrivateLessonOwnerHint(userId) {
    const targetUserId = String(userId || WORKSPACE?.currentOwner?.() || "").trim();
    return Boolean(targetUserId && readPrivateLessonOwners().includes(targetUserId));
  }

  function rememberPrivateLessonOwner(userId, ownsPrivateLessons) {
    const targetUserId = String(userId || "").trim();
    if (!targetUserId) return;
    const owners = new Set(readPrivateLessonOwners());
    if (ownsPrivateLessons) owners.add(targetUserId);
    else owners.delete(targetUserId);
    try { window.localStorage.setItem(PRIVATE_LESSON_OWNERS_KEY, JSON.stringify([...owners])); } catch (_error) { /* no-op */ }
  }

  function setRole(role, status) {
    activeRole = role === "admin" ? "admin" : "user";
    roleStatus = status || "ready";
    try { window.localStorage.setItem(ROLE_KEY, activeRole); } catch (_error) { /* no-op */ }
  }

  function dispatchAuthState() {
    window.dispatchEvent(new CustomEvent("hexin:auth-changed", {
      detail: {
        signedIn: Boolean(activeUser),
        userId: activeUser?.id || "",
        email: activeUser?.email || "",
        role: activeRole,
        roleStatus,
        ownsPrivateLessons: activeOwnsPrivateLessons
      }
    }));
  }

  function configured() {
    const config = window.APP_CONFIG || {};
    return Boolean(
      typeof config.supabaseUrl === "string" && config.supabaseUrl.trim() &&
      typeof config.supabasePublishableKey === "string" && config.supabasePublishableKey.trim()
    );
  }

  function reloadWorkspace() {
    if (window.location.hash === "#admin") window.location.hash = "#home";
    window.location.reload();
  }

  function wechatConfigured() {
    const provider = window.APP_CONFIG?.wechatProvider;
    return typeof provider === "string" && provider.trim().startsWith("custom:");
  }

  function readMeta() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(META_KEY) || "{}");
      return {
        userId: typeof parsed.userId === "string" ? parsed.userId : "",
        localRevisionAt: Number(parsed.localRevisionAt) || 0,
        syncedRevisionAt: Number(parsed.syncedRevisionAt) || 0,
        lastSyncedAt: Number(parsed.lastSyncedAt) || 0,
        lastCloudUpdatedAt: typeof parsed.lastCloudUpdatedAt === "string" ? parsed.lastCloudUpdatedAt : "",
        lastCloudFingerprint: typeof parsed.lastCloudFingerprint === "string" ? parsed.lastCloudFingerprint : ""
      };
    } catch (_error) {
      return { userId: "", localRevisionAt: 0, syncedRevisionAt: 0, lastSyncedAt: 0, lastCloudUpdatedAt: "", lastCloudFingerprint: "" };
    }
  }

  function writeMeta(meta) {
    try {
      window.localStorage.setItem(META_KEY, JSON.stringify(meta));
    } catch (_error) {
      // 同步仍可在当前会话继续，下一次打开时会重新核对云端版本。
    }
  }

  function readSnapshot() {
    const entries = {};
    for (const key of SYNC_KEYS) entries[key] = window.localStorage.getItem(key);
    return { schemaVersion: 1, entries };
  }

  function validSnapshot(value) {
    return SYNC_CORE?.validSnapshot?.(value)
      ?? Boolean(value && value.schemaVersion === 1 && value.entries && typeof value.entries === "object");
  }

  function snapshotFingerprint(snapshot) {
    return SYNC_CORE?.snapshotFingerprint?.(snapshot, SYNC_KEYS) || "";
  }

  function restoreSnapshot(snapshot) {
    if (!validSnapshot(snapshot)) throw new Error("INVALID_CLOUD_DATA");
    const before = readSnapshot();
    try {
      for (const key of SYNC_KEYS) {
        const value = snapshot.entries[key];
        if (typeof value === "string") window.localStorage.setItem(key, value);
        else window.localStorage.removeItem(key);
      }
    } catch (error) {
      for (const key of SYNC_KEYS) {
        const value = before.entries[key];
        if (typeof value === "string") window.localStorage.setItem(key, value);
        else window.localStorage.removeItem(key);
      }
      throw error;
    }
  }

  function setStatus(message, kind) {
    const element = $("#cloud-status");
    if (!element) return;
    element.textContent = message || "";
    element.dataset.kind = kind || "info";
  }

  function setIndicator(status) {
    const dot = $("#account-status-dot");
    if (dot) dot.dataset.status = status;
  }

  function setBusy(nextBusy) {
    busy = nextBusy;
    [
      "#account-password-sign-in",
      "#account-password-sign-up",
      "#account-send-reset",
      "#account-save-recovery-password",
      "#account-update-email",
      "#account-update-password",
      "#account-sign-out",
      "#sync-now",
      "#sync-download",
      "#sync-upload"
    ].forEach((selector) => {
      const button = $(selector);
      if (button) button.disabled = busy;
    });
  }

  function updateLastSync() {
    const element = $("#account-last-sync");
    if (!element) return;
    const meta = readMeta();
    if (!meta.lastSyncedAt) {
      element.textContent = t("notSynced");
      return;
    }
    const formatted = new Intl.DateTimeFormat(document.documentElement.lang || "zh-CN", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(meta.lastSyncedAt));
    element.textContent = t("lastSync", { time: formatted });
  }

  function showUnconfigured() {
    $("#cloud-unconfigured").hidden = false;
    $("#account-auth-form").hidden = true;
    $("#account-session").hidden = true;
    $("#account-settings").hidden = true;
    $("#account-recovery").hidden = true;
    $("#account-button-label").textContent = t("localOnly");
    setIndicator("local");
    setStatus(t("localStatus"));
  }

  function showSignedOut() {
    $("#cloud-unconfigured").hidden = true;
    $("#account-auth-form").hidden = false;
    $("#account-session").hidden = true;
    $("#account-settings").hidden = true;
    $("#account-recovery").hidden = true;
    $("#sync-choice").hidden = true;
    $("#account-button-label").textContent = t("signIn");
    setIndicator("local");
    setStatus(t("signedOutStatus"));
    recoveryMode = false;
    const roleBadge = $("#account-role-badge");
    const adminLink = $("#open-admin-console");
    if (roleBadge) roleBadge.hidden = true;
    if (adminLink) adminLink.hidden = true;
    $("#account-login-password").value = "";
    $("#account-register-password").value = "";
    $("#account-register-confirm").value = "";
    setAuthView("login");
  }

  function showSignedIn() {
    $("#cloud-unconfigured").hidden = true;
    $("#account-auth-form").hidden = true;
    $("#account-session").hidden = false;
    $("#account-settings").hidden = true;
    $("#account-recovery").hidden = true;
    $("#account-user-email").textContent = activeUser?.email || t("account");
    $("#account-button-label").textContent = activeRole === "admin" ? t("admin") : t("account");
    const roleBadge = $("#account-role-badge");
    const adminLink = $("#open-admin-console");
    if (roleBadge) {
      roleBadge.textContent = activeRole === "admin" ? t("adminRole") : t("userRole");
      roleBadge.dataset.role = activeRole;
      roleBadge.hidden = false;
    }
    if (adminLink) adminLink.hidden = activeRole !== "admin";
    setIndicator("online");
    updateLastSync();
  }

  function showConflict(row) {
    pendingCloudRow = row;
    $("#sync-choice").hidden = false;
    $("#sync-now").hidden = true;
    setStatus(t("chooseVersion"));
    const dialog = $("#account-dialog");
    if (dialog && !dialog.open) dialog.showModal();
  }

  function clearConflict() {
    pendingCloudRow = null;
    $("#sync-choice").hidden = true;
    $("#sync-now").hidden = false;
  }

  function friendlyError(error) {
    const message = String(error?.message || "").toLowerCase();
    if (message.includes("sdk_load_failed")) return t("networkError");
    if (message.includes("invalid login credentials")) return t("invalidLogin");
    if (message.includes("email not confirmed")) return t("confirmEmail");
    if (message.includes("user already registered") || message.includes("user_already_registered")) return t("alreadyRegistered");
    if (message.includes("password") && (message.includes("weak") || message.includes("short"))) return t("passwordTooShort");
    if (message.includes("new password should be different")) return t("passwordMustChange");
    if (message.includes("token") && (message.includes("expired") || message.includes("invalid"))) return t("invalidCode");
    if (message.includes("rate") || error?.status === 429) return t("tooManyRequests");
    if (message.includes("custom_provider_not_found") || message.includes("provider is not enabled")) return t("wechatUnavailable");
    if (message.includes("failed to fetch") || message.includes("network")) return t("networkError");
    if (message.includes("user_snapshots") || message.includes("relation")) return t("schemaMissing");
    if (message.includes("admin_required")) return t("adminRequired");
    if (error?.message === "INVALID_CLOUD_DATA") return t("invalidCloudData");
    return error?.message || t("genericError");
  }

  function loadSdk() {
    if (window.supabase?.createClient) return Promise.resolve(window.supabase);
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-supabase-sdk="true"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(window.supabase), { once: true });
        existing.addEventListener("error", () => reject(new Error("SDK_LOAD_FAILED")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = SDK_URL;
      script.async = true;
      script.dataset.supabaseSdk = "true";
      script.onload = () => window.supabase?.createClient
        ? resolve(window.supabase)
        : reject(new Error("SDK_LOAD_FAILED"));
      script.onerror = () => reject(new Error("SDK_LOAD_FAILED"));
      document.head.append(script);
    });
  }

  async function fetchActiveRole() {
    if (!client || !activeUser) {
      setRole("user", "signed-out");
      activeOwnsPrivateLessons = false;
      return activeRole;
    }
    let result = await client
      .from(PROFILE_TABLE)
      .select("role, owns_private_lessons")
      .eq("user_id", activeUser.id)
      .maybeSingle();
    if (result.error && String(result.error.message || "").includes("owns_private_lessons")) {
      const legacyResult = await client
        .from(PROFILE_TABLE)
        .select("role")
        .eq("user_id", activeUser.id)
        .maybeSingle();
      result = legacyResult.error
        ? legacyResult
        : {
            data: {
              ...legacyResult.data,
              owns_private_lessons: String(activeUser.email || "").trim().toLowerCase() === "hexin20021111@gmail.com"
            },
            error: null
          };
    }
    if (result.error) {
      setRole("user", "schema-missing");
      activeOwnsPrivateLessons = readPrivateLessonOwnerHint(activeUser.id);
      return activeRole;
    }
    setRole(result.data?.role, "ready");
    activeOwnsPrivateLessons = Boolean(result.data?.owns_private_lessons);
    rememberPrivateLessonOwner(activeUser.id, activeOwnsPrivateLessons);
    return activeRole;
  }

  async function fetchPublicContent() {
    if (!client) return { row: null, error: new Error("CLOUD_NOT_READY") };
    const result = await client
      .from(CONTENT_TABLE)
      .select("content, updated_at, updated_by")
      .eq("content_key", PUBLIC_LESSONS_KEY)
      .maybeSingle();
    return { row: result.data || null, error: result.error || null };
  }

  async function refreshPublicLessons(options) {
    const result = await fetchPublicContent();
    if (result.error) return result;
    if (result.row && window.PublicLessons?.applyRemote) {
      window.PublicLessons.applyRemote(result.row, { reload: options?.reload !== false });
    }
    return result;
  }

  async function publishOfficialLessons(lessons) {
    if (!client || !activeUser || activeRole !== "admin") throw new Error("ADMIN_REQUIRED");
    const publishableLessons = window.CoursePrivacy?.filterPublishable?.(lessons) || lessons;
    if (!Array.isArray(publishableLessons) || !publishableLessons.length) throw new Error("至少选择一节可公开课程后再发布。");
    const publicLessons = JSON.parse(JSON.stringify(publishableLessons.map((lesson) => {
      const { _public, imported, manual, sourceName, importedAt, ...content } = lesson || {};
      return content;
    })));
    const result = await client
      .from(CONTENT_TABLE)
      .upsert({
        content_key: PUBLIC_LESSONS_KEY,
        content: {
          schemaVersion: 1,
          lessons: publicLessons,
          publishedAt: new Date().toISOString()
        }
      }, { onConflict: "content_key" })
      .select("content, updated_at, updated_by")
      .single();
    if (result.error) throw result.error;
    window.PublicLessons?.applyRemote?.(result.data, { reload: false });
    return result.data;
  }

  async function listProfiles() {
    if (!client || !activeUser || activeRole !== "admin") throw new Error("ADMIN_REQUIRED");
    const result = await client
      .from(PROFILE_TABLE)
      .select("user_id, email, role, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (result.error) throw result.error;
    return result.data || [];
  }

  async function fetchCloudRow() {
    const result = await client
      .from(TABLE_NAME)
      .select("data, updated_at")
      .eq("user_id", activeUser.id)
      .limit(1);
    if (result.error) throw result.error;
    return result.data?.[0] || null;
  }

  async function uploadLocalSnapshot() {
    if (!client || !activeUser) return false;
    clearTimeout(uploadTimer);
    setBusy(true);
    setIndicator("saving");
    setStatus(t("saving"));
    try {
      const snapshotRevision = readMeta().localRevisionAt;
      const snapshot = readSnapshot();
      const uploadedAt = new Date().toISOString();
      const result = await client
        .from(TABLE_NAME)
        .upsert({ user_id: activeUser.id, data: snapshot, updated_at: uploadedAt }, { onConflict: "user_id" })
        .select("data, updated_at")
        .single();
      if (result.error) throw result.error;
      const now = Date.now();
      writeMeta({
        userId: activeUser.id,
        localRevisionAt: readMeta().localRevisionAt,
        syncedRevisionAt: snapshotRevision,
        lastSyncedAt: now,
        lastCloudUpdatedAt: result.data?.updated_at || uploadedAt,
        lastCloudFingerprint: snapshotFingerprint(result.data?.data || snapshot)
      });
      broadcastSnapshotUpdate(result.data?.updated_at || uploadedAt);
      clearConflict();
      updateLastSync();
      setIndicator("online");
      setStatus(t("synced"));
      return true;
    } catch (error) {
      setIndicator("error");
      setStatus(friendlyError(error), "error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function broadcastSnapshotUpdate(updatedAt) {
    if (!syncChannel || !activeUser) return;
    Promise.resolve(syncChannel.send({
      type: "broadcast",
      event: "snapshot-updated",
      payload: { updatedAt: String(updatedAt || "") }
    })).catch(() => {
      // Realtime is an acceleration layer. The polling fallback will still
      // discover this update if the websocket is temporarily unavailable.
    });
  }

  function scheduleBackgroundSync(delay = 0) {
    if (!client || !activeUser || pendingCloudRow) return;
    clearTimeout(backgroundSyncTimer);
    backgroundSyncTimer = window.setTimeout(() => {
      backgroundSyncTimer = 0;
      lastBackgroundSyncAt = Date.now();
      syncNow({ background: true, source: "automatic" });
    }, Math.max(0, Number(delay) || 0));
  }

  function stopContinuousSync() {
    clearTimeout(backgroundSyncTimer);
    clearInterval(pollTimer);
    backgroundSyncTimer = 0;
    pollTimer = 0;
    if (client && syncChannel) {
      try { client.removeChannel(syncChannel); } catch (_error) { /* no-op */ }
    }
    syncChannel = null;
  }

  function startContinuousSync() {
    stopContinuousSync();
    if (!client || !activeUser) return;

    syncChannel = client
      .channel(`snapshot-sync:${activeUser.id}`, {
        config: { broadcast: { self: false } }
      })
      .on("broadcast", { event: "snapshot-updated" }, () => {
        scheduleBackgroundSync(120);
      })
      .subscribe();

    pollTimer = window.setInterval(() => {
      if (document.visibilityState === "hidden" || !navigator.onLine) return;
      scheduleBackgroundSync(0);
    }, AUTO_SYNC_POLL_MS);
  }

  function applyCloudRow(row) {
    try {
      restoreSnapshot(row.data);
      const now = Date.now();
      writeMeta({
        userId: activeUser.id,
        localRevisionAt: now,
        syncedRevisionAt: now,
        lastSyncedAt: now,
        lastCloudUpdatedAt: row.updated_at || new Date(now).toISOString(),
        lastCloudFingerprint: snapshotFingerprint(row.data)
      });
      setStatus(t("downloaded"));
      window.location.reload();
    } catch (error) {
      setIndicator("error");
      setStatus(friendlyError(error), "error");
    }
  }

  async function syncNow(options) {
    const background = options?.background === true;
    if (!client || !activeUser || busy || syncInFlight) return;
    syncInFlight = true;
    if (!background) {
      setBusy(true);
      setIndicator("saving");
      setStatus(t("checking"));
    }
    try {
      const row = await fetchCloudRow();
      if (!row) {
        setBusy(false);
        await uploadLocalSnapshot();
        return;
      }

      const meta = readMeta();
      if (meta.userId && meta.userId !== activeUser.id) {
        showConflict(row);
        setIndicator("error");
        return;
      }
      const localSnapshot = readSnapshot();
      const decision = SYNC_CORE?.decide?.({
        meta,
        localSnapshot,
        cloudSnapshot: row.data,
        cloudUpdatedAt: row.updated_at,
        keys: SYNC_KEYS
      });

      if (!decision || decision.action === "invalid") {
        throw new Error("INVALID_CLOUD_DATA");
      }

      if (decision.action === "conflict") {
        showConflict(row);
        setIndicator("error");
      } else if (decision.action === "upload") {
        if (!background) setBusy(false);
        await uploadLocalSnapshot();
        return;
      } else if (decision.action === "download") {
        applyCloudRow(row);
        return;
      } else {
        const now = Date.now();
        writeMeta({
          ...meta,
          userId: activeUser.id,
          syncedRevisionAt: meta.localRevisionAt,
          lastSyncedAt: now,
          lastCloudUpdatedAt: row.updated_at || meta.lastCloudUpdatedAt || new Date(now).toISOString(),
          lastCloudFingerprint: decision.cloudFingerprint
        });
        setIndicator("online");
        if (!background) setStatus(t("synced"));
        updateLastSync();
      }
    } catch (error) {
      setIndicator("error");
      setStatus(friendlyError(error), "error");
    } finally {
      syncInFlight = false;
      if (!background) setBusy(false);
    }
  }

  async function reconcileFirstSession() {
    setBusy(true);
    setIndicator("saving");
    setStatus(t("checking"));
    try {
      const row = await fetchCloudRow();
      const meta = readMeta();
      if (!row) {
        setBusy(false);
        await uploadLocalSnapshot();
        return;
      }
      if (!meta.lastSyncedAt || (meta.userId && meta.userId !== activeUser.id)) {
        // A freshly activated account may already have harmless default UI
        // settings written by speech/theme initialization. Its cloud snapshot
        // is still authoritative and must not be mixed with guest data.
        applyCloudRow(row);
        return;
      }
      setBusy(false);
      await syncNow();
    } catch (error) {
      setIndicator("error");
      setStatus(friendlyError(error), "error");
    } finally {
      setBusy(false);
    }
  }

  async function adoptSession(session) {
    const nextUser = session?.user || null;
    if (!nextUser) {
      stopContinuousSync();
      activeUser = null;
      activeOwnsPrivateLessons = false;
      setRole("user", "signed-out");
      initializedUserId = "";
      clearConflict();
      clearTimeout(uploadTimer);
      const workspaceChanged = WORKSPACE?.activateGuest?.() || false;
      showSignedOut();
      dispatchAuthState();
      if (workspaceChanged) reloadWorkspace();
      return;
    }

    clearTimeout(uploadTimer);
    const workspaceChanged = WORKSPACE?.activateUser?.(nextUser.id, nextUser.email) || false;
    activeUser = nextUser;
    activeOwnsPrivateLessons = readPrivateLessonOwnerHint(nextUser.id);
    if (workspaceChanged) {
      reloadWorkspace();
      return;
    }
    const pageHadPrivateLessons = window.CoursePrivacy?.isOwnerAccount?.() || false;
    await fetchActiveRole();
    if (pageHadPrivateLessons !== (window.CoursePrivacy?.isOwnerAccount?.() || false)) {
      reloadWorkspace();
      return;
    }
    showSignedIn();
    dispatchAuthState();
    if (initializedUserId === nextUser.id) {
      startContinuousSync();
      scheduleBackgroundSync(0);
      return;
    }
    initializedUserId = nextUser.id;
    await reconcileFirstSession();
    startContinuousSync();
  }

  function markLocalChange(event) {
    const key = event?.detail?.key || event?.key;
    if (!SYNC_KEYS.includes(key)) return;
    const meta = readMeta();
    if (activeUser) meta.userId = activeUser.id;
    meta.localRevisionAt = Date.now();
    writeMeta(meta);
    if (!activeUser) return;
    clearTimeout(uploadTimer);
    // Always read the cloud row before an automatic upload. Otherwise an old
    // phone tab could change one local setting and overwrite newer lessons
    // created on the computer before the user presses “Sync now”.
    uploadTimer = window.setTimeout(
      () => syncNow({ background: true, source: "local-change" }),
      UPLOAD_DELAY_MS
    );
    setIndicator("saving");
    setStatus(t("waitingToSave"));
  }

  function setAuthView(view) {
    const next = ["login", "register", "reset"].includes(view) ? view : "login";
    $("#account-login-panel").hidden = next !== "login";
    $("#account-register-panel").hidden = next !== "register";
    $("#account-reset-panel").hidden = next !== "reset";
    document.querySelectorAll("[data-auth-view]").forEach((button) => {
      const active = button.dataset.authView === next;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });
    const firstInput = next === "register"
      ? $("#account-register-email")
      : next === "reset"
        ? $("#account-reset-email")
        : $("#account-login-email");
    window.setTimeout(() => firstInput?.focus(), 0);
  }

  function redirectUrl(mode) {
    const redirect = new URL(window.location.href);
    redirect.hash = "";
    if (mode) redirect.searchParams.set("auth", mode);
    else redirect.searchParams.delete("auth");
    return redirect.toString();
  }

  function validEmail(input) {
    return Boolean(input?.value.trim() && input.validity.valid);
  }

  function validPasswordPair(passwordInput, confirmInput) {
    const password = passwordInput?.value || "";
    const confirmation = confirmInput?.value || "";
    if (password.length < 8) {
      setStatus(t("passwordTooShort"), "error");
      return false;
    }
    if (password !== confirmation) {
      setStatus(t("passwordMismatch"), "error");
      return false;
    }
    return true;
  }

  async function signInWithPassword(event) {
    event?.preventDefault?.();
    if (!client || busy) return;
    const emailInput = $("#account-login-email");
    const passwordInput = $("#account-login-password");
    if (!validEmail(emailInput) || !passwordInput.value) {
      setStatus(t("loginFields"), "error");
      return;
    }

    const rememberLogin = Boolean($("#account-remember-login")?.checked);
    const previousPersistence = authPersistenceSnapshot();
    prepareAuthPersistence(rememberLogin);
    setBusy(true);
    setStatus(t("signingIn"));
    try {
      const result = await client.auth.signInWithPassword({
        email: emailInput.value.trim(),
        password: passwordInput.value
      });
      if (result.error) throw result.error;
      commitAuthPersistence(rememberLogin);
      passwordInput.value = "";
      await adoptSession(result.data.session);
    } catch (error) {
      restoreAuthPersistence(previousPersistence);
      setIndicator("error");
      setStatus(friendlyError(error), "error");
    } finally {
      setBusy(false);
    }
  }

  async function signUpWithPassword(event) {
    event?.preventDefault?.();
    if (!client || busy) return;
    const emailInput = $("#account-register-email");
    const passwordInput = $("#account-register-password");
    const confirmInput = $("#account-register-confirm");
    if (!validEmail(emailInput)) {
      setStatus(t("invalidFields"), "error");
      return;
    }
    if (!validPasswordPair(passwordInput, confirmInput)) return;

    setBusy(true);
    setStatus(t("creatingAccount"));
    try {
      const result = await client.auth.signUp({
        email: emailInput.value.trim(),
        password: passwordInput.value,
        options: { emailRedirectTo: redirectUrl() }
      });
      if (result.error) throw result.error;
      if (Array.isArray(result.data.user?.identities) && result.data.user.identities.length === 0) {
        throw new Error("USER_ALREADY_REGISTERED");
      }
      passwordInput.value = "";
      confirmInput.value = "";
      if (result.data.session) {
        await adoptSession(result.data.session);
        setStatus(t("accountCreated"), "success");
      } else {
        $("#account-login-email").value = emailInput.value.trim();
        setAuthView("login");
        setStatus(t("checkEmail"), "success");
      }
    } catch (error) {
      setIndicator("error");
      setStatus(friendlyError(error), "error");
    } finally {
      setBusy(false);
    }
  }

  async function requestPasswordReset(event) {
    event?.preventDefault?.();
    if (!client || busy) return;
    const emailInput = $("#account-reset-email");
    if (!validEmail(emailInput)) {
      setStatus(t("invalidFields"), "error");
      return;
    }
    setBusy(true);
    setStatus(t("sendingReset"));
    try {
      const result = await client.auth.resetPasswordForEmail(emailInput.value.trim(), {
        redirectTo: redirectUrl("recovery")
      });
      if (result.error) throw result.error;
      setStatus(t("resetEmailSent"), "success");
    } catch (error) {
      setIndicator("error");
      setStatus(friendlyError(error), "error");
    } finally {
      setBusy(false);
    }
  }

  function showRecoveryForm() {
    recoveryMode = true;
    $("#account-auth-form").hidden = true;
    $("#account-session").hidden = true;
    $("#account-settings").hidden = true;
    $("#account-recovery").hidden = false;
    const dialog = $("#account-dialog");
    if (dialog && !dialog.open) dialog.showModal();
    setStatus(t("recoveryReady"));
    window.setTimeout(() => $("#account-recovery-password")?.focus(), 0);
  }

  async function saveRecoveredPassword(event) {
    event?.preventDefault?.();
    if (!client || busy || !activeUser) return;
    const passwordInput = $("#account-recovery-password");
    const confirmInput = $("#account-recovery-confirm");
    if (!validPasswordPair(passwordInput, confirmInput)) return;
    setBusy(true);
    setStatus(t("updatingPassword"));
    try {
      const result = await client.auth.updateUser({ password: passwordInput.value });
      if (result.error) throw result.error;
      recoveryMode = false;
      passwordInput.value = "";
      confirmInput.value = "";
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("auth");
      window.history.replaceState({}, "", cleanUrl);
      showSignedIn();
      setStatus(t("passwordUpdated"), "success");
    } catch (error) {
      setIndicator("error");
      setStatus(friendlyError(error), "error");
    } finally {
      setBusy(false);
    }
  }

  function openAccountSettings() {
    if (!activeUser) return;
    $("#account-session").hidden = true;
    $("#account-settings").hidden = false;
    $("#account-new-email").value = "";
    $("#account-new-password").value = "";
    $("#account-new-password-confirm").value = "";
    setStatus("");
  }

  function closeAccountSettings() {
    $("#account-settings").hidden = true;
    $("#account-session").hidden = false;
    updateLastSync();
  }

  async function updateAccountEmail(event) {
    event?.preventDefault?.();
    if (!client || busy || !activeUser) return;
    const emailInput = $("#account-new-email");
    if (!validEmail(emailInput)) {
      setStatus(t("invalidFields"), "error");
      return;
    }
    if (emailInput.value.trim().toLowerCase() === String(activeUser.email || "").toLowerCase()) {
      setStatus(t("sameEmail"), "error");
      return;
    }
    setBusy(true);
    setStatus(t("updatingEmail"));
    try {
      const result = await client.auth.updateUser({
        email: emailInput.value.trim()
      }, { emailRedirectTo: redirectUrl() });
      if (result.error) throw result.error;
      emailInput.value = "";
      setStatus(t("emailChangeSent"), "success");
    } catch (error) {
      setIndicator("error");
      setStatus(friendlyError(error), "error");
    } finally {
      setBusy(false);
    }
  }

  async function updateAccountPassword(event) {
    event?.preventDefault?.();
    if (!client || busy || !activeUser) return;
    const passwordInput = $("#account-new-password");
    const confirmInput = $("#account-new-password-confirm");
    if (!validPasswordPair(passwordInput, confirmInput)) return;
    setBusy(true);
    setStatus(t("updatingPassword"));
    try {
      const result = await client.auth.updateUser({ password: passwordInput.value });
      if (result.error) throw result.error;
      passwordInput.value = "";
      confirmInput.value = "";
      setStatus(t("passwordUpdated"), "success");
    } catch (error) {
      setIndicator("error");
      setStatus(friendlyError(error), "error");
    } finally {
      setBusy(false);
    }
  }

  async function signInWithWechat() {
    if (!client || busy) return;
    if (!wechatConfigured()) {
      setStatus(t("wechatUnavailable"), "error");
      return;
    }
    const redirect = new URL(window.location.href);
    redirect.hash = "";
    setBusy(true);
    setStatus(t("wechatRedirecting"));
    try {
      const result = await client.auth.signInWithOAuth({
        provider: window.APP_CONFIG.wechatProvider.trim(),
        options: { redirectTo: redirect.toString() }
      });
      if (result.error) throw result.error;
      if (result.data?.url) window.location.assign(result.data.url);
    } catch (error) {
      setIndicator("error");
      setStatus(friendlyError(error), "error");
      setBusy(false);
    }
  }

  async function signOut() {
    if (!client || busy) return;
    try {
      const saved = await uploadLocalSnapshot();
      if (!saved) return;
      setBusy(true);
      const result = await client.auth.signOut();
      if (result.error) throw result.error;
      forgetAuthPersistence();
      const rememberInput = $("#account-remember-login");
      if (rememberInput) rememberInput.checked = false;
      await adoptSession(null);
    } catch (error) {
      setStatus(friendlyError(error), "error");
    } finally {
      setBusy(false);
    }
  }

  async function initializeClient() {
    if (!configured()) {
      showUnconfigured();
      return;
    }

    setIndicator("saving");
    setStatus(t("connecting"));
    try {
      const sdk = await loadSdk();
      client = sdk.createClient(
        window.APP_CONFIG.supabaseUrl.trim(),
        window.APP_CONFIG.supabasePublishableKey.trim(),
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storage: createAuthStorage()
          }
        }
      );
      client.auth.onAuthStateChange((event, session) => {
        window.setTimeout(async () => {
          await adoptSession(session);
          if (event === "PASSWORD_RECOVERY" && session?.user) showRecoveryForm();
        }, 0);
      });
      await refreshPublicLessons({ reload: true });
      const result = await client.auth.getSession();
      if (result.error) throw result.error;
      await adoptSession(result.data.session);
      if (new URL(window.location.href).searchParams.get("auth") === "recovery" && result.data.session?.user) {
        showRecoveryForm();
      }
    } catch (error) {
      setIndicator("error");
      setStatus(friendlyError(error), "error");
      $("#account-auth-form").hidden = true;
    }
  }

  function init() {
    const dialog = $("#account-dialog");
    if (!dialog) return;

    window.addEventListener("hexin:data-changed", markLocalChange);
    window.addEventListener("storage", markLocalChange);
    window.addEventListener("online", () => scheduleBackgroundSync(0));
    window.addEventListener("focus", () => {
      if (Date.now() - lastBackgroundSyncAt >= FOREGROUND_SYNC_THROTTLE_MS) {
        scheduleBackgroundSync(0);
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") scheduleBackgroundSync(0);
    });
    const rememberInput = $("#account-remember-login");
    if (rememberInput) {
      const persistence = authPersistenceSnapshot();
      rememberInput.checked = persistence.mode === "persistent"
        && persistence.expiresAt > Date.now();
    }
    $("#account-button").addEventListener("click", () => {
      dialog.showModal();
      if (activeUser && !busy) syncNow();
    });
    $("#account-dialog-close").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    document.querySelectorAll("[data-auth-view]").forEach((button) => {
      button.addEventListener("click", () => {
        setAuthView(button.dataset.authView);
        setStatus(t("signedOutStatus"));
      });
    });
    $("#account-login-panel").addEventListener("submit", signInWithPassword);
    $("#account-register-panel").addEventListener("submit", signUpWithPassword);
    $("#account-forgot-password").addEventListener("click", () => {
      $("#account-reset-email").value = $("#account-login-email").value.trim();
      setAuthView("reset");
      setStatus("");
    });
    $("#account-reset-back").addEventListener("click", () => {
      $("#account-login-email").value = $("#account-reset-email").value.trim();
      setAuthView("login");
      setStatus(t("signedOutStatus"));
    });
    $("#account-reset-panel").addEventListener("submit", requestPasswordReset);
    $("#account-recovery").addEventListener("submit", saveRecoveredPassword);
    $("#account-open-settings").addEventListener("click", openAccountSettings);
    $("#account-settings-back").addEventListener("click", closeAccountSettings);
    $("#account-change-email-form").addEventListener("submit", updateAccountEmail);
    $("#account-change-password-form").addEventListener("submit", updateAccountPassword);
    $("#account-sign-out").addEventListener("click", signOut);
    $("#open-admin-console")?.addEventListener("click", () => dialog.close());
    $("#sync-now").addEventListener("click", syncNow);
    $("#sync-download").addEventListener("click", () => {
      if (pendingCloudRow) applyCloudRow(pendingCloudRow);
    });
    $("#sync-upload").addEventListener("click", uploadLocalSnapshot);
    initializeClient();
  }

  window.CloudAuth = Object.freeze({
    isConfigured: configured,
    isSignedIn: () => Boolean(activeUser),
    isAdmin: () => activeRole === "admin",
    getState: () => ({
      signedIn: Boolean(activeUser),
      userId: activeUser?.id || "",
      email: activeUser?.email || "",
      role: activeRole,
      roleStatus,
      ownsPrivateLessons: activeOwnsPrivateLessons
    }),
    refreshRole: async () => {
      await fetchActiveRole();
      showSignedIn();
      dispatchAuthState();
      return activeRole;
    },
    refreshPublicLessons,
    fetchPublicContent,
    publishOfficialLessons,
    listProfiles
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
