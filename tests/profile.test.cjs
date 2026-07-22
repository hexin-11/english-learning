const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "js", "profile.js"), "utf8");

function renderProfile({ signedIn, email, savedProfile }) {
  const names = [{ textContent: "" }, { textContent: "" }];
  const spaces = [{ textContent: "" }];
  const avatars = [{ src: "", alt: "" }, { src: "", alt: "" }];
  const elements = new Map();
  const element = (selector) => {
    if (!elements.has(selector)) {
      elements.set(selector, {
        hidden: false,
        value: "",
        src: "",
        textContent: "",
        dataset: {},
        addEventListener() {},
        close() {},
        showModal() {},
        focus() {}
      });
    }
    return elements.get(selector);
  };
  const values = new Map();
  if (savedProfile) values.set("hexin-profile:v1", JSON.stringify(savedProfile));
  const document = {
    readyState: "complete",
    title: "",
    querySelector(selector) { return element(selector); },
    querySelectorAll(selector) {
      if (selector === "[data-profile-name]") return names;
      if (selector === "[data-profile-space]") return spaces;
      if (selector === "[data-profile-avatar]") return avatars;
      return [];
    }
  };
  const window = {
    document,
    CloudAuth: { getState: () => ({ signedIn, email }) },
    SiteI18n: { t: (key) => key },
    localStorage: {
      getItem(key) { return values.has(key) ? values.get(key) : null; },
      setItem(key, value) { values.set(key, String(value)); }
    },
    addEventListener() {},
    dispatchEvent() {},
    setTimeout(callback) { callback(); }
  };
  const sandbox = {
    window,
    document,
    Image: class {},
    URL,
    CustomEvent: class {},
    console
  };
  vm.runInNewContext(source, sandbox, { filename: "profile.js" });
  return { names, spaces, avatars, editButton: element("#profile-edit-trigger"), values };
}

{
  const rendered = renderProfile({
    signedIn: false,
    email: "",
    savedProfile: { name: "Previous User", avatar: "data:image/webp;base64,private" }
  });
  assert.deepEqual(rendered.names.map((item) => item.textContent), ["访客", "访客"]);
  assert.equal(rendered.spaces[0].textContent, "访客的个人学习空间");
  assert.equal(rendered.avatars[0].src, "assets/guest-avatar.svg");
  assert.equal(rendered.editButton.hidden, true);
}

{
  const rendered = renderProfile({ signedIn: true, email: "student@example.com" });
  assert.deepEqual(rendered.names.map((item) => item.textContent), ["student", "student"]);
  assert.equal(rendered.editButton.hidden, false);
}

{
  const rendered = renderProfile({ signedIn: true, email: "hexin20021111@gmail.com" });
  assert.deepEqual(rendered.names.map((item) => item.textContent), ["何鑫天下第一帅", "何鑫天下第一帅"]);
  assert.equal(rendered.avatars[0].src, "assets/avatar.jpg");
  assert.equal(JSON.parse(rendered.values.get("hexin-profile:v1")).identityOwner, "hexin20021111@gmail.com");
}

{
  const rendered = renderProfile({
    signedIn: true,
    email: "other@example.com",
    savedProfile: { name: "何鑫天下第一帅", avatar: "assets/avatar.jpg" }
  });
  assert.deepEqual(rendered.names.map((item) => item.textContent), ["other", "other"]);
  assert.equal(rendered.avatars[0].src, "assets/guest-avatar.svg");
}

console.log("Profile account-state tests passed.");
