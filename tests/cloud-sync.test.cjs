const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "js", "sync-core.js"), "utf8");
const integrationSource = fs.readFileSync(path.join(__dirname, "..", "js", "cloud-sync.js"), "utf8");
const sandbox = { window: {} };
vm.runInNewContext(source, sandbox, { filename: "sync-core.js" });

const core = sandbox.window.CloudSyncCore;
const keys = ["progress", "lessons"];
const snapshot = (progress, lessons) => ({
  schemaVersion: 1,
  entries: { progress, lessons }
});

const cloud = snapshot("mastered:2", "lesson-6");
const phone = snapshot("mastered:1", "");
const cloudFingerprint = core.snapshotFingerprint(cloud, keys);

assert.equal(
  core.decide({
    meta: { localRevisionAt: 10, syncedRevisionAt: 10, lastCloudUpdatedAt: "2026-07-23T00:00:00Z" },
    localSnapshot: phone,
    cloudSnapshot: cloud,
    cloudUpdatedAt: "2026-07-23T00:00:00Z",
    keys
  }).action,
  "download",
  "A clean phone must download differing cloud data even when timestamps are equal"
);

assert.equal(
  core.decide({
    meta: { localRevisionAt: 20, syncedRevisionAt: 10, lastCloudFingerprint: cloudFingerprint },
    localSnapshot: snapshot("mastered:3", "lesson-6"),
    cloudSnapshot: cloud,
    cloudUpdatedAt: "2026-07-23T00:00:00Z",
    keys
  }).action,
  "upload",
  "Local changes may upload only when the known cloud contents have not changed"
);

assert.equal(
  core.decide({
    meta: { localRevisionAt: 20, syncedRevisionAt: 10, lastCloudFingerprint: core.snapshotFingerprint(phone, keys) },
    localSnapshot: snapshot("mastered:3", "lesson-7"),
    cloudSnapshot: cloud,
    cloudUpdatedAt: "2026-07-23T00:00:00Z",
    keys
  }).action,
  "conflict",
  "Concurrent phone and computer changes must not overwrite one another"
);

assert.equal(
  core.decide({
    meta: { localRevisionAt: 20, syncedRevisionAt: 10 },
    localSnapshot: cloud,
    cloudSnapshot: cloud,
    cloudUpdatedAt: "2026-07-23T00:00:00Z",
    keys
  }).action,
  "acknowledge",
  "Matching data should be acknowledged without an unnecessary reload"
);

assert.match(
  integrationSource,
  /uploadTimer\s*=\s*window\.setTimeout\(syncNow,\s*UPLOAD_DELAY_MS\)/,
  "Automatic saves must reconcile with cloud data before uploading"
);
assert.doesNotMatch(
  integrationSource,
  /uploadTimer\s*=\s*window\.setTimeout\(uploadLocalSnapshot,\s*UPLOAD_DELAY_MS\)/,
  "Automatic saves must never blindly overwrite a newer cloud snapshot"
);

console.log("Cloud sync decision tests passed.");
