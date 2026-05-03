/**
 * Loads XP, level, and badges from the API and wires the profile badge UI.
 */
(function () {
  var USER_KEY = "forgeonCurrentUser";
  var TOKEN_KEY = "forgeonAuthToken";

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || "";
    } catch (_e) {
      return "";
    }
  }

  function getCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || "null");
    } catch (_e) {
      return null;
    }
  }

  function formatDate(iso) {
    if (!iso) return "—";
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return "—";
      return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch (_e) {
      return "—";
    }
  }

  function formatXp(n) {
    var x = Math.max(0, Math.floor(Number(n) || 0));
    return String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function parseDateAttr(dateString) {
    return new Date(String(dateString || "1970-01-01").slice(0, 10) + "T00:00:00").getTime();
  }

  function sortBadgeElements(badgeList, criteria) {
    var nodes = Array.from(badgeList.querySelectorAll(".badge-clickable"));
    var rarityOrder = { legendary: 4, epic: 3, rare: 2, common: 1 };
    nodes.sort(function (badgeA, badgeB) {
      var dateA = parseDateAttr(badgeA.getAttribute("data-badge-date"));
      var dateB = parseDateAttr(badgeB.getAttribute("data-badge-date"));
      if (criteria === "rarity") {
        var rarityA = rarityOrder[badgeA.getAttribute("data-badge-rarity")] || 0;
        var rarityB = rarityOrder[badgeB.getAttribute("data-badge-rarity")] || 0;
        if (rarityB !== rarityA) return rarityB - rarityA;
      }
      return dateB - dateA;
    });
    nodes.forEach(function (badge) {
      badgeList.appendChild(badge);
    });
  }

  function updateMoreBadgesButton(badgeList, btn) {
    if (!btn || !badgeList) return;
    var expanded = badgeList.classList.contains("show-all");
    btn.textContent = expanded ? "Show fewer badges ▴" : "Show more badges ▾";
  }

  function openModal(modal) {
    if (!modal) return;
    modal.classList.remove("is-hidden");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.add("is-hidden");
    modal.setAttribute("aria-hidden", "true");
  }

  function renderBadges(badgeList, earned) {
    badgeList.innerHTML = "";
    (earned || []).forEach(function (b, idx) {
      var art = document.createElement("article");
      art.className = "badge-item badge-clickable" + (idx === 0 ? " badge-item--highlight" : "");
      art.setAttribute("data-badge-name", b.name || "");
      art.setAttribute("data-badge-description", b.description || "");
      art.setAttribute("data-badge-method", b.howToEarn || "");
      art.setAttribute("data-badge-date", (b.earnedAt && String(b.earnedAt).slice(0, 10)) || "");
      art.setAttribute("data-badge-rarity", b.rarity || "common");
      art.setAttribute("tabindex", "0");
      art.setAttribute("role", "button");
      art.setAttribute("aria-label", "View details for " + (b.name || "badge") + " badge");
      var em = document.createElement("div");
      em.className = "emoji";
      em.textContent = b.emoji || "🏅";
      var p = document.createElement("p");
      p.textContent = b.name || b.id;
      art.appendChild(em);
      art.appendChild(p);
      badgeList.appendChild(art);
    });
  }

  function wireBadgeInteractions(badgeList, badgeFilterSelect, toggleMoreBadgesButton) {
    var badgeDetailsModalBackdrop = document.getElementById("badgeDetailsModalBackdrop");
    var badgeDetailName = document.getElementById("badgeDetailName");
    var badgeDetailDescription = document.getElementById("badgeDetailDescription");
    var badgeDetailRarity = document.getElementById("badgeDetailRarity");
    var badgeDetailMethod = document.getElementById("badgeDetailMethod");
    var badgeDetailDate = document.getElementById("badgeDetailDate");

    function openBadgeDetailsModal(badge) {
      if (!badgeDetailName) return;
      badgeDetailName.textContent = badge.getAttribute("data-badge-name") || "Unknown badge";
      badgeDetailDescription.textContent = badge.getAttribute("data-badge-description") || "No description.";
      badgeDetailRarity.textContent = badge.getAttribute("data-badge-rarity") || "Unknown rarity";
      badgeDetailMethod.textContent = badge.getAttribute("data-badge-method") || "No method provided.";
      badgeDetailDate.textContent = badge.getAttribute("data-badge-date") || "Unknown date";
      openModal(badgeDetailsModalBackdrop);
    }

    badgeList.addEventListener("click", function (event) {
      var badge = event.target.closest(".badge-clickable");
      if (!badge || !badgeList.contains(badge)) return;
      openBadgeDetailsModal(badge);
    });

    badgeList.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      var badge = event.target.closest(".badge-clickable");
      if (!badge || !badgeList.contains(badge)) return;
      event.preventDefault();
      openBadgeDetailsModal(badge);
    });

    if (badgeFilterSelect) {
      badgeFilterSelect.addEventListener("change", function () {
        sortBadgeElements(badgeList, badgeFilterSelect.value);
      });
    }

    if (toggleMoreBadgesButton) {
      toggleMoreBadgesButton.addEventListener("click", function () {
        badgeList.classList.toggle("show-all");
        updateMoreBadgesButton(badgeList, toggleMoreBadgesButton);
      });
    }
  }

  function fillAllBadgesModal(catalog, earnedIds) {
    var intro = document.getElementById("allBadgesModalIntro");
    var list = document.getElementById("allBadgesModalList");
    if (!list) return;
    var nEarned = earnedIds.size;
    if (intro) {
      intro.textContent =
        "You have " + nEarned + " unlocked badge" + (nEarned === 1 ? "" : "s") + " out of " + catalog.length + " total.";
    }
    list.innerHTML = "";
    catalog.forEach(function (def) {
      var li = document.createElement("li");
      var unlocked = earnedIds.has(def.id);
      li.textContent = (def.emoji || "🏅") + " " + (def.name || def.id) + (unlocked ? "" : " (locked)");
      if (!unlocked) li.style.opacity = "0.55";
      list.appendChild(li);
    });
  }

  function applyXpUi(user) {
    var meta = document.getElementById("forgeonXpMeta");
    var fill = document.getElementById("forgeonXpBarFill");
    var bar = document.getElementById("forgeonXpBar");
    var hint = document.getElementById("forgeonXpHint");
    var pct = Math.max(0, Math.min(100, Number(user.percentToNextLevel) || 0));
    var into = Math.max(0, Number(user.xpIntoCurrentLevel) || 0);
    var need = Math.max(0, Number(user.xpToNextLevel) || 0);
    var lvl = Math.max(1, parseInt(user.level, 10) || 1);
    var cap = parseInt(user.maxLevel, 10) || 70;
    var atMax = user.isMaxLevel === true || (lvl >= cap && need === 0);

    if (meta) {
      if (atMax) {
        meta.textContent =
          formatXp(user.experiencePoints || 0) + " XP · Max level " + cap + (into > 0 ? " (+" + formatXp(into) + " past cap)" : "");
      } else {
        var needSafe = need > 0 ? need : 1;
        meta.textContent =
          formatXp(user.experiencePoints || 0) + " XP · " + into + " / " + needSafe + " to Lvl " + (lvl + 1);
      }
    }
    if (fill) fill.style.width = pct + "%";
    if (bar) {
      bar.setAttribute("aria-valuenow", String(Math.round(pct)));
      bar.setAttribute(
        "aria-valuetext",
        atMax ? "Maximum level " + cap + " reached" : pct + "% toward level " + (lvl + 1)
      );
    }
    if (hint) {
      if (atMax) {
        hint.textContent =
          "Level is capped at " +
          cap +
          ". You still earn XP; " +
          (into > 0 ? formatXp(into) + " XP is stored beyond the cap. " : "") +
          "Extra XP no longer increases your level.";
      } else {
        var needForHint = need > 0 ? need : 1;
        hint.textContent =
          "Next level at " +
          formatXp((user.experiencePoints || 0) + (needForHint - into)) +
          " total XP. Keep posting, commenting, building forums and groups, and connecting with friends.";
      }
    }
  }

  async function fetchJson(url, opts) {
    var headers = (opts && opts.headers) || {};
    var token = getToken();
    if (token) headers.Authorization = "Bearer " + token;
    var res = await fetch(url, { credentials: "include", headers: headers });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  async function load() {
    var badgeList = document.getElementById("profileBadgeList");
    var badgeFilterSelect = document.getElementById("badgeFilterSelect");
    var toggleMoreBadgesButton = document.getElementById("toggleMoreBadgesButton");
    var badgeCountLabel = document.getElementById("badgeCountLabel");
    var postsStatValue = document.getElementById("postsStatValue");
    var groupsStatValue = document.getElementById("groupsStatValue");
    var groupsCard = document.getElementById("groupsCard");
    var avatarZone = document.getElementById("avatarZone");
    var allBadgesButton = document.getElementById("allBadgesButton");
    var allBadgesModalBackdrop = document.getElementById("allBadgesModalBackdrop");

    var current = getCurrentUser();
    var token = getToken();
    if (!current || !current.id || !token) {
      if (badgeList) badgeList.innerHTML = "";
      return;
    }

    var catalog = [];
    var user = null;
    try {
      catalog = await fetchJson("/api/users/badge-catalog");
    } catch (_e) {
      catalog = [];
    }

    try {
      if (window.ForgeonUsersController && window.ForgeonUsersController.getById) {
        user = await window.ForgeonUsersController.getById(current.id);
      } else {
        user = await fetchJson("/api/users/" + encodeURIComponent(current.id));
      }
    } catch (err) {
      console.warn("profile progression load failed", err);
      return;
    }

    try {
      var merged = Object.assign({}, current, user);
      localStorage.setItem(USER_KEY, JSON.stringify(merged));
    } catch (_e) {}

    var resolvedAvatar =
      typeof window.resolveForgeonAvatarUrl === "function"
        ? window.resolveForgeonAvatarUrl(user.avatarUrl)
        : user.avatarUrl && String(user.avatarUrl).trim()
          ? String(user.avatarUrl).trim()
          : "/assets/images/default-avatar.svg";
    var preview = document.getElementById("avatarPreview");
    if (preview) preview.src = resolvedAvatar;
    document.querySelectorAll(".nav-profile-img").forEach(function (img) {
      img.src = resolvedAvatar;
    });

    if (avatarZone && user.level != null) {
      avatarZone.setAttribute("data-user-level", String(user.level));
    }

    applyXpUi(user);

    if (postsStatValue && user.postsPublished != null) {
      postsStatValue.textContent = String(user.postsPublished);
    }

    var groupCount =
      user.groupsJoinedCount != null && user.groupsJoinedCount !== undefined
        ? Number(user.groupsJoinedCount)
        : Number(user.groupsCount) || 0;
    if (Number.isNaN(groupCount) || groupCount < 0) groupCount = 0;
    if (groupsStatValue) {
      groupsStatValue.textContent = String(groupCount);
    }
    if (groupsCard) {
      groupsCard.setAttribute(
        "aria-label",
        "View My Groups (" + groupCount + (groupCount === 1 ? " group)" : " groups)")
      );
    }
    try {
      if (window.ForgeonMyGroups && typeof window.ForgeonMyGroups.setCount === "function") {
        window.ForgeonMyGroups.setCount(groupCount);
      }
    } catch (_e) {}

    var earned = user.badgesEarned || [];
    var total = user.badgeCatalogTotal || (catalog && catalog.length) || 15;
    if (badgeCountLabel) {
      badgeCountLabel.textContent = "(" + earned.length + " of " + total + ")";
    }

    var earnedIds = new Set(earned.map(function (b) {
      return b.id;
    }));

    if (badgeList) {
      renderBadges(badgeList, earned);
      sortBadgeElements(badgeList, badgeFilterSelect ? badgeFilterSelect.value : "recent");
      updateMoreBadgesButton(badgeList, toggleMoreBadgesButton);
      wireBadgeInteractions(badgeList, badgeFilterSelect, toggleMoreBadgesButton);
    }

    if (allBadgesButton && allBadgesModalBackdrop) {
      allBadgesButton.addEventListener("click", function () {
        var cat = catalog && catalog.length ? catalog : earned;
        fillAllBadgesModal(cat, earnedIds);
        openModal(allBadgesModalBackdrop);
      });
    }

    if (typeof window.ForgeonProfileSyncLevelUi === "function") {
      window.ForgeonProfileSyncLevelUi();
    }
  }

  function boot() {
    load();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.addEventListener("pageshow", function (ev) {
    if (ev.persisted) load();
  });

  window.ForgeonProfileRefreshStats = load;
})();
