const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "js", "account-workspace.js"), "utf8");

function createWorkspace(initialEntries = {}) {
  const values = new Map(Object.entries(initialEntries));
  const localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
  const sandbox = { window: { localStorage } };
  vm.runInNewContext(source, sandbox, { filename: "account-workspace.js" });
  return { workspace: sandbox.window.AccountWorkspace, values };
}

{
  const { workspace, values } = createWorkspace({
    "hexin-active-workspace:v1": "user-a",
    "hexin-profile:v1": JSON.stringify({ name: "User A" }),
    "hexin-xiaohe-chat:v1": "private chat",
    "hexin-cloud-sync-meta:v1": JSON.stringify({ userId: "user-a" })
  });
  assert.equal(workspace.activateGuest(), true);
  assert.equal(values.get("hexin-active-workspace:v1"), "guest");
  assert.equal(values.has("hexin-profile:v1"), false);
  assert.equal(values.has("hexin-xiaohe-chat:v1"), false);
  assert.equal(values.has("hexin-cloud-sync-meta:v1"), false);
}

{
  const { workspace, values } = createWorkspace({
    "hexin-active-workspace:v1": "guest",
    "hexin-english-learning:v1": "guest progress"
  });
  assert.equal(workspace.activateUser("user-b", "user-b@example.com"), true);
  assert.equal(values.get("hexin-active-workspace:v1"), "user-b");
  assert.equal(values.get("hexin-active-workspace-email:v1"), "user-b@example.com");
  assert.equal(values.has("hexin-english-learning:v1"), false);
}

{
  const { workspace, values } = createWorkspace({
    "hexin-profile:v1": JSON.stringify({ name: "Legacy User" })
  });
  assert.equal(workspace.activateUser("user-legacy", "legacy@example.com"), false);
  assert.equal(values.get("hexin-active-workspace:v1"), "user-legacy");
  assert.equal(values.has("hexin-profile:v1"), true);
  assert.equal(workspace.activateUser("user-legacy", "legacy@example.com"), false);
}

{
  const { workspace, values } = createWorkspace({
    "hexin-active-workspace:v1": "user-upgrade"
  });
  assert.equal(workspace.activateUser("user-upgrade", "hexin20021111@gmail.com"), true);
  assert.equal(values.get("hexin-active-workspace-email:v1"), "hexin20021111@gmail.com");
  assert.equal(workspace.activateUser("user-upgrade", "hexin20021111@gmail.com"), false);
}

console.log("Account workspace isolation tests passed.");
