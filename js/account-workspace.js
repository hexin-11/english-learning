(function () {
  "use strict";

  const OWNER_KEY = "hexin-active-workspace:v1";
  const EMAIL_KEY = "hexin-active-workspace-email:v1";
  const META_KEY = "hexin-cloud-sync-meta:v1";
  const GUEST_OWNER = "guest";
  const DATA_KEYS = Object.freeze([
    "hexin-english-learning:v1",
    "hexin-english-imported-lessons:v1",
    "hexin-lesson-edits:v1",
    "hexin-xiaohe-chat:v1",
    "hexin-profile:v1",
    "hexin-spelling-preferences:v1",
    "hexin-word-image-choices:v2"
  ]);

  function read(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (_error) {
      return null;
    }
  }

  function remove(key) {
    try { window.localStorage.removeItem(key); } catch (_error) { /* no-op */ }
  }

  function writeOwner(owner) {
    try {
      window.localStorage.setItem(OWNER_KEY, owner || GUEST_OWNER);
    } catch (_error) {
      // The active page still remains isolated for the current session.
    }
  }

  function currentOwner() {
    return read(OWNER_KEY) || "";
  }

  function currentEmail() {
    return (read(EMAIL_KEY) || "").trim().toLowerCase();
  }

  function writeEmail(email) {
    try {
      const normalized = String(email || "").trim().toLowerCase();
      if (normalized) window.localStorage.setItem(EMAIL_KEY, normalized);
      else window.localStorage.removeItem(EMAIL_KEY);
    } catch (_error) {
      // Account verification will retry on the next page load.
    }
  }

  function hasPrivateData() {
    if (DATA_KEYS.some((key) => read(key) !== null)) return true;
    try {
      const meta = JSON.parse(read(META_KEY) || "{}");
      return Boolean(meta && typeof meta.userId === "string" && meta.userId);
    } catch (_error) {
      return false;
    }
  }

  function clearActive() {
    for (const key of [...DATA_KEYS, META_KEY, EMAIL_KEY]) remove(key);
  }

  function activateUser(userId, email) {
    const normalizedUserId = String(userId || "").trim();
    if (!normalizedUserId) throw new Error("USER_ID_REQUIRED");
    const owner = currentOwner();
    if (owner === normalizedUserId) {
      const previousEmail = currentEmail();
      writeEmail(email);
      return previousEmail !== String(email || "").trim().toLowerCase();
    }

    // One-time migration: data created before account isolation belongs to the
    // first account already authenticated when this version is loaded.
    if (!owner && hasPrivateData()) {
      writeOwner(normalizedUserId);
      writeEmail(email);
      return false;
    }

    clearActive();
    writeOwner(normalizedUserId);
    writeEmail(email);
    return owner === GUEST_OWNER || Boolean(owner);
  }

  function activateGuest() {
    const owner = currentOwner();
    if (owner === GUEST_OWNER) return false;
    const changed = Boolean(owner) || hasPrivateData();
    clearActive();
    writeOwner(GUEST_OWNER);
    writeEmail("");
    return changed;
  }

  window.AccountWorkspace = Object.freeze({
    dataKeys: DATA_KEYS,
    metaKey: META_KEY,
    currentOwner,
    currentEmail,
    activateUser,
    activateGuest,
    clearActive
  });
})();
