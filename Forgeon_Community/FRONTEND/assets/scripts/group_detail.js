(function () {
  var groupsController = window.ForgeonGroupsController;
  var membershipsController = window.ForgeonGroupMembershipsController;
  var params = new URLSearchParams(window.location.search);
  var groupId = params.get("groupId");
  var currentUserId = "";
  var currentMembership = null;
  var currentGroup = null;
  var activeThreadId = "";
  var friendByUserId = {};
  var sentInvitationByUserId = {};
  var relationshipStateLoaded = false;

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

  function formatAge(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Just now";
    var seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
    if (seconds < 86400) return Math.floor(seconds / 3600) + "h ago";
    return Math.floor(seconds / 86400) + "d ago";
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

  function toId(value) {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (typeof value === "object") return String(value._id || value.id || "");
    return String(value);
  }

  async function ensureRelationshipState() {
    if (relationshipStateLoaded) return;
    if (!currentUserId) {
      currentUserId = readCurrentUserId();
    }
    if (!currentUserId) {
      relationshipStateLoaded = true;
      return;
    }

    var friendsController = window.ForgeonFriendsController;
    var friendsInvitationsController = window.ForgeonFriendsInvitationsController;
    if (!friendsController || !friendsInvitationsController) return;

    var loaded = await Promise.all([friendsController.list(), friendsInvitationsController.list("sent")]);
    var friends = Array.isArray(loaded[0]) ? loaded[0] : [];
    var invitations = Array.isArray(loaded[1]) ? loaded[1] : [];

    friendByUserId = {};
    sentInvitationByUserId = {};

    friends.forEach(function (friend) {
      var userA = toId(friend && friend.userA);
      var userB = toId(friend && friend.userB);
      if (!userA || !userB) return;
      var otherId = userA === currentUserId ? userB : userB === currentUserId ? userA : "";
      if (otherId) {
        friendByUserId[otherId] = true;
      }
    });

    invitations.forEach(function (invitation) {
      var recipientId = toId(invitation && invitation.recipient);
      var status = String(invitation && invitation.status ? invitation.status : "").toLowerCase();
      if (recipientId && status === "pending") {
        sentInvitationByUserId[recipientId] = true;
      }
    });

    relationshipStateLoaded = true;
  }

  function getInviteState(userId) {
    if (!userId) return "disabled";
    if (currentUserId && userId === currentUserId) return "self";
    if (friendByUserId[userId]) return "friends";
    if (sentInvitationByUserId[userId]) return "pending";
    return "available";
  }

  function isGroupOwner() {
    var creatorId =
      currentGroup && currentGroup.creator && (currentGroup.creator._id || currentGroup.creator.id)
        ? String(currentGroup.creator._id || currentGroup.creator.id)
        : "";
    return Boolean(currentUserId && creatorId && currentUserId === creatorId);
  }

  function isGroupArchived() {
    return Boolean(currentGroup && currentGroup.isArchived);
  }

  function canCreateThread() {
    return Boolean(!isGroupArchived() && (currentMembership || isGroupOwner()));
  }

  function validateCreateThreadForm() {
    var titleInput = document.getElementById("threadTitle");
    var descriptionInput = document.getElementById("threadDescription");
    var publishButton = document.getElementById("publishThreadBtn");
    if (!titleInput || !descriptionInput || !publishButton) return;
    var hasSelection = Boolean(document.querySelector("#publishTargets input[name='publishTo']:checked"));
    publishButton.disabled = !(String(titleInput.value || "").trim() && String(descriptionInput.value || "").trim() && hasSelection);
  }

  function populatePublishTargets() {
    var host = document.getElementById("publishTargets");
    if (!host) return;
    host.innerHTML = "";
    if (!groupId || !currentGroup || !canCreateThread()) {
      host.innerHTML = '<div class="text-muted-2">Group not available.</div>';
      return;
    }

    var groupName = currentGroup.name || "Current Group";
    host.innerHTML =
      '<label class="forgeon-radio-card">' +
      '<input type="radio" name="publishTo" value="group" data-group-id="' +
      escapeHtml(groupId) +
      '" checked />' +
      '<span class="forgeon-radio-dot" aria-hidden="true"></span>' +
      '<span class="d-flex flex-column"><span class="fw-medium">' +
      escapeHtml(groupName) +
      ' (Group)</span><small class="text-muted-2">Post to this group</small></span>' +
      "</label>";

    host.querySelectorAll("input[name='publishTo']").forEach(function (input) {
      input.addEventListener("change", validateCreateThreadForm);
    });
  }

  function getJoinButton() {
    return document.getElementById("groupJoinLink");
  }

  function setJoinButtonState() {
    var joinButton = getJoinButton();
    if (!joinButton) return;

    if (isGroupOwner()) {
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

    if (isGroupArchived()) {
      joinButton.textContent = "Archived";
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

  function setThreadFabVisibility() {
    var fab = document.getElementById("groupCreateThreadFab");
    if (!fab) return;
    fab.hidden = !canCreateThread();
  }

  function setGuestBannerState() {
    var banner = document.querySelector(".gd-guest-banner");
    if (!banner) return;
    banner.style.display = canCreateThread() || isGroupArchived() ? "none" : "";
  }

  function setArchivedBannerState() {
    var banner = document.getElementById("groupArchivedBanner");
    if (!banner) return;
    banner.hidden = !isGroupArchived();
  }

  function setThreadComposerState() {
    var input = document.getElementById("gtvCommentInput");
    var button = document.getElementById("gtvPostCommentBtn");
    if (!input || !button) return;

    var archived = isGroupArchived();
    input.disabled = archived;
    button.disabled = archived;
    input.placeholder = archived ? "This group is archived. Commenting is disabled." : "Add a comment...";
  }

  function buildMemberCard(membership) {
    var user = membership && membership.user ? membership.user : {};
    var memberUserId = user && (user._id || user.id) ? String(user._id || user.id) : "";
    var profileHref = memberUserId
      ? "../Profile/profile.html?id=" + encodeURIComponent(memberUserId)
      : "../Profile/profile.html";
    var username = user && user.username ? user.username : user && user.email ? user.email : "Unknown user";
    var level = Number(user && user.level) || 1;
    var roleLabel = membership && membership.role === "owner" ? "Group Owner" : "Member";
    var inviteState = getInviteState(memberUserId);
    var inviteLabel =
      inviteState === "self"
        ? "You"
        : inviteState === "friends"
        ? "Friends"
        : inviteState === "pending"
        ? "Invitation sent"
        : "Send Invitation";
    var inviteDisabled = inviteState !== "available";
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
      '<div class="avatar-shell avatar-shell--gd-profile avatar-shell--border" data-forgeon-avatar data-user-level="' +
        escapeHtml(level) +
        '">',
      '<div class="avatar-frame" aria-hidden="true"></div>',
      avatarMarkup,
      "</div>",
      "</div>",
      '<div class="gd-profile-card__body">',
      '<h3 class="gd-profile-card__name">' + escapeHtml(username) + "</h3>",
      '<p class="gd-profile-card__handle">@' + escapeHtml(username) + "</p>",
      '<p class="gd-profile-card__meta">' + roleLabel + "</p>",
      "</div>",
      '<div class="d-flex align-items-center gap-2">',
      '<a class="gd-profile-card__link" href="' + escapeHtml(profileHref) + '">View profile</a>',
      '<button type="button" class="dg-btn dg-btn--secondary" data-action="send-friend-invitation" data-user-id="' +
        escapeHtml(memberUserId) +
        '"' +
        (inviteDisabled ? " disabled" : "") +
        ">" +
        escapeHtml(inviteLabel) +
        "</button>",
      "</div>",
      "</article>",
      "</li>",
    ].join("");
  }

  function buildThreadCard(thread) {
    var threadId = thread && (thread._id || thread.id) ? String(thread._id || thread.id) : "";
    var title = thread && thread.title ? thread.title : "Untitled thread";
    var author =
      thread && thread.author && (thread.author.username || thread.author.email)
        ? thread.author.username || thread.author.email
        : "Unknown";
    var avatar = resolveAssetUrl(thread && thread.author && thread.author.avatarUrl) || "/assets/images/default-avatar.svg";
    var imageUrl = resolveAssetUrl(thread && thread.imageUrl);
    var likesCount = typeof (thread && thread.likesCount) === "number" ? thread.likesCount : 0;
    var commentsCount = typeof (thread && thread.commentsCount) === "number" ? thread.commentsCount : 0;
    var createdAtText = formatAge(thread && thread.createdAt);

    return [
      "<li>",
      '<article class="gd-thread dg-surface-card">',
      '<div class="avatar-shell avatar-shell--gd-thread avatar-shell--border flex-shrink-0" data-forgeon-avatar data-user-level="1">',
      '<div class="avatar-frame" aria-hidden="true"></div>',
      '<img class="gd-thread__avatar" src="' +
        escapeHtml(avatar) +
        '" alt="' +
        escapeHtml(author) +
        ' avatar" width="45" height="45" />',
      "</div>",
      '<div class="gd-thread__body">',
      '<div class="gd-thread__head">',
      '<h2 class="gd-thread__title"><a class="gd-thread__title-link" href="#" data-action="open-thread" data-thread-id="' +
        escapeHtml(threadId) +
        '">' +
        escapeHtml(title) +
        "</a></h2>",
      "</div>",
      '<div class="gd-thread__meta">',
      '<span class="gd-thread__author">' + escapeHtml(author) + "</span>",
      '<span class="gd-meta-sep" aria-hidden="true">•</span>',
      '<span class="gd-thread__time">' + escapeHtml(createdAtText) + "</span>",
      "</div>",
      imageUrl
        ? '<div class="gd-thread__media"><img class="gd-thread__preview" src="' +
          escapeHtml(imageUrl) +
          '" alt="' +
          escapeHtml(title) +
          ' image" /></div>'
        : "",
      '<div class="gd-thread__divider" aria-hidden="true"></div>',
      '<div class="gd-thread__stats">',
      '<span class="gd-stat"><i class="fa-regular fa-heart"></i> ' + likesCount + "</span>",
      '<span class="gd-stat"><i class="fa-regular fa-comment"></i> ' + commentsCount + " comments</span>",
      "</div>",
      "</div>",
      "</article>",
      "</li>",
    ].join("");
  }

  async function loadMembers() {
    var membersList = document.getElementById("groupMembersList");
    if (!membersList || !groupId || !membershipsController) return;

    try {
      await ensureRelationshipState();
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

  async function handleSendFriendInvitation(targetUserId, triggerButton) {
    var friendsInvitationsController = window.ForgeonFriendsInvitationsController;
    if (!targetUserId || !friendsInvitationsController) return;
    if (friendByUserId[targetUserId] || sentInvitationByUserId[targetUserId] || targetUserId === currentUserId) return;

    try {
      triggerButton.disabled = true;
      triggerButton.textContent = "Sending...";
      await friendsInvitationsController.create({ recipient: targetUserId });
      sentInvitationByUserId[targetUserId] = true;
      triggerButton.textContent = "Invitation sent";
      triggerButton.disabled = true;
    } catch (error) {
      var message = String(error && error.message ? error.message : "").toLowerCase();
      if (message.includes("already friends")) {
        friendByUserId[targetUserId] = true;
        triggerButton.textContent = "Friends";
        triggerButton.disabled = true;
        return;
      }
      if (message.includes("pending invitation") || message.includes("already exists")) {
        sentInvitationByUserId[targetUserId] = true;
        triggerButton.textContent = "Invitation sent";
        triggerButton.disabled = true;
        return;
      }
      triggerButton.textContent = "Send Invitation";
      triggerButton.disabled = false;
    }
  }

  async function loadGroupThreads() {
    var list = document.getElementById("groupThreadsList");
    if (!list || !groupId) return;

    list.innerHTML = '<li><article class="gd-thread dg-surface-card"><div class="gd-thread__body">Loading threads...</div></article></li>';
    try {
      var query = new URLSearchParams({ group: groupId, limit: "50" });
      var response = await fetch("/api/threads?" + query.toString(), { credentials: "include" });
      var payload = await response.json().catch(function () {
        return [];
      });

      if (!response.ok) {
        throw new Error((payload && payload.message) || "Could not load threads.");
      }

      var rows = Array.isArray(payload) ? payload : [];
      if (!rows.length) {
        list.innerHTML =
          '<li><article class="gd-thread dg-surface-card"><div class="gd-thread__body">No group threads yet.</div></article></li>';
        return;
      }

      list.innerHTML = rows.map(buildThreadCard).join("");

      if (window.ForgeonAvatarFrames && typeof window.ForgeonAvatarFrames.refreshAll === "function") {
        window.ForgeonAvatarFrames.refreshAll();
      }
    } catch (error) {
      list.innerHTML =
        '<li><article class="gd-thread dg-surface-card"><div class="gd-thread__body">' +
        escapeHtml(error && error.message ? error.message : "Could not load threads.") +
        "</div></article></li>";
    }
  }

  function buildThreadCommentItem(comment) {
    var author = comment && comment.author && (comment.author.username || comment.author.email)
      ? comment.author.username || comment.author.email
      : "Unknown";
    var avatar = resolveAssetUrl(comment && comment.author && comment.author.avatarUrl) || "/assets/images/default-avatar.svg";
    var content = comment && comment.content ? comment.content : "";
    var dateText = formatAge(comment && comment.createdAt);

    return (
      '<article class="gtv-comment-item">' +
      '<img class="gtv-comment-avatar" src="' + escapeHtml(avatar) + '" alt="' + escapeHtml(author) + ' avatar" width="32" height="32" />' +
      '<div class="gtv-comment-body">' +
      '<div class="d-flex align-items-center gap-2 mb-1"><span class="fw-medium">' + escapeHtml(author) + '</span><span class="text-muted-2 small">' + escapeHtml(dateText) + "</span></div>" +
      '<p class="mb-0 text-muted-2">' + escapeHtml(content) + "</p>" +
      "</div>" +
      "</article>"
    );
  }

  async function loadThreadComments(threadId) {
    var commentsList = document.getElementById("gtvCommentsList");
    var commentsCount = document.getElementById("gtvCommentsCount");
    if (!commentsList || !threadId) return;

    commentsList.innerHTML = '<div class="text-muted-2 small">Loading comments...</div>';
    try {
      var response = await fetch("/api/comments?thread=" + encodeURIComponent(threadId), { credentials: "include" });
      var payload = await response.json().catch(function () {
        return [];
      });
      if (!response.ok) {
        throw new Error((payload && payload.message) || "Could not load comments.");
      }
      var rows = Array.isArray(payload) ? payload : [];
      commentsList.innerHTML = rows.length
        ? rows.map(buildThreadCommentItem).join("")
        : '<div class="text-muted-2 small">No comments yet.</div>';
      if (commentsCount) commentsCount.textContent = String(rows.length);
    } catch (error) {
      commentsList.innerHTML = '<div class="text-muted-2 small">' + escapeHtml(error && error.message ? error.message : "Could not load comments.") + "</div>";
      if (commentsCount) commentsCount.textContent = "0";
    }
  }

  async function openThreadModal(threadId) {
    if (!threadId) return;
    activeThreadId = threadId;

    var titleEl = document.getElementById("gtvTitle");
    var bodyEl = document.getElementById("gtvBody");
    var authorEl = document.getElementById("gtvAuthorName");
    var dateEl = document.getElementById("gtvPostDate");
    var likesEl = document.getElementById("gtvLikesCount");
    var mediaWrap = document.getElementById("gtvMediaWrap");
    var mediaEl = document.getElementById("gtvMedia");
    var avatarEl = document.getElementById("gtvAuthorAvatar");
    var commentsList = document.getElementById("gtvCommentsList");

    if (titleEl) titleEl.textContent = "Loading...";
    if (bodyEl) bodyEl.textContent = "";
    if (authorEl) authorEl.textContent = "";
    if (dateEl) dateEl.textContent = "";
    if (likesEl) likesEl.textContent = "0";
    if (commentsList) commentsList.innerHTML = '<div class="text-muted-2 small">Loading comments...</div>';
    if (mediaWrap) mediaWrap.hidden = true;
    if (mediaEl) mediaEl.src = "";

    try {
      var response = await fetch("/api/threads/" + encodeURIComponent(threadId), { credentials: "include" });
      var payload = await response.json().catch(function () {
        return {};
      });
      if (!response.ok) {
        throw new Error(payload.message || "Could not load thread.");
      }

      var thread = payload || {};
      if (titleEl) titleEl.textContent = thread.title || "Untitled thread";
      if (bodyEl) bodyEl.textContent = thread.description || "";
      if (authorEl) {
        authorEl.textContent =
          thread.author && (thread.author.username || thread.author.email)
            ? thread.author.username || thread.author.email
            : "Unknown";
      }
      if (dateEl) dateEl.textContent = formatAge(thread.createdAt);
      if (likesEl) likesEl.textContent = String(typeof thread.likesCount === "number" ? thread.likesCount : 0);
      if (avatarEl) {
        avatarEl.src = resolveAssetUrl(thread && thread.author && thread.author.avatarUrl) || "/assets/images/default-avatar.svg";
      }

      var threadImage = resolveAssetUrl(thread && thread.imageUrl);
      if (threadImage && mediaWrap && mediaEl) {
        mediaEl.src = threadImage;
        mediaEl.alt = (thread.title || "Thread") + " image";
        mediaWrap.hidden = false;
      }

      setThreadComposerState();
      await loadThreadComments(threadId);

      var modalEl = document.getElementById("groupThreadViewModal");
      if (modalEl && window.bootstrap && window.bootstrap.Modal) {
        var modal = window.bootstrap.Modal.getInstance(modalEl) || new window.bootstrap.Modal(modalEl);
        modal.show();
      }
    } catch (error) {
      if (titleEl) titleEl.textContent = "Could not load thread";
      if (bodyEl) bodyEl.textContent = error && error.message ? error.message : "Unexpected error.";
    }
  }

  async function postThreadComment() {
    if (!activeThreadId) return;
    if (isGroupArchived()) return;
    var input = document.getElementById("gtvCommentInput");
    var button = document.getElementById("gtvPostCommentBtn");
    if (!input || !button) return;

    var content = String(input.value || "").trim();
    if (!content) return;

    button.disabled = true;
    try {
      var response = await fetch("/api/comments", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread: activeThreadId, content: content }),
      });
      var payload = await response.json().catch(function () {
        return {};
      });
      if (!response.ok) {
        throw new Error(payload.message || "Could not post comment.");
      }
      input.value = "";
      await Promise.all([loadThreadComments(activeThreadId), loadGroupThreads()]);
    } catch (error) {
      window.alert(error && error.message ? error.message : "Could not post comment.");
    } finally {
      button.disabled = false;
    }
  }

  async function publishThread() {
    if (!groupId || !canCreateThread()) return;
    var titleInput = document.getElementById("threadTitle");
    var descriptionInput = document.getElementById("threadDescription");
    var imageInput = document.getElementById("threadImage");
    var submitButton = document.getElementById("publishThreadBtn");
    if (!titleInput || !descriptionInput || !submitButton) return;

    var title = String(titleInput.value || "").trim();
    var description = String(descriptionInput.value || "").trim();
    if (!title || !description) {
      window.alert("Title and description are required.");
      return;
    }

    submitButton.disabled = true;
    var originalText = submitButton.textContent;
    submitButton.textContent = "Publishing...";

    try {
      var formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("publishTo", "group");
      formData.append("group", groupId);
      if (imageInput && imageInput.files && imageInput.files[0]) {
        formData.append("threadImage", imageInput.files[0]);
      }

      var response = await fetch("/api/threads", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      var payload = await response.json().catch(function () {
        return {};
      });
      if (!response.ok) {
        throw new Error(payload.message || "Could not create thread.");
      }

      var modalEl = document.getElementById("createThreadModal");
      if (modalEl && window.bootstrap && window.bootstrap.Modal) {
        var modal = window.bootstrap.Modal.getInstance(modalEl) || new window.bootstrap.Modal(modalEl);
        modal.hide();
      }
      var form = document.getElementById("createThreadForm");
      if (form) form.reset();
      validateCreateThreadForm();
      await loadGroupThreads();
    } catch (error) {
      window.alert(error && error.message ? error.message : "Could not create thread.");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = originalText;
    }
  }

  async function loadGroup() {
    if (!groupsController || !groupId) return;

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
    if (isGroupOwner()) return;

    event.preventDefault();
    if (!groupId || !membershipsController || currentMembership || isGroupArchived()) return;

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
      setThreadFabVisibility();
      setGuestBannerState();
      await Promise.all([loadMembers(), loadGroupThreads()]);
    } catch (error) {
      button.textContent = originalText;
      button.removeAttribute("aria-disabled");
      if (error && error.message) {
        window.alert(error.message);
      }
    }
  }

  async function bootstrap() {
    if (!groupId) return;
    await Promise.all([loadGroup(), loadMembershipState()]);
    populatePublishTargets();
    setJoinButtonState();
    setThreadFabVisibility();
    setGuestBannerState();
    setArchivedBannerState();
    setThreadComposerState();
    await Promise.all([loadMembers(), loadGroupThreads()]);
  }

  bootstrap();

  var tabThreads = document.getElementById("tab-threads");
  var tabMembers = document.getElementById("tab-members");
  var panelThreads = document.getElementById("panel-threads");
  var panelMembers = document.getElementById("panel-members");
  var joinButton = document.getElementById("groupJoinLink");
  var createThreadButton = document.getElementById("publishThreadBtn");
  var threadTitleInput = document.getElementById("threadTitle");
  var threadDescriptionInput = document.getElementById("threadDescription");
  var createThreadModal = document.getElementById("createThreadModal");
  var threadsList = document.getElementById("groupThreadsList");
  var membersList = document.getElementById("groupMembersList");
  var postThreadCommentButton = document.getElementById("gtvPostCommentBtn");
  var threadCommentInput = document.getElementById("gtvCommentInput");

  if (joinButton) {
    joinButton.addEventListener("click", handleJoinClick);
  }
  if (createThreadButton) {
    createThreadButton.addEventListener("click", publishThread);
  }
  if (threadTitleInput) {
    threadTitleInput.addEventListener("input", validateCreateThreadForm);
  }
  if (threadDescriptionInput) {
    threadDescriptionInput.addEventListener("input", validateCreateThreadForm);
  }
  if (createThreadModal) {
    createThreadModal.addEventListener("show.bs.modal", function () {
      populatePublishTargets();
      validateCreateThreadForm();
    });
  }
  if (threadsList) {
    threadsList.addEventListener("click", function (event) {
      var link = event.target.closest("[data-action='open-thread'][data-thread-id]");
      if (!link) return;
      event.preventDefault();
      openThreadModal(link.getAttribute("data-thread-id"));
    });
  }
  if (membersList) {
    membersList.addEventListener("click", function (event) {
      var inviteButton = event.target.closest("[data-action='send-friend-invitation']");
      if (!inviteButton) return;
      event.preventDefault();
      handleSendFriendInvitation(inviteButton.getAttribute("data-user-id"), inviteButton);
    });
  }
  if (postThreadCommentButton) {
    postThreadCommentButton.addEventListener("click", postThreadComment);
  }
  if (threadCommentInput) {
    threadCommentInput.addEventListener("keydown", function (event) {
      if (event.key !== "Enter") return;
      event.preventDefault();
      postThreadComment();
    });
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
