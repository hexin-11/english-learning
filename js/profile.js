(function () {
  "use strict";

  const STORAGE_KEY = "hexin-profile:v1";
  const DEFAULT_NAME = "何鑫天下第一帅";
  const DEFAULT_AVATAR = "assets/avatar.jpg";
  const MAX_FILE_BYTES = 10 * 1024 * 1024;
  const MAX_STORED_IMAGE_LENGTH = 1_500_000;
  const AVATAR_SIZE = 384;

  let draftAvatar = DEFAULT_AVATAR;

  function $(selector) {
    return document.querySelector(selector);
  }

  function t(key) {
    return window.SiteI18n?.t?.(key) || key;
  }

  function normalize(candidate) {
    const source = candidate && typeof candidate === "object" ? candidate : {};
    const name = typeof source.name === "string" ? source.name.trim().slice(0, 30) : "";
    const avatar = typeof source.avatar === "string" && (
      source.avatar === DEFAULT_AVATAR || source.avatar.startsWith("data:image/")
    ) ? source.avatar : DEFAULT_AVATAR;

    return {
      name: name || DEFAULT_NAME,
      avatar
    };
  }

  function loadProfile() {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return saved ? normalize(JSON.parse(saved)) : normalize(null);
    } catch (_error) {
      return normalize(null);
    }
  }

  function saveProfile(profile) {
    const normalized = normalize(profile);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      return normalized;
    } catch (_error) {
      return null;
    }
  }

  function applyProfile(profile) {
    const normalized = normalize(profile);
    document.querySelectorAll("[data-profile-name]").forEach((element) => {
      element.textContent = normalized.name;
    });
    document.querySelectorAll("[data-profile-space]").forEach((element) => {
      element.textContent = `${normalized.name}的个人学习空间`;
    });
    document.querySelectorAll("[data-profile-avatar]").forEach((image) => {
      image.src = normalized.avatar;
      image.alt = `${normalized.name}的头像`;
    });

    document.title = normalized.name;
    const description = document.querySelector('meta[name="description"]');
    if (description) {
      description.content = `${normalized.name}的个人英语学习网站，支持课程点读、单词搜索、单词卡与本地学习进度。`;
    }
  }

  function showError(message) {
    const error = $("#profile-error");
    error.textContent = message;
    error.hidden = !message;
  }

  function openDialog() {
    const dialog = $("#profile-dialog");
    const profile = loadProfile();
    draftAvatar = profile.avatar;
    $("#profile-name-input").value = profile.name;
    $("#profile-avatar-preview").src = profile.avatar;
    $("#profile-avatar-input").value = "";
    showError("");
    dialog.showModal();
    window.setTimeout(() => $("#profile-name-input").focus(), 0);
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const objectUrl = URL.createObjectURL(file);
      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("invalid-image"));
      };
      image.src = objectUrl;
    });
  }

  async function prepareAvatar(file) {
    if (!file || !file.type.startsWith("image/")) throw new Error("invalid-image");
    if (file.size > MAX_FILE_BYTES) throw new Error("image-too-large");

    const image = await loadImage(file);
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("invalid-image");

    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
    const sourceX = Math.max(0, (image.naturalWidth - sourceSize) / 2);
    const sourceY = Math.max(0, (image.naturalHeight - sourceSize) / 2);
    context.clearRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      AVATAR_SIZE,
      AVATAR_SIZE
    );

    const dataUrl = canvas.toDataURL("image/webp", 0.86);
    if (!dataUrl.startsWith("data:image/") || dataUrl.length > MAX_STORED_IMAGE_LENGTH) {
      throw new Error("image-too-large");
    }
    return dataUrl;
  }

  async function handleAvatarChange(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    showError("");
    try {
      draftAvatar = await prepareAvatar(file);
      $("#profile-avatar-preview").src = draftAvatar;
    } catch (error) {
      showError(t(error.message === "image-too-large" ? "profile.errorSize" : "profile.errorImage"));
    } finally {
      input.value = "";
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    const name = $("#profile-name-input").value.trim();
    if (!name || name.length > 30) {
      showError(t("profile.errorName"));
      return;
    }

    const saved = saveProfile({ name, avatar: draftAvatar });
    if (!saved) {
      showError(t("profile.errorSave"));
      return;
    }

    applyProfile(saved);
    $("#profile-dialog").close();
  }

  function init() {
    const dialog = $("#profile-dialog");
    if (!dialog) return;

    applyProfile(loadProfile());
    $("#profile-edit-trigger").addEventListener("click", openDialog);
    $("#profile-avatar-input").addEventListener("change", handleAvatarChange);
    $("#profile-avatar-reset").addEventListener("click", () => {
      draftAvatar = DEFAULT_AVATAR;
      $("#profile-avatar-preview").src = DEFAULT_AVATAR;
      showError("");
    });
    $("#profile-cancel").addEventListener("click", () => dialog.close());
    $("#profile-form").addEventListener("submit", handleSubmit);
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
