(function () {
  "use strict";

  const OWNER_EMAIL = "hexin20021111@gmail.com";
  const PROTECTED_IDS = new Set(["lesson-1", "lesson-2", "lesson-3", "lesson-4", "lesson-5"]);

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function isOwnerEmail(email) {
    return normalizeEmail(email) === OWNER_EMAIL;
  }

  function activeEmail() {
    return normalizeEmail(window.AccountWorkspace?.currentEmail?.());
  }

  function isOwnerAccount() {
    return Boolean(window.CloudAuth?.getState?.().ownsPrivateLessons) || isOwnerEmail(activeEmail());
  }

  function isOwnerLesson(lesson) {
    return Boolean(lesson?._ownerOnly) || PROTECTED_IDS.has(String(lesson?.id || ""));
  }

  function ownerLessonsForActiveAccount() {
    if (!isOwnerAccount()) return [];
    const lessons = Array.isArray(window.OWNER_LESSONS) ? window.OWNER_LESSONS : [];
    return clone(lessons).map((lesson) => ({
      ...lesson,
      _public: false,
      _ownerOnly: true,
      _ownerEmail: OWNER_EMAIL
    }));
  }

  function filterPublishable(lessons) {
    return (Array.isArray(lessons) ? lessons : []).filter((lesson) => !isOwnerLesson(lesson));
  }

  window.CoursePrivacy = Object.freeze({
    ownerEmail: OWNER_EMAIL,
    protectedLessonIds: Object.freeze([...PROTECTED_IDS]),
    isOwnerEmail,
    isOwnerAccount,
    isOwnerLesson,
    ownerLessonsForActiveAccount,
    filterPublishable
  });
})();
