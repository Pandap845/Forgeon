(function () {
  var SEEN_STORAGE_KEY = "forgeonSeenNotifications";

  // Ensures values are handled as arrays.
  function normalizeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  // Resolves current user id for scoped local persistence.
  function resolveCurrentUserId() {
    try {
      var raw = localStorage.getItem("forgeonCurrentUser");
      if (!raw) return "";
      var parsed = JSON.parse(raw);
      return parsed && (parsed.id || parsed._id) ? String(parsed.id || parsed._id) : "";
    } catch (_error) {
      return "";
    }
  }

  // Returns a user-scoped storage key for seen notifications.
  function seenStorageKeyForUser() {
    var currentUserId = resolveCurrentUserId();
    return currentUserId ? SEEN_STORAGE_KEY + ":" + currentUserId : SEEN_STORAGE_KEY;
  }

  // Reads seen-notification map from local storage.
  function readSeenMap() {
    try {
      var raw = localStorage.getItem(seenStorageKeyForUser());
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_error) {
      return {};
    }
  }

  // Writes seen-notification map to local storage.
  function writeSeenMap(seenMap) {
    localStorage.setItem(seenStorageKeyForUser(), JSON.stringify(seenMap || {}));
  }

  // Produces a stable id for each notification item.
  function buildNotificationId(type, rawItem) {
    var rawId = rawItem && (rawItem._id || rawItem.id) ? String(rawItem._id || rawItem.id) : "";
    if (!rawId) return "";
    return String(type) + ":" + rawId;
  }

  // Keeps only pending invitations for notification feed.
  function pendingOnly(items) {
    return normalizeArray(items).filter(function (item) {
      return item && item.status === "pending";
    });
  }

  // Maps a friend invitation into a notification message.
  function mapFriendInvitation(invitation) {
    var sender = invitation && invitation.sender ? invitation.sender : {};
    var senderName = sender.username || sender.email || "Unknown user";
    var notificationId = buildNotificationId("friend_invitation", invitation);

    return {
      id: notificationId,
      type: "friend_invitation",
      createdAt: invitation && invitation.createdAt ? invitation.createdAt : null,
      message: "A friend request has arrived from " + senderName,
      sourceLabel: "Open friend requests",
      sourceHref: "/friend_requests.html",
      raw: invitation,
    };
  }

  // Maps a group invitation into a notification message.
  function mapGroupInvitation(invitation) {
    var group = invitation && invitation.group ? invitation.group : {};
    var groupName = group.name || "Unknown group";
    var notificationId = buildNotificationId("group_invitation", invitation);

    return {
      id: notificationId,
      type: "group_invitation",
      createdAt: invitation && invitation.createdAt ? invitation.createdAt : null,
      message: "Group invitation to " + groupName,
      sourceLabel: "Open My Groups",
      sourceHref: "/user_groups.html?tab=invitations",
      raw: invitation,
    };
  }

  // Loads received friend invitations through existing controller.
  async function getFriendInvitationNotifications() {
    if (!window.ForgeonFriendsInvitationsController) {
      throw new Error("Friends invitations controller is not available.");
    }
    var received = await window.ForgeonFriendsInvitationsController.list("received");
    return pendingOnly(received).map(mapFriendInvitation);
  }

  // Loads received group invitations through existing controller.
  async function getGroupInvitationNotifications() {
    if (!window.ForgeonGroupsInvitationsController) {
      throw new Error("Groups invitations controller is not available.");
    }
    var received = await window.ForgeonGroupsInvitationsController.list("received");
    return pendingOnly(received).map(mapGroupInvitation);
  }

  // Marks a list of notifications as seen.
  function markAsSeen(items) {
    var normalizedItems = normalizeArray(items);
    if (!normalizedItems.length) return;

    var seenMap = readSeenMap();
    var changed = false;
    normalizedItems.forEach(function (item) {
      var id = item && item.id ? String(item.id) : "";
      if (!id || seenMap[id]) return;
      seenMap[id] = Date.now();
      changed = true;
    });

    if (changed) {
      writeSeenMap(seenMap);
    }
  }

  // Returns a unified, time-sorted notifications feed.
  async function listReceivedNotifications(options) {
    var opts = options || {};
    var includeSeen = Boolean(opts.includeSeen);
    var status = String(opts.status || "").toLowerCase();
    var seenMap = readSeenMap();
    var loaded = await Promise.all([getFriendInvitationNotifications(), getGroupInvitationNotifications()]);

    var notifications = loaded[0]
      .concat(loaded[1])
      .map(function (item) {
        var seen = Boolean(item && item.id && seenMap[item.id]);
        return Object.assign({}, item, { seen: seen });
      })
      .sort(function (a, b) {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });

    if (status === "all" || includeSeen) return notifications;
    if (status === "read") {
      return notifications.filter(function (item) {
        return item.seen;
      });
    }
    return notifications.filter(function (item) {
      return !item.seen;
    });
  }

  window.ForgeonNotificationController = {
    getFriendInvitationNotifications: getFriendInvitationNotifications,
    getGroupInvitationNotifications: getGroupInvitationNotifications,
    markAsSeen: markAsSeen,
    listReceivedNotifications: listReceivedNotifications,
  };
})();