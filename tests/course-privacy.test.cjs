const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const lessonsSource = fs.readFileSync(path.join(__dirname, "..", "data", "lessons.js"), "utf8");
const privacySource = fs.readFileSync(path.join(__dirname, "..", "js", "course-privacy.js"), "utf8");

function loadFor(email, ownsPrivateLessons = false) {
  const window = {
    AccountWorkspace: { currentEmail: () => email },
    CloudAuth: { getState: () => ({ ownsPrivateLessons }) }
  };
  vm.runInNewContext(lessonsSource, { window }, { filename: "lessons.js" });
  vm.runInNewContext(privacySource, { window }, { filename: "course-privacy.js" });
  return window;
}

{
  const window = loadFor("new-owner-email@example.com", true);
  assert.equal(window.CoursePrivacy.isOwnerAccount(), true);
  assert.equal(window.CoursePrivacy.ownerLessonsForActiveAccount().length, 5);
}

{
  const window = loadFor("hexin20021111@gmail.com");
  assert.equal(Array.isArray(window.ENGLISH_LESSONS), false);
  assert.equal(window.OWNER_LESSONS.length, 5);
  const privateLessons = window.CoursePrivacy.ownerLessonsForActiveAccount();
  assert.equal(privateLessons.length, 5);
  assert.equal(privateLessons.every((lesson) => lesson._ownerOnly === true && lesson._public === false), true);
  assert.equal(window.CoursePrivacy.filterPublishable(privateLessons).length, 0);
}

{
  const window = loadFor("another@example.com");
  assert.equal(window.CoursePrivacy.ownerLessonsForActiveAccount().length, 0);
  const publishable = window.CoursePrivacy.filterPublishable([
    { id: "lesson-1" },
    { id: "public-lesson-6" }
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(publishable)), [{ id: "public-lesson-6" }]);
}

console.log("Private course access tests passed.");
