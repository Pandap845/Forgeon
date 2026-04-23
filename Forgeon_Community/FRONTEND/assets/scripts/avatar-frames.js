/**
 * Forgeon avatar frames: applies CSS tier to [data-forgeon-avatar] shells.
 * Use data-user-level="N". Optional data-forgeon-use-stored-frame="true" for equipped frame (profile).
 */
(function () {
  var STORAGE_KEY = "forgeon_avatar_frame_key";

  var FRAME_TIERS = [
    { tier: 0, minLevel: 0, key: "starter", name: "Rookie ring", shellTitle: "Default frame. Reach level 10 for your first unlock." },
    { tier: 1, minLevel: 10, key: "pixel", name: "8-Bit Spawn", shellTitle: "Unlocked at level 10 — retro pixel hero frame." },
    { tier: 2, minLevel: 20, key: "neon", name: "Neon Drift", shellTitle: "Unlocked at level 20 — smooth neon arcade ring." },
    { tier: 3, minLevel: 30, key: "boss", name: "Boss Slayer", shellTitle: "Unlocked at level 30 — raid boss gold & crimson crest." },
    { tier: 4, minLevel: 40, key: "cyber", name: "Cyber Raid", shellTitle: "Unlocked at level 40 — glitch-tech HUD frame." },
    { tier: 5, minLevel: 50, key: "void", name: "Void Veil", shellTitle: "Unlocked at level 50 — void energy and violet rift ring." },
    { tier: 6, minLevel: 60, key: "titan", name: "Titan Forge", shellTitle: "Unlocked at level 60 — molten steel and forge ember ring." },
    {
      tier: 7,
      minLevel: 70,
      key: "mythic",
      name: "Mythic Legend",
      shellTitle: "Unlocked at level 70 — regal gold gear crown (max tier).",
    },
  ];

  function getFrameTierForLevel(level) {
    var best = FRAME_TIERS[0];
    for (var i = 0; i < FRAME_TIERS.length; i++) {
      if (level >= FRAME_TIERS[i].minLevel) best = FRAME_TIERS[i];
    }
    return best;
  }

  function getFrameByKey(key) {
    for (var i = 0; i < FRAME_TIERS.length; i++) {
      if (FRAME_TIERS[i].key === key) return FRAME_TIERS[i];
    }
    return null;
  }

  function readStoredFrameKey() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      return null;
    }
  }

  function writeStoredFrameKey(key) {
    try {
      if (key) localStorage.setItem(STORAGE_KEY, key);
      else localStorage.removeItem(STORAGE_KEY);
    } catch (err) {}
  }

  function getResolvedEquippedFrame(level) {
    var stored = readStoredFrameKey();
    if (!stored) return getFrameTierForLevel(level);
    var picked = getFrameByKey(stored);
    if (!picked || level < picked.minLevel) {
      writeStoredFrameKey(null);
      return getFrameTierForLevel(level);
    }
    return picked;
  }

  function frameInfoForShell(shell) {
    var levelSource = shell;
    if (!shell.getAttribute("data-user-level") && shell.closest) {
      var ancestor = shell.closest("[data-user-level]");
      if (ancestor) levelSource = ancestor;
    }
    var raw = levelSource.getAttribute("data-user-level");
    var level = parseInt(raw, 10);
    if (isNaN(level) || level < 1) level = 1;
    if (shell.getAttribute("data-forgeon-use-stored-frame") === "true") {
      return getResolvedEquippedFrame(level);
    }
    return getFrameTierForLevel(level);
  }

  function applyShell(shell) {
    if (!shell || !shell.querySelector) return;
    var frameEl = shell.querySelector(".avatar-frame");
    if (!frameEl) return;
    var info = frameInfoForShell(shell);
    frameEl.className = "avatar-frame avatar-frame--" + info.key;
    shell.setAttribute("data-frame-tier", String(info.tier));
    shell.setAttribute("title", info.shellTitle || "");
  }

  function refreshAll() {
    document.querySelectorAll("[data-forgeon-avatar]").forEach(applyShell);
  }

  window.ForgeonAvatarFrames = {
    FRAME_TIERS: FRAME_TIERS,
    STORAGE_KEY: STORAGE_KEY,
    getFrameTierForLevel: getFrameTierForLevel,
    getFrameByKey: getFrameByKey,
    readStoredFrameKey: readStoredFrameKey,
    writeStoredFrameKey: writeStoredFrameKey,
    getResolvedEquippedFrame: getResolvedEquippedFrame,
    applyShell: applyShell,
    refreshAll: refreshAll,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refreshAll);
  } else {
    refreshAll();
  }
})();
