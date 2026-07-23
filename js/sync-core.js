(function () {
  "use strict";

  function validSnapshot(value) {
    return Boolean(
      value
      && value.schemaVersion === 1
      && value.entries
      && typeof value.entries === "object"
    );
  }

  function snapshotFingerprint(snapshot, keys) {
    if (!validSnapshot(snapshot)) return "";
    const dataKeys = Array.isArray(keys) ? keys : [];
    let hash = 2166136261;
    let length = 0;

    for (const key of dataKeys) {
      const value = typeof snapshot.entries[key] === "string"
        ? snapshot.entries[key]
        : "\u0001";
      const segment = `${key}\u0000${value}\u0002`;
      length += segment.length;
      for (let index = 0; index < segment.length; index += 1) {
        hash ^= segment.charCodeAt(index);
        hash = Math.imul(hash, 16777619) >>> 0;
      }
    }

    return `${length}:${hash.toString(16).padStart(8, "0")}`;
  }

  function decide(options) {
    const meta = options?.meta || {};
    const localFingerprint = snapshotFingerprint(options?.localSnapshot, options?.keys);
    const cloudFingerprint = snapshotFingerprint(options?.cloudSnapshot, options?.keys);
    const knownFingerprint = typeof meta.lastCloudFingerprint === "string"
      ? meta.lastCloudFingerprint
      : "";
    const localDirty = Number(meta.localRevisionAt) > Number(meta.syncedRevisionAt);
    const contentMatches = Boolean(localFingerprint && localFingerprint === cloudFingerprint);
    const cloudTime = Date.parse(options?.cloudUpdatedAt || "") || 0;
    const knownCloudTime = Date.parse(meta.lastCloudUpdatedAt || "") || 0;
    const cloudChanged = knownFingerprint
      ? cloudFingerprint !== knownFingerprint
      : cloudTime > knownCloudTime + 500;

    if (!cloudFingerprint) {
      return { action: "invalid", localFingerprint, cloudFingerprint };
    }
    if (contentMatches) {
      return { action: "acknowledge", localFingerprint, cloudFingerprint };
    }
    if (!localDirty) {
      // A clean device must trust the actual cloud contents. This intentionally
      // does not depend on updated_at, because older Supabase schemas may not
      // have installed the timestamp trigger correctly.
      return { action: "download", localFingerprint, cloudFingerprint };
    }
    if (cloudChanged || !knownFingerprint) {
      return { action: "conflict", localFingerprint, cloudFingerprint };
    }
    return { action: "upload", localFingerprint, cloudFingerprint };
  }

  window.CloudSyncCore = Object.freeze({
    validSnapshot,
    snapshotFingerprint,
    decide
  });
})();
