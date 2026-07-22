const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const authSource = fs.readFileSync(path.join(__dirname, "..", "js", "cloud-sync.js"), "utf8");

for (const id of [
  "account-login-panel",
  "account-register-panel",
  "account-reset-panel",
  "account-recovery",
  "account-settings",
  "account-change-email-form",
  "account-change-password-form"
]) {
  assert.match(indexSource, new RegExp(`id=["']${id}["']`), `Missing ${id}`);
}

assert.match(indexSource, /id="account-register-password"[^>]+minlength="8"/);
assert.match(indexSource, /id="account-new-password"[^>]+minlength="8"/);
assert.match(authSource, /client\.auth\.signInWithPassword\(/);
assert.match(authSource, /client\.auth\.signUp\(/);
assert.match(authSource, /client\.auth\.resetPasswordForEmail\(/);
assert.match(authSource, /client\.auth\.updateUser\(\{ password:/);
assert.match(authSource, /client\.auth\.updateUser\(\{\s*email:/);
assert.doesNotMatch(authSource, /signInWithOtp|verifyOtp/);

console.log("Password authentication markup tests passed.");
