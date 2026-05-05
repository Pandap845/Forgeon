(function () {
  var tabIncoming = document.getElementById("tab-incoming");
  var tabSent = document.getElementById("tab-sent");
  var tabFriends = document.getElementById("tab-friends");
  var panelIncoming = document.getElementById("panel-incoming");
  var panelSent = document.getElementById("panel-sent");
  var panelFriends = document.getElementById("panel-friends");
  var incomingListElement = document.getElementById("frIncomingList");
  var sentListElement = document.getElementById("frSentList");
  var friendsListElement = document.getElementById("frFriendsList");
  var incomingTabCountElement = document.getElementById("frIncomingTabCount");
  var sentTabCountElement = document.getElementById("frSentTabCount");
  var friendsTabCountElement = document.getElementById("frFriendsTabCount");
  var incomingSummaryCountElement = document.getElementById("frIncomingSummaryCount");
  var sentSummaryCountElement = document.getElementById("frSentSummaryCount");
  var invitationsController = window.ForgeonFriendsInvitationsController;
  var friendsController = window.ForgeonFriendsController;
  var currentUserId = "";

  if (
    !tabIncoming ||
    !tabSent ||
    !tabFriends ||
    !panelIncoming ||
    !panelSent ||
    !panelFriends ||
    !incomingListElement ||
    !sentListElement ||
    !friendsListElement ||
    !incomingTabCountElement ||
    !sentTabCountElement ||
    !friendsTabCountElement ||
    !incomingSummaryCountElement ||
    !sentSummaryCountElement ||
    !invitationsController ||
    !friendsController
  ) {
    return;
  }

  try {
    var rawCurrentUser = localStorage.getItem("forgeonCurrentUser");
    if (rawCurrentUser) {
      var parsedCurrentUser = JSON.parse(rawCurrentUser);
      currentUserId = String(parsedCurrentUser && (parsedCurrentUser.id || parsedCurrentUser._id) ? (parsedCurrentUser.id || parsedCurrentUser._id) : "");
    }
  } catch (_error) {}

  function showIncoming() {
    tabIncoming.classList.add("fr-tab--active");
    tabSent.classList.remove("fr-tab--active");
    tabFriends.classList.remove("fr-tab--active");
    tabIncoming.setAttribute("aria-selected", "true");
    tabSent.setAttribute("aria-selected", "false");
    tabFriends.setAttribute("aria-selected", "false");
    panelIncoming.classList.remove("fr-panel--hidden");
    panelIncoming.hidden = false;
    panelSent.classList.add("fr-panel--hidden");
    panelSent.hidden = true;
    panelFriends.classList.add("fr-panel--hidden");
    panelFriends.hidden = true;
  }

  function showSent() {
    tabSent.classList.add("fr-tab--active");
    tabIncoming.classList.remove("fr-tab--active");
    tabFriends.classList.remove("fr-tab--active");
    tabSent.setAttribute("aria-selected", "true");
    tabIncoming.setAttribute("aria-selected", "false");
    tabFriends.setAttribute("aria-selected", "false");
    panelSent.classList.remove("fr-panel--hidden");
    panelSent.hidden = false;
    panelIncoming.classList.add("fr-panel--hidden");
    panelIncoming.hidden = true;
    panelFriends.classList.add("fr-panel--hidden");
    panelFriends.hidden = true;
  }

  function showFriends() {
    tabFriends.classList.add("fr-tab--active");
    tabIncoming.classList.remove("fr-tab--active");
    tabSent.classList.remove("fr-tab--active");
    tabFriends.setAttribute("aria-selected", "true");
    tabIncoming.setAttribute("aria-selected", "false");
    tabSent.setAttribute("aria-selected", "false");
    panelFriends.classList.remove("fr-panel--hidden");
    panelFriends.hidden = false;
    panelIncoming.classList.add("fr-panel--hidden");
    panelIncoming.hidden = true;
    panelSent.classList.add("fr-panel--hidden");
    panelSent.hidden = true;
  }

  function getName(user) {
    if (!user || typeof user !== "object") return "Unknown user";
    return user.username || user.email || "Unknown user";
  }

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

  function buildAvatarBlock(user, userName) {
    var level = getUserLevel(user);
    var avatarUrl = resolveAssetUrl(user && user.avatarUrl) || "/assets/images/default-avatar.svg";
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
      escapeHtml(userName) +
      ' avatar" width="72" height="72" />' +
      "</div>" +
      "</div>"
    );
  }

  function formatRelativeTime(inputDate) {
    if (!inputDate) return "Unknown time";

    var date = new Date(inputDate);
    if (Number.isNaN(date.getTime())) return "Unknown time";

    var seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (seconds < 60) return "just now";
    if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
    if (seconds < 86400) return Math.floor(seconds / 3600) + "h ago";
    if (seconds < 604800) return Math.floor(seconds / 86400) + "d ago";
    if (seconds < 2592000) return Math.floor(seconds / 604800) + "w ago";
    return Math.floor(seconds / 2592000) + "mo ago";
  }

  function pendingOnly(items) {
    if (!Array.isArray(items)) return [];
    return items.filter(function (item) {
      return item && item.status === "pending";
    });
  }

  function buildIncomingItem(item) {
    var sender = item.sender || {};
    var senderNameRaw = getName(sender);
    var senderName = escapeHtml(senderNameRaw);
    var mutualFriends = Number(item.mutualFriends || 0);

    return (
      '<li><article class="fr-request dg-surface-card">' +
      buildAvatarBlock(sender, senderNameRaw) +
      '<div class="fr-request__body">' +
      '<div class="fr-request__top"><span class="fr-request__name">' +
      senderName +
      "</span></div>" +
      '<div class="fr-request__meta">' +
      '<span class="fr-meta">' +
      mutualFriends +
      " mutual friend" +
      (mutualFriends === 1 ? "" : "s") +
      "</span>" +
      '<span class="gd-meta-sep" aria-hidden="true">•</span>' +
      '<span class="fr-meta">' +
      "Received " +
      escapeHtml(formatRelativeTime(item.createdAt)) +
      "</span>" +
      "</div>" +
      "</div>" +
      '<div class="fr-request__actions">' +
      '<button type="button" class="fr-btn fr-btn--accept" data-action="accept" data-invitation-id="' +
      escapeHtml(item._id) +
      '">Accept</button>' +
      '<button type="button" class="fr-btn fr-btn--reject" data-action="reject" data-invitation-id="' +
      escapeHtml(item._id) +
      '">Reject</button>' +
      "</div>" +
      "</article></li>"
    );
  }

  function buildSentItem(item) {
    var recipient = item.recipient || {};
    var recipientNameRaw = getName(recipient);
    var recipientName = escapeHtml(recipientNameRaw);

    return (
      '<li><article class="fr-request fr-request--sent dg-surface-card">' +
      buildAvatarBlock(recipient, recipientNameRaw) +
      '<div class="fr-request__body">' +
      '<div class="fr-request__top"><span class="fr-request__name">' +
      recipientName +
      "</span></div>" +
      '<div class="fr-request__meta">' +
      '<span class="fr-meta fr-meta--solo">Sent ' +
      escapeHtml(formatRelativeTime(item.createdAt)) +
      "</span>" +
      "</div>" +
      "</div>" +
      '<div class="fr-request__actions">' +
      '<button type="button" class="fr-btn fr-btn--reject fr-btn--cancel" data-action="cancel" data-invitation-id="' +
      escapeHtml(item._id) +
      '">Cancel request</button>' +
      "</div>" +
      "</article></li>"
    );
  }

  function setCounts(incomingCount, sentCount) {
    incomingTabCountElement.textContent = String(incomingCount);
    sentTabCountElement.textContent = String(sentCount);
    incomingSummaryCountElement.textContent = String(incomingCount);
    sentSummaryCountElement.textContent = String(sentCount);
  }

  function renderFriends(friendsItems) {
    if (!friendsItems.length) {
      friendsListElement.innerHTML =
        '<li><article class="fr-request dg-surface-card"><div class="fr-request__body"><div class="fr-request__top"><span class="fr-request__name">No friends yet.</span></div></div></article></li>';
      return;
    }

    friendsListElement.innerHTML = friendsItems
      .map(function (friendship) {
        var userA = friendship && friendship.userA ? friendship.userA : {};
        var userB = friendship && friendship.userB ? friendship.userB : {};
        var friendshipId = friendship && (friendship._id || friendship.id) ? String(friendship._id || friendship.id) : "";

        var resolvedFriend = userA;
        if (currentUserId) {
          var userAId = userA && (userA._id || userA.id) ? String(userA._id || userA.id) : "";
          var userBId = userB && (userB._id || userB.id) ? String(userB._id || userB.id) : "";
          if (userAId === currentUserId) resolvedFriend = userB;
          else if (userBId === currentUserId) resolvedFriend = userA;
        }

        var friendNameRaw = getName(resolvedFriend);
        var friendName = escapeHtml(friendNameRaw);
        var connectedAt = formatRelativeTime(friendship && (friendship.connectedAt || friendship.createdAt));
        var removeButtonHtml = friendshipId
          ? '<div class="fr-request__actions"><button type="button" class="fr-btn fr-btn--reject fr-btn--cancel" data-action="remove-friend" data-friendship-id="' +
            escapeHtml(friendshipId) +
            '">Remove friend</button></div>'
          : "";
        return (
          '<li><article class="fr-request fr-request--sent dg-surface-card">' +
          buildAvatarBlock(resolvedFriend, friendNameRaw) +
          '<div class="fr-request__body">' +
          '<div class="fr-request__top"><span class="fr-request__name">' +
          friendName +
          "</span></div>" +
          '<div class="fr-request__meta"><span class="fr-meta fr-meta--solo">Friends since ' +
          escapeHtml(connectedAt) +
          "</span></div>" +
          "</div>" +
          removeButtonHtml +
          "</article></li>"
        );
      })
      .join("");
  }

  function renderLists(incomingItems, sentItems) {
    if (incomingItems.length === 0) {
      incomingListElement.innerHTML =
        '<li><article class="fr-request dg-surface-card"><div class="fr-request__body"><div class="fr-request__top"><span class="fr-request__name">No incoming requests.</span></div></div></article></li>';
    } else {
      incomingListElement.innerHTML = incomingItems.map(buildIncomingItem).join("");
    }

    if (sentItems.length === 0) {
      sentListElement.innerHTML =
        '<li><article class="fr-request fr-request--sent dg-surface-card"><div class="fr-request__body"><div class="fr-request__top"><span class="fr-request__name">No sent requests.</span></div></div></article></li>';
    } else {
      sentListElement.innerHTML = sentItems.map(buildSentItem).join("");
    }

    if (window.ForgeonAvatarFrames && typeof window.ForgeonAvatarFrames.refreshAll === "function") {
      window.ForgeonAvatarFrames.refreshAll();
    }
  }

  async function loadInvitations() {
    try {
      var [incomingRaw, sentRaw, friendsRaw] = await Promise.all([
        invitationsController.list("received"),
        invitationsController.list("sent"),
        friendsController.list(),
      ]);

      var incomingItems = pendingOnly(incomingRaw);
      var sentItems = pendingOnly(sentRaw);
      var friendsItems = Array.isArray(friendsRaw) ? friendsRaw : [];

      setCounts(incomingItems.length, sentItems.length);
      friendsTabCountElement.textContent = String(friendsItems.length);
      renderLists(incomingItems, sentItems);
      renderFriends(friendsItems);
    } catch (error) {
      incomingListElement.innerHTML =
        '<li><article class="fr-request dg-surface-card"><div class="fr-request__body"><div class="fr-request__top"><span class="fr-request__name">Could not load incoming requests.</span></div></div></article></li>';
      sentListElement.innerHTML =
        '<li><article class="fr-request fr-request--sent dg-surface-card"><div class="fr-request__body"><div class="fr-request__top"><span class="fr-request__name">Could not load sent requests.</span></div></div></article></li>';
      friendsListElement.innerHTML =
        '<li><article class="fr-request fr-request--sent dg-surface-card"><div class="fr-request__body"><div class="fr-request__top"><span class="fr-request__name">Could not load friends.</span></div></div></article></li>';
      setCounts(0, 0);
      friendsTabCountElement.textContent = "0";
    }
  }

  async function handleListAction(event) {
    var button = event.target.closest("[data-action][data-invitation-id]");
    if (!button) return;

    var invitationId = button.getAttribute("data-invitation-id");
    var action = button.getAttribute("data-action");
    if (!invitationId || !action) return;

    var statusByAction = {
      accept: "accepted",
      reject: "rejected",
      cancel: "cancelled",
    };
    var nextStatus = statusByAction[action];
    if (!nextStatus) return;

    button.disabled = true;

    try {
      await invitationsController.update(invitationId, { status: nextStatus });
      await loadInvitations();
    } catch (error) {
      button.disabled = false;
      var message = error && error.message ? error.message : "Action failed.";
      window.alert(message);
    }
  }

  async function handleFriendAction(event) {
    var button = event.target.closest("[data-action='remove-friend'][data-friendship-id]");
    if (!button) return;

    var friendshipId = button.getAttribute("data-friendship-id");
    if (!friendshipId) return;

    button.disabled = true;

    try {
      await friendsController.remove(friendshipId);
      await loadInvitations();
    } catch (error) {
      button.disabled = false;
      var message = error && error.message ? error.message : "Could not remove friend.";
      window.alert(message);
    }
  }

  tabIncoming.addEventListener("click", showIncoming);
  tabSent.addEventListener("click", showSent);
  tabFriends.addEventListener("click", showFriends);
  incomingListElement.addEventListener("click", handleListAction);
  sentListElement.addEventListener("click", handleListAction);
  friendsListElement.addEventListener("click", handleFriendAction);

  loadInvitations();
})();
