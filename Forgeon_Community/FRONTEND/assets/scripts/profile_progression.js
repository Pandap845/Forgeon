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

  function fillAllBadgesModal(catalog, earnedIds, opts) {
    var intro = document.getElementById("allBadgesModalIntro");
    var list = document.getElementById("allBadgesModalList");
    if (!list) return;
    var nEarned = earnedIds.size;
    var viewOnly = !!(opts && opts.viewOnly);
    var username = opts && opts.username ? String(opts.username).trim() : "This user";
    if (intro) {
      intro.textContent = viewOnly
        ? username +
        " has " +
        nEarned +
        " unlocked badge" +
        (nEarned === 1 ? "" : "s") +
        " out of " +
        catalog.length +
        " total."
        : "You have " +
        nEarned +
        " unlocked badge" +
        (nEarned === 1 ? "" : "s") +
        " out of " +
        catalog.length +
        " total.";
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

  function setProfileOwnershipCopy(viewOnly, user) {
    var username = user && user.username ? String(user.username).trim() : "This user";
    var allBadgesButton = document.getElementById("allBadgesButton");
    var allBadgesIntro = document.getElementById("allBadgesModalIntro");

    if (allBadgesButton) {
      allBadgesButton.textContent = viewOnly ? username + "'s badges" : "All my badges";
    }
    if (allBadgesIntro) {
      allBadgesIntro.textContent = viewOnly ? username + " has these badges." : "Loading badges…";
    }
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
    var avatarShell = document.getElementById("avatarShell");
    var allBadgesButton = document.getElementById("allBadgesButton");
    var allBadgesModalBackdrop = document.getElementById("allBadgesModalBackdrop");

    var viewUserId = window.ForgeonProfileViewUserId || null;
    var viewOnly = !!viewUserId;
    var current = getCurrentUser();
    var token = getToken();

    if (!token) {
      if (badgeList) {
        badgeList.innerHTML =
          '<p class="field-hint" style="padding:0.5rem 0">Sign in to view profiles.</p>';
      }
      return;
    }

    var targetId = viewUserId || (current && (current.id || current._id));
    if (!targetId) {
      if (badgeList) badgeList.innerHTML = "";
      return;
    }

    if (!viewUserId && (!current || !(current.id || current._id))) {
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
      var tid = String(targetId);
      if (window.ForgeonUsersController && window.ForgeonUsersController.getById) {
        user = await window.ForgeonUsersController.getById(tid);
      } else {
        user = await fetchJson("/api/users/" + encodeURIComponent(tid));
      }
    } catch (err) {
      console.warn("profile progression load failed", err);
      if (badgeList) {
        badgeList.innerHTML =
          '<p class="field-hint" style="padding:0.5rem 0">Could not load this profile.</p>';
      }
      return;
    }

    if (!viewOnly) {
      try {
        var merged = Object.assign({}, current, user);
        localStorage.setItem(USER_KEY, JSON.stringify(merged));
      } catch (_e) { }
    }

    var banner = document.getElementById("profileViewBanner");
    var ph = document.querySelector(".profile-header h1");
    var psub = document.querySelector(".profile-header p");
    if (viewOnly) {
      if (banner) banner.classList.remove("is-hidden");
      if (ph) ph.textContent = (user.username || "Member") + "'s profile";
      if (psub) psub.textContent = "View only — you cannot edit this account.";
      document.title = "Forgeon — " + (user.username || "Profile");
    } else {
      if (banner) banner.classList.add("is-hidden");
      if (ph) ph.textContent = "My Profile";
      if (psub) psub.textContent = "Manage your personal information and achievements";
      document.title = "Forgeon - My Profile";
    }

    var badgeHeaderLabel = document.querySelector(".badge-header > span:first-child");
    if (badgeHeaderLabel) badgeHeaderLabel.textContent = viewOnly ? "Badges" : "My Badges";

    var allBadgesTitle = document.getElementById("allBadgesModalTitle");
    if (allBadgesTitle) {
      var profileName = user && user.username ? String(user.username).trim() : "User";
      allBadgesTitle.textContent = viewOnly ? profileName + "'s Badges" : "All my badges";
    }
    setProfileOwnershipCopy(viewOnly, user);

    var usernameInput = document.getElementById("username");
    if (usernameInput && user.username) usernameInput.value = String(user.username);

    var birthdayEl = document.getElementById("birthday");
    if (birthdayEl) {
      birthdayEl.value = user.birthday ? String(user.birthday).slice(0, 10) : "";
      birthdayEl.readOnly = viewOnly;
    }

    if (avatarShell) {
      avatarShell.setAttribute("data-forgeon-use-stored-frame", viewOnly ? "false" : "true");
    }

    var resolvedAvatar =
      typeof window.resolveForgeonAvatarUrl === "function"
        ? window.resolveForgeonAvatarUrl(user.avatarUrl)
        : user.avatarUrl && String(user.avatarUrl).trim()
          ? String(user.avatarUrl).trim()
          : "/assets/images/default-avatar.svg";
    var preview = document.getElementById("avatarPreview");
    if (preview) preview.src = resolvedAvatar;
    if (!viewOnly) {
      document.querySelectorAll(".nav-profile-img").forEach(function (img) {
        img.src = resolvedAvatar;
      });
    }

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
      if (viewOnly) {
        groupsCard.removeAttribute("href");
        groupsCard.classList.remove("stats-clickable");
        groupsCard.setAttribute("role", "group");
        groupsCard.setAttribute(
          "aria-label",
          "Groups joined: " + groupCount + (groupCount === 1 ? " group" : " groups")
        );
      } else {
        groupsCard.setAttribute("href", "../Groups/user_groups.html");
        groupsCard.classList.add("stats-clickable");
        groupsCard.removeAttribute("role");
        groupsCard.setAttribute(
          "aria-label",
          "View My Groups (" + groupCount + (groupCount === 1 ? " group)" : " groups)")
        );
      }
    }
    if (!viewOnly) {
      try {
        if (window.ForgeonMyGroups && typeof window.ForgeonMyGroups.setCount === "function") {
          window.ForgeonMyGroups.setCount(groupCount);
        }
      } catch (_e) { }
    }

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
        fillAllBadgesModal(cat, earnedIds, {
          viewOnly: viewOnly,
          username: user && user.username ? user.username : "This user",
        });
        openModal(allBadgesModalBackdrop);
      });
    }

    if (typeof window.ForgeonProfileSyncLevelUi === "function") {
      window.ForgeonProfileSyncLevelUi();
    }
    if (window.ForgeonAvatarFrames && typeof window.ForgeonAvatarFrames.refreshAll === "function") {
      window.ForgeonAvatarFrames.refreshAll();
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
