(function () {
  var groupsController = window.ForgeonGroupsController;
  var membershipsController = window.ForgeonGroupMembershipsController;
  var params = new URLSearchParams(window.location.search);
  var groupId = params.get("groupId");
  var currentUserId = "";
  var currentMembership = null;
  var currentGroup = null;

  function resolveAssetUrl(url) {
    var value = String(url || "").trim();
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith("/")) return value;
    return "/" + value;
  }

  function formatDate(value) {
    var d = new Date(value);
    if (Number.isNaN(d.getTime())) return "--";
    var day = String(d.getDate()).padStart(2, "0");
    var month = String(d.getMonth() + 1).padStart(2, "0");
    var year = d.getFullYear();
    return day + "/" + month + "/" + year;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function readCurrentUserId() {
    var raw = localStorage.getItem("forgeonCurrentUser");
    if (!raw) return "";
    try {
      var parsed = JSON.parse(raw);
      return String((parsed && (parsed.id || parsed._id)) || "");
    } catch (_error) {
      return "";
    }
  }

  function getJoinButton() {
    return document.getElementById("groupJoinLink");
  }

  function setJoinButtonState() {
    var joinButton = getJoinButton();
    if (!joinButton) return;

    var creatorId =
      currentGroup && currentGroup.creator && (currentGroup.creator._id || currentGroup.creator.id)
        ? String(currentGroup.creator._id || currentGroup.creator.id)
        : "";

    if (currentUserId && creatorId && currentUserId === creatorId) {
      joinButton.textContent = "Manage Group";
      joinButton.classList.remove("dg-btn--secondary");
      joinButton.classList.add("dg-btn--primary");
      joinButton.setAttribute("href", "./group_settings.html?groupId=" + encodeURIComponent(groupId || ""));
      joinButton.removeAttribute("aria-disabled");
      return;
    }

    if (currentMembership) {
      joinButton.textContent = "Joined";
      joinButton.classList.add("dg-btn--secondary");
      joinButton.classList.remove("dg-btn--primary");
      joinButton.setAttribute("href", "#");
      joinButton.setAttribute("aria-disabled", "true");
      return;
    }

    joinButton.textContent = "Join Group";
    joinButton.classList.remove("dg-btn--secondary");
    joinButton.classList.add("dg-btn--primary");
    joinButton.setAttribute("href", "#");
    joinButton.removeAttribute("aria-disabled");
  }

  function buildMemberCard(membership) {
    var user = membership && membership.user ? membership.user : {};
    var username = user && user.username ? user.username : user && user.email ? user.email : "Unknown user";
    var level = Number(user && user.level) || 1;
    var roleLabel = membership && membership.role === "owner" ? "Group Owner" : "Member";
    var avatarUrl = resolveAssetUrl(user && user.avatarUrl);
    var avatarMarkup = avatarUrl
      ? '<img class="gd-profile-card__avatar" src="' +
        escapeHtml(avatarUrl) +
        '" alt="' +
        escapeHtml(username) +
        ' avatar" width="72" height="72" />'
      : '<div class="gd-profile-card__avatar" aria-hidden="true"></div>';

    return [
      "<li>",
      '<article class="profile-card gd-profile-card">',
      '<div class="gd-profile-card__avatar-zone">',
      '<span class="gd-profile-card__level">Lvl ' + escapeHtml(level) + "</span>",
      '<div class="avatar-shell avatar-shell--gd-profile avatar-shell--border" data-forgeon-avatar data-user-level="' + escapeHtml(level) + '">',
      '<div class="avatar-frame" aria-hidden="true"></div>',
      avatarMarkup,
      "</div>",
      "</div>",
      '<div class="gd-profile-card__body">',
      '<h3 class="gd-profile-card__name">' + escapeHtml(username) + "</h3>",
      '<p class="gd-profile-card__handle">@' + escapeHtml(username) + "</p>",
      '<p class="gd-profile-card__meta">' + roleLabel + "</p>",
      "</div>",
      '<a class="gd-profile-card__link" href="../Profile/profile.html">View profile</a>',
      "</article>",
      "</li>",
    ].join("");
  }

  async function loadMembers() {
    var membersList = document.getElementById("groupMembersList");
    if (!membersList || !groupId || !membershipsController) return;

    try {
      var memberships = await membershipsController.list({ group: groupId });
      var rows = Array.isArray(memberships) ? memberships : [];
      if (!rows.length) {
        membersList.innerHTML =
          '<li><article class="profile-card gd-profile-card"><div class="gd-profile-card__body"><h3 class="gd-profile-card__name">No members found.</h3></div></article></li>';
        return;
      }

      membersList.innerHTML = rows.map(buildMemberCard).join("");

      if (window.ForgeonAvatarFrames && typeof window.ForgeonAvatarFrames.refreshAll === "function") {
        window.ForgeonAvatarFrames.refreshAll();
      }
    } catch (error) {
      var message = String(error && error.message ? error.message : "").toLowerCase();
      membersList.innerHTML =
        '<li><article class="profile-card gd-profile-card"><div class="gd-profile-card__body"><h3 class="gd-profile-card__name">' +
        (message.indexOf("only group members can list group memberships") !== -1
          ? "Join this group to view members."
          : "Could not load group members.") +
        "</h3></div></article></li>";
    }
  }

  async function loadGroup() {
    if (!groupsController || !groupId) return;
    if (!groupId) return;

    try {
      var group = await groupsController.getById(groupId);
      currentGroup = group || null;
      var titleEl = document.getElementById("groupTitle");
      var badge = document.getElementById("groupCategoryBadge");
      var hero = document.getElementById("groupHeroImg");
      var avatar = document.getElementById("groupAvatarImg");
      var membersCount = document.getElementById("groupMembersCount");
      var creatorLine = document.getElementById("groupCreatorLine");
      var about = document.getElementById("groupAboutText");

      var groupName = group && group.name ? group.name : "Group";
      if (titleEl) titleEl.textContent = groupName;
      document.title = "Forgeon - " + groupName;

      if (badge) badge.textContent = group && group.category && group.category.name ? group.category.name : "Uncategorized";

      if (hero) {
        var heroUrl = resolveAssetUrl(group && group.coverImageUrl);
        if (heroUrl) hero.src = heroUrl;
      }

      if (avatar) {
        var iconUrl = resolveAssetUrl(group && group.iconImageUrl);
        if (iconUrl) avatar.src = iconUrl;
        avatar.alt = groupName + " avatar";
      }

      if (membersCount) {
        var count = typeof group.memberCount === "number" ? group.memberCount : 0;
        membersCount.textContent = count + " members";
      }

      if (creatorLine) {
        var creatorName = group && group.creator && group.creator.username ? group.creator.username : "Unknown";
        creatorLine.textContent = "Created by " + creatorName + " on " + formatDate(group && group.createdAt);
      }

      if (about) about.textContent = group && group.description ? group.description : "";
    } catch (_error) {}
  }

  async function loadMembershipState() {
    currentUserId = readCurrentUserId();
    currentMembership = null;

    if (!membershipsController || !groupId) return;
    try {
      var memberships = await membershipsController.list();
      if (!Array.isArray(memberships)) return;

      currentMembership =
        memberships.find(function (membership) {
          var gid =
            membership && membership.group && (membership.group._id || membership.group.id || membership.group)
              ? String(membership.group._id || membership.group.id || membership.group)
              : "";
          return gid === String(groupId);
        }) || null;
    } catch (_error) {}
  }

  async function handleJoinClick(event) {
    var button = event.target.closest("#groupJoinLink");
    if (!button || button.getAttribute("aria-disabled") === "true") return;

    var creatorId =
      currentGroup && currentGroup.creator && (currentGroup.creator._id || currentGroup.creator.id)
        ? String(currentGroup.creator._id || currentGroup.creator.id)
        : "";
    if (currentUserId && creatorId && currentUserId === creatorId) return;

    event.preventDefault();
    if (!groupId || !membershipsController || currentMembership) return;

    var originalText = button.textContent;
    button.textContent = "Joining...";
    button.setAttribute("aria-disabled", "true");

    try {
      currentMembership = await membershipsController.create({ group: groupId });
      if (currentGroup) {
        currentGroup.memberCount = typeof currentGroup.memberCount === "number" ? currentGroup.memberCount + 1 : 1;
        var membersCount = document.getElementById("groupMembersCount");
        if (membersCount) membersCount.textContent = currentGroup.memberCount + " members";
      }
      setJoinButtonState();
      await loadMembers();
    } catch (_error) {
      button.textContent = originalText;
      button.removeAttribute("aria-disabled");
    }
  }

  async function bootstrap() {
    if (!groupId) return;
    await Promise.all([loadGroup(), loadMembershipState()]);
    setJoinButtonState();
    await loadMembers();
  }

  bootstrap();

  var tabThreads = document.getElementById("tab-threads");
  var tabMembers = document.getElementById("tab-members");
  var panelThreads = document.getElementById("panel-threads");
  var panelMembers = document.getElementById("panel-members");
  var joinButton = document.getElementById("groupJoinLink");

  if (joinButton) {
    joinButton.addEventListener("click", handleJoinClick);
  }

  if (!tabThreads || !tabMembers || !panelThreads || !panelMembers) return;

  function activateThreads() {
    tabThreads.classList.add("gd-tab--active");
    tabMembers.classList.remove("gd-tab--active");
    tabThreads.setAttribute("aria-selected", "true");
    tabMembers.setAttribute("aria-selected", "false");
    panelThreads.classList.remove("gd-tab-panel--hidden");
    panelThreads.hidden = false;
    panelMembers.classList.add("gd-tab-panel--hidden");
    panelMembers.hidden = true;
  }

  function activateMembers() {
    tabMembers.classList.add("gd-tab--active");
    tabThreads.classList.remove("gd-tab--active");
    tabMembers.setAttribute("aria-selected", "true");
    tabThreads.setAttribute("aria-selected", "false");
    panelMembers.classList.remove("gd-tab-panel--hidden");
    panelMembers.hidden = false;
    panelThreads.classList.add("gd-tab-panel--hidden");
    panelThreads.hidden = true;
  }

  tabThreads.addEventListener("click", activateThreads);
  tabMembers.addEventListener("click", activateMembers);
})();
