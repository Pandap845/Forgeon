/**
 * Syncs all .nav-profile-img elements from forgeonCurrentUser.avatarUrl (or default).
 * Requires forgeon-avatar-url.js for resolveForgeonAvatarUrl.
 */
(function () {
  var DEFAULT_SRC = "/assets/images/default-avatar.svg";

  function apply() {
    var raw = null;
    try {
      raw = localStorage.getItem("forgeonCurrentUser");
    } catch (_e) {}

    var src = DEFAULT_SRC;
    if (raw) {
      var u;
      try {
        u = JSON.parse(raw);
      } catch (_e) {
        u = null;
      }
      if (u) {
        src =
          typeof window.resolveForgeonAvatarUrl === "function"
            ? window.resolveForgeonAvatarUrl(u.avatarUrl)
            : u.avatarUrl && String(u.avatarUrl).trim()
              ? String(u.avatarUrl).trim()
              : DEFAULT_SRC;
      }
    }

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
  window.addEventListener("storage", function (ev) {
    if (ev.key === "forgeonCurrentUser" || ev.key === "forgeonAuthToken") apply();
  });
})();
