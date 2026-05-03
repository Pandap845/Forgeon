/**
 * Default profile image (served from /assets/...) and resolver for empty avatarUrl.
 */
(function () {
  var DEFAULT = "/assets/images/default-avatar.svg";

  window.FORGEON_DEFAULT_AVATAR_URL = DEFAULT;

  window.resolveForgeonAvatarUrl = function (url) {
    if (url != null && String(url).trim() !== "") return String(url).trim();
    return DEFAULT;
  };
})();
