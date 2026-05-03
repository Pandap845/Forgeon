/**
 * Syncs all .nav-profile-img elements from forgeonCurrentUser.avatarUrl (or default).
 * Requires forgeon-avatar-url.js for resolveForgeonAvatarUrl.
 */
(function () {
  function apply() {
    var raw;
    try {
      raw = localStorage.getItem("forgeonCurrentUser");
    } catch (_e) {
      return;
    }
    if (!raw) return;
    var u;
    try {
      u = JSON.parse(raw);
    } catch (_e) {
      return;
    }
    if (!u) return;
    var src =
      typeof window.resolveForgeonAvatarUrl === "function"
        ? window.resolveForgeonAvatarUrl(u.avatarUrl)
        : u.avatarUrl && String(u.avatarUrl).trim()
          ? String(u.avatarUrl).trim()
          : "/assets/images/default-avatar.svg";
    document.querySelectorAll(".nav-profile-img").forEach(function (img) {
      img.src = src;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply);
  } else {
    apply();
  }
  window.addEventListener("pageshow", function (ev) {
    if (ev.persisted) apply();
  });
})();
