const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const agentSource = fs.readFileSync(path.join(root, "js", "agent.js"), "utf8");
const serverSource = fs.readFileSync(path.join(root, "server", "server.js"), "utf8");
const promptSource = fs.readFileSync(path.join(root, "server", "prompt.js"), "utf8");
const { cleanImage, geminiContents } = require(path.join(root, "server", "server.js"));

for (const id of [
  "agent-image-input",
  "agent-attachment",
  "agent-attachment-preview",
  "agent-attachment-remove"
]) {
  assert.match(indexSource, new RegExp(`id=["']${id}["']`), `Missing ${id}`);
}

assert.match(agentSource, /MAX_IMAGE_DIMENSION\s*=\s*2048/);
assert.match(agentSource, /MAX_IMAGE_BYTES\s*=\s*1400\s*\*\s*1024/);
assert.match(agentSource, /image:\s*attachment\s*\?/);
assert.match(agentSource, /storedMessages\s*=\s*state\.messages\.map/);
assert.match(serverSource, /mediaResolution:\s*"MEDIA_RESOLUTION_HIGH"/);
assert.match(promptSource, /图片含英文时，准确抄写、翻译、纠错/);

const jpegData = Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64");
assert.deepEqual(cleanImage({ mimeType: "image/jpeg", data: jpegData }), {
  mimeType: "image/jpeg",
  data: jpegData
});
assert.throws(
  () => cleanImage({ mimeType: "image/jpeg", data: Buffer.from("not an image").toString("base64") }),
  /INVALID_IMAGE/
);
assert.throws(() => cleanImage({ mimeType: "image/gif", data: jpegData }), /INVALID_IMAGE/);

const contents = geminiContents(
  [{ role: "assistant", content: "Please upload an image." }],
  "Read the English text.",
  { mimeType: "image/jpeg", data: jpegData }
);
const latest = contents.at(-1);
assert.equal(latest.role, "user");
assert.equal(latest.parts[0].text, "Read the English text.");
assert.equal(latest.parts[1].inlineData.mimeType, "image/jpeg");
assert.equal(latest.parts[1].inlineData.data, jpegData);

console.log("Agent vision tests passed.");
