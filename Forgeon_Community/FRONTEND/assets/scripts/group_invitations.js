(function () {
  var searchInput = document.getElementById("inviteSearch");
  var searchResults = document.getElementById("inviteSearchResults");
  var searchEmpty = document.getElementById("inviteSearchEmpty");
  var inviteList = document.getElementById("inviteList");
  var inviteCountBadge = document.getElementById("inviteCountBadge");
  var revokeAllBtn = document.getElementById("revokeAllBtn");
  var emptyState = document.getElementById("giEmpty");
  var groupsController = window.ForgeonGroupsController;
  var invitationsController = window.ForgeonGroupsInvitationsController;
  var membershipsController = window.ForgeonGroupMembershipsController;
  var usersController = window.ForgeonUsersController;

  if (
    !searchInput ||
    !searchResults ||
    !searchEmpty ||
    !inviteList ||
    !inviteCountBadge ||
    !revokeAllBtn ||
    !emptyState ||
    !groupsController ||
    !invitationsController ||
    !usersController
  )
    return;

  var currentUserId = "";
  var activeGroupId = "";
  var allUsers = [];
  var pendingInvitations = [];
  var memberUserIds = {};

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function resolveAssetUrl(url) {
    var value = String(url || "").trim();
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith("/")) return value;
    return "/" + value;
  }

  function getUserLevel(user) {
    var level = Number(user && user.level);
    return Number.isFinite(level) && level > 0 ? Math.floor(level) : 1;
  }

  function readCurrentUserId() {
    try {
      var raw = localStorage.getItem("forgeonCurrentUser");
      if (!raw) return "";
      var parsed = JSON.parse(raw);
      return String((parsed && (parsed.id || parsed._id)) || "");
    } catch (_error) {
      return "";
    }
  }

  function timeAgo(value) {
    var d = new Date(value);
    if (Number.isNaN(d.getTime())) return "Received recently";
    var seconds = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
    if (seconds < 60) return "Received just now";
    if (seconds < 3600) return "Received " + Math.floor(seconds / 60) + "m ago";
    if (seconds < 86400) return "Received " + Math.floor(seconds / 3600) + "h ago";
    return "Received " + Math.floor(seconds / 86400) + "d ago";
  }

  function resolveActiveGroupIdFromUrl() {
    var params = new URLSearchParams(window.location.search);
    return String(params.get("groupId") || "").trim();
  }

  function findUserByInvitation(invitation) {
    var inviteeId =
      invitation && invitation.invitee && (invitation.invitee._id || invitation.invitee.id || invitation.invitee)
        ? String(invitation.invitee._id || invitation.invitee.id || invitation.invitee)
        : "";
    var invitationEmail = String(invitation && invitation.inviteeEmail ? invitation.inviteeEmail : "").toLowerCase();

    return allUsers.find(function (user) {
      if (!user) return false;
      var userId = String((user._id || user.id) || "");
      var userEmail = String(user.email || "").toLowerCase();
      if (inviteeId && userId && inviteeId === userId) return true;
      if (invitationEmail && userEmail && invitationEmail === userEmail) return true;
      return false;
    });
  }

  function inviteeProfile(invitation) {
    var invitee = invitation && invitation.invitee;
    var fallbackUser = findUserByInvitation(invitation);
    var resolvedInvitee = invitee && typeof invitee === "object" ? invitee : fallbackUser;

    if (resolvedInvitee) {
      return {
        username: resolvedInvitee.username || resolvedInvitee.email || "Unknown user",
        email: resolvedInvitee.email || invitation.inviteeEmail || "",
        level: getUserLevel(resolvedInvitee),
        avatarUrl: resolveAssetUrl(resolvedInvitee.avatarUrl) || "/assets/images/default-avatar.svg",
      };
    }

    return {
      username: invitation.inviteeEmail || "Unknown user",
      email: invitation.inviteeEmail || "",
      level: 1,
      avatarUrl: "/assets/images/default-avatar.svg",
    };
  }

  function buildAvatarBlock(level, avatarUrl, username) {
    return (
      '<div class="gd-profile-card__avatar-zone">' +
      '<span class="gd-profile-card__level">Lvl ' +
      escapeHtml(level) +
      "</span>" +
      '<div class="avatar-shell avatar-shell--gd-profile avatar-shell--border flex-shrink-0" data-forgeon-avatar data-user-level="' +
      escapeHtml(level) +
      '">' +
      '<div class="avatar-frame" aria-hidden="true"></div>' +
      '<img class="gd-profile-card__avatar" src="' +
      escapeHtml(avatarUrl) +
      '" alt="' +
      escapeHtml(username || "Unknown user") +
      ' avatar" width="72" height="72" />' +
      "</div>" +
      "</div>"
    );
  }

  function renderPendingInvites() {
    if (!pendingInvitations.length) {
      inviteList.innerHTML = "";
      emptyState.hidden = false;
      inviteCountBadge.textContent = "0";
      revokeAllBtn.disabled = true;
      return;
    }

    inviteList.innerHTML = pendingInvitations
      .map(function (invitation) {
        var invitee = inviteeProfile(invitation);
        var name = escapeHtml(invitee.username);
        var email = escapeHtml(invitee.email);
        var level = Number(invitee.level) || 1;
        var invitationId = escapeHtml(invitation && invitation._id ? invitation._id : "");
        return (
          '<li class="gi-item" data-invite-item>' +
          buildAvatarBlock(level, invitee.avatarUrl, invitee.username) +
          '<div class="gi-user">' +
          '<div class="gi-user-line"><span class="gi-name">' +
          name +
          "</span></div>" +
          '<p class="gi-email">' +
          email +
          "</p>" +
          '<p class="gi-time">' +
          escapeHtml(timeAgo(invitation && invitation.createdAt)) +
          "</p>" +
          "</div>" +
          '<div class="gi-actions">' +
          '<span class="gi-status">Pending</span>' +
          '<button type="button" class="gi-btn gi-btn--revoke" data-revoke-id="' +
          invitationId +
          '"><span aria-hidden="true">&times;</span>Revoke</button>' +
          "</div>" +
          "</li>"
        );
      })
      .join("");

    emptyState.hidden = true;
    inviteCountBadge.textContent = String(pendingInvitations.length);
    revokeAllBtn.disabled = false;

    if (window.ForgeonAvatarFrames && typeof window.ForgeonAvatarFrames.refreshAll === "function") {
      window.ForgeonAvatarFrames.refreshAll();
    }
  }

  function isAlreadyPendingForUser(user) {
    if (!user) return true;
    var userId = String((user._id || user.id) || "");
    var userEmail = String(user.email || "").toLowerCase();
    return pendingInvitations.some(function (invitation) {
      var inviteeId =
        invitation && invitation.invitee && (invitation.invitee._id || invitation.invitee.id || invitation.invitee)
          ? String(invitation.invitee._id || invitation.invitee.id || invitation.invitee)
          : "";
      var invitationEmail = String(invitation && invitation.inviteeEmail ? invitation.inviteeEmail : "").toLowerCase();
      return (userId && inviteeId && userId === inviteeId) || (userEmail && invitationEmail && userEmail === invitationEmail);
    });
  }

  function renderSearchResults() {
    var query = String(searchInput.value || "").toLowerCase().trim();
    if (!query) {
      searchResults.innerHTML = "";
      searchEmpty.hidden = true;
      return;
    }

    var results = allUsers.filter(function (user) {
      if (!user || user.isDeleted) return false;
      var userId = String((user._id || user.id) || "");
      if (userId && currentUserId && userId === currentUserId) return false;
      if (userId && memberUserIds[userId]) return false;
      if (isAlreadyPendingForUser(user)) return false;

      var username = String(user.username || "").toLowerCase();
      var email = String(user.email || "").toLowerCase();
      return username.includes(query) || email.includes(query);
    });

    if (!results.length) {
      searchResults.innerHTML = "";
      searchEmpty.hidden = false;
      return;
    }

    searchResults.innerHTML = results
      .slice(0, 20)
      .map(function (user) {
        var userId = String((user._id || user.id) || "");
        var level = getUserLevel(user);
        var avatarUrl = resolveAssetUrl(user && user.avatarUrl) || "/assets/images/default-avatar.svg";
        return (
          '<li class="gi-item">' +
          buildAvatarBlock(level, avatarUrl, user.username || user.email || "Unknown user") +
          '<div class="gi-user">' +
          '<div class="gi-user-line"><span class="gi-name">' +
          escapeHtml(user.username || user.email || "Unknown user") +
          "</span></div>" +
          '<p class="gi-email">' +
          escapeHtml(user.email || "") +
          "</p>" +
          "</div>" +
          '<div class="gi-actions">' +
          '<button type="button" class="gi-btn gi-btn--all" data-send-invite data-user-id="' +
          escapeHtml(userId) +
          '" data-user-email="' +
          escapeHtml(user.email || "") +
          '">Send invitation</button>' +
          "</div>" +
          "</li>"
        );
      })
      .join("");

    searchEmpty.hidden = true;

    if (window.ForgeonAvatarFrames && typeof window.ForgeonAvatarFrames.refreshAll === "function") {
      window.ForgeonAvatarFrames.refreshAll();
    }
  }

  async function loadMemberships() {
    if (!membershipsController || !activeGroupId) return;
    try {
      var memberships = await membershipsController.list({ group: activeGroupId });
      memberUserIds = {};
      if (Array.isArray(memberships)) {
        memberships.forEach(function (membership) {
          var userId =
            membership && membership.user && (membership.user._id || membership.user.id || membership.user)
              ? String(membership.user._id || membership.user.id || membership.user)
              : "";
          if (userId) memberUserIds[userId] = true;
        });
      }
    } catch (_error) {
      memberUserIds = {};
    }
  }

  async function loadPendingInvites() {
    if (!activeGroupId) return;
    var sent = await invitationsController.list("sent");
    pendingInvitations = (Array.isArray(sent) ? sent : []).filter(function (invitation) {
      var invitationGroupId =
        invitation && invitation.group && (invitation.group._id || invitation.group.id || invitation.group)
          ? String(invitation.group._id || invitation.group.id || invitation.group)
          : "";
      return invitation.status === "pending" && invitationGroupId === activeGroupId;
    });
    renderPendingInvites();
  }

  async function loadUsers() {
    var users = await usersController.list();
    allUsers = Array.isArray(users) ? users : [];
  }

  async function refreshData() {
    await Promise.all([loadMemberships(), loadPendingInvites(), loadUsers()]);
    renderSearchResults();
  }

  async function sendInvitation(targetUserId, targetEmail, button) {
    if (!activeGroupId || !targetUserId) return;
    button.disabled = true;
    button.textContent = "Sending...";
    try {
      await invitationsController.create({
        group: activeGroupId,
        invitee: targetUserId,
        inviteeEmail: targetEmail || undefined,
      });
      await refreshData();
    } catch (error) {
      button.disabled = false;
      button.textContent = "Send invitation";
      window.alert(error && error.message ? error.message : "Could not send invitation.");
    }
  }

  async function revokeInvitation(invitationId, button) {
    if (!invitationId) return;
    button.disabled = true;
    try {
      await invitationsController.update(invitationId, { status: "revoked" });
      await refreshData();
    } catch (error) {
      button.disabled = false;
      window.alert(error && error.message ? error.message : "Could not revoke invitation.");
    }
  }

  async function revokeAllInvitations() {
    var ids = pendingInvitations
      .map(function (invitation) {
        return invitation && invitation._id ? invitation._id : "";
      })
      .filter(Boolean);
    for (var i = 0; i < ids.length; i += 1) {
      await invitationsController.update(ids[i], { status: "revoked" });
    }
    await refreshData();
  }

  inviteList.addEventListener("click", function (event) {
    var button = event.target.closest("[data-revoke-id]");
    if (!button) return;
    revokeInvitation(button.getAttribute("data-revoke-id"), button);
  });

  searchResults.addEventListener("click", function (event) {
    var button = event.target.closest("[data-send-invite]");
    if (!button) return;
    sendInvitation(button.getAttribute("data-user-id"), button.getAttribute("data-user-email"), button);
  });

  revokeAllBtn.addEventListener("click", function () {
    revokeAllInvitations().catch(function (error) {
      window.alert(error && error.message ? error.message : "Could not revoke all invitations.");
    });
  });

  searchInput.addEventListener("input", renderSearchResults);

  currentUserId = readCurrentUserId();
  activeGroupId = resolveActiveGroupIdFromUrl();

  if (!activeGroupId) {
    emptyState.hidden = false;
    emptyState.textContent = "Missing groupId in URL. Create a group first, then open invitations from that group.";
    inviteCountBadge.textContent = "0";
    revokeAllBtn.disabled = true;
    return;
  }

  refreshData().catch(function () {
    emptyState.hidden = false;
    emptyState.textContent = "Could not load group invitations.";
    inviteCountBadge.textContent = "0";
    revokeAllBtn.disabled = true;
  });
})();
