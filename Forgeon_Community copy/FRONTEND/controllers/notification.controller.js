(function () {
  // Ensures values are handled as arrays.
  function normalizeArray(value) {
    return Array.isArray(value) ? value : [];
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

    return {
      type: "friend_invitation",
      createdAt: invitation && invitation.createdAt ? invitation.createdAt : null,
      message: "A friend request has arrived from " + senderName,
      raw: invitation,
    };
  }

  // Maps a group invitation into a notification message.
  function mapGroupInvitation(invitation) {
    var group = invitation && invitation.group ? invitation.group : {};
    var groupName = group.name || "Unknown group";

    return {
      type: "group_invitation",
      createdAt: invitation && invitation.createdAt ? invitation.createdAt : null,
      message: "Group invitation to " + groupName,
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

  // Returns a unified, time-sorted notifications feed.
  async function listReceivedNotifications() {
    var loaded = await Promise.all([getFriendInvitationNotifications(), getGroupInvitationNotifications()]);
    return loaded[0]
      .concat(loaded[1])
      .sort(function (a, b) {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
  }

  window.ForgeonNotificationController = {
    getFriendInvitationNotifications: getFriendInvitationNotifications,
    getGroupInvitationNotifications: getGroupInvitationNotifications,
    listReceivedNotifications: listReceivedNotifications,
  };
})();
