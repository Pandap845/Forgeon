(function () {
  var TOKEN_KEY = "forgeonAuthToken";
  var USER_KEY = "forgeonCurrentUser";
  var API_URL = "/api/search";
  var DEBOUNCE_MS = 300;
  var LIMIT = 15;
  var currentScope = "groups";
  var activeRequest = 0;
  var debounceTimer = null;
  var currentUserId = "";
  var activeThreadId = "";
  var friendByUserId = {};
  var sentInvitationByUserId = {};
  var relationshipStateLoaded = false;

  var scopeByTabId = {
    "sr-tab-groups": "groups",
    "sr-tab-threads": "threads",
    "sr-tab-users": "users",
  };

  var tabs = document.querySelectorAll(".sr-tab");
  var input = document.getElementById("globalSearch");
  var panel = document.getElementById("sr-panel-results");
  if (!tabs.length || !input || !panel) return;

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalize(s) {
    return (s || "").toLowerCase().trim();
  }

  function resolveAssetUrl(url) {
    var value = String(url || "").trim();
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith("/")) return value;
    return "/" + value;
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

  function toId(value) {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (typeof value === "object") return String(value._id || value.id || "");
    return String(value);
  }

  function loadCurrentUserId() {
    var raw = localStorage.getItem(USER_KEY);
    if (!raw) return "";
    try {
      var parsed = JSON.parse(raw);
      return parsed && parsed.id ? String(parsed.id) : "";
    } catch (_error) {
      return "";
    }
  }

  async function ensureRelationshipState() {
    if (relationshipStateLoaded) return;
    currentUserId = loadCurrentUserId();
    if (!currentUserId) {
      relationshipStateLoaded = true;
      return;
    }
    if (!window.ForgeonFriendsController || !window.ForgeonFriendsInvitationsController) {
      relationshipStateLoaded = true;
      return;
    }

    var loaded = await Promise.all([
      window.ForgeonFriendsController.list(),
      window.ForgeonFriendsInvitationsController.list("sent"),
    ]);

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

  function setActive(activeBtn) {
    tabs.forEach(function (tab) {
      var on = tab === activeBtn;
      tab.classList.toggle("sr-tab--active", on);
      tab.setAttribute("aria-selected", on ? "true" : "false");
    });
    currentScope = scopeByTabId[activeBtn.id] || "all";
    panel.setAttribute("aria-labelledby", activeBtn.id);
  }

  function updateUrlState(term) {
    var params = new URLSearchParams(window.location.search);
    var cleaned = String(term || "").trim();
    if (cleaned) params.set("q", cleaned);
    else params.delete("q");
    if (currentScope) params.set("scope", currentScope);
    var next = window.location.pathname + (params.toString() ? "?" + params.toString() : "");
    window.history.replaceState({}, "", next);
  }

  function renderEmpty() {
    panel.className = "sr-empty dg-surface-card";
    panel.innerHTML = [
      '<i class="sr-empty__icon fa-solid fa-magnifying-glass" aria-hidden="true"></i>',
      "<h2 class=\"sr-empty__title\">Start Searching</h2>",
      "<p class=\"sr-empty__hint\">Type in the search bar above to find groups, threads, or users.</p>",
      '<a class="sr-empty__link" href="./discover_groups.html">Browse Discover Groups</a>',
    ].join("");
  }

  function renderLoading() {
    panel.className = "sr-empty dg-surface-card";
    panel.innerHTML = [
      '<i class="sr-empty__icon fa-solid fa-magnifying-glass" aria-hidden="true"></i>',
      "<h2 class=\"sr-empty__title\">Searching...</h2>",
      "<p class=\"sr-empty__hint\">Finding matching groups, threads, and users</p>",
    ].join("");
  }

  function renderError(message) {
    panel.className = "sr-empty dg-surface-card";
    panel.innerHTML = [
      "<h2 class=\"sr-empty__title\">Search failed</h2>",
      "<p class=\"sr-empty__hint\">" + escapeHtml(message || "Could not complete search.") + "</p>",
    ].join("");
  }

  function renderNoResults() {
    panel.className = "sr-empty dg-surface-card";
    panel.innerHTML = [
      "<h2 class=\"sr-empty__title\">No results found</h2>",
      "<p class=\"sr-empty__hint\">Try a different search term.</p>",
    ].join("");
  }

  function renderGroupResults(groups) {
    if (!groups.length) {
      renderNoResults();
      return;
    }

    panel.className = "dg-surface-card";
    panel.innerHTML =
      '<div class="dg-cards dg-cards--grid p-3">' +
      groups
        .map(function (group) {
          var id = group && (group.id || group._id) ? String(group.id || group._id) : "";
          var name = escapeHtml(group && group.name ? group.name : "Untitled group");
          var description = escapeHtml(group && group.description ? group.description : "");
          var categoryName = escapeHtml(group && group.category && group.category.name ? group.category.name : "Uncategorized");
          var memberCount = typeof group.memberCount === "number" ? group.memberCount : 0;
          var cover = resolveAssetUrl(group && group.coverImageUrl);

          return [
            '<article class="dg-card">',
            '<div class="dg-card-media">',
            cover
              ? '<img class="dg-card-img" src="' + escapeHtml(cover) + '" alt="" width="344" height="194" />'
              : '<div class="dg-card-img"></div>',
            "</div>",
            '<div class="dg-card-body">',
            '<div class="dg-card-main">',
            '<span class="dg-badge dg-badge--category">' + categoryName + "</span>",
            '<h2 class="dg-card-title">' + name + "</h2>",
            '<p class="dg-card-desc">' + description + "</p>",
            "</div>",
            '<footer class="dg-card-footer">',
            '<div class="dg-members"><span>' + memberCount + " members</span></div>",
            '<div class="dg-card-actions"><a class="dg-btn dg-btn--ghost" href="./group_detail.html?groupId=' + encodeURIComponent(id) + '">View</a></div>',
            "</footer>",
            "</div>",
            "</article>",
          ].join("");
        })
        .join("") +
      "</div>";
  }

  function renderUserResults(users) {
    if (!users.length) {
      renderNoResults();
      return;
    }

    function getInviteState(userId) {
      if (!userId) return "disabled";
      if (currentUserId && userId === currentUserId) return "self";
      if (friendByUserId[userId]) return "friends";
      if (sentInvitationByUserId[userId]) return "pending";
      return "available";
    }

    panel.className = "dg-surface-card";
    panel.innerHTML =
      '<div class="p-3"><ul class="gd-member-list">' +
      users
        .map(function (user) {
          var userId = user && (user.id || user._id) ? String(user.id || user._id) : "";
          var profileHref = "../Profile/profile.html" + (userId ? "?id=" + encodeURIComponent(userId) : "");
          var username = user && user.username ? String(user.username) : "Unknown";
          var email = user && user.email ? String(user.email) : "";
          var bio = user && user.bio ? String(user.bio) : "";
          var avatar = resolveAssetUrl(user && user.avatarUrl) || "https://cdn-icons-png.flaticon.com/512/149/149071.png";
          var level = typeof user.level === "number" ? user.level : 1;
          var meta = bio || email || "Community member";
          var inviteState = getInviteState(userId);
          var inviteLabel =
            inviteState === "self"
              ? "You"
              : inviteState === "friends"
                ? "Friends"
                : inviteState === "pending"
                  ? "Invitation sent"
                  : "Send Invitation";
          var inviteDisabled = inviteState !== "available";

          return [
            "<li>",
            '<article class="profile-card gd-profile-card">',
            '<a class="gd-profile-card__avatar-zone" href="' + profileHref + '" aria-label="Open ' + escapeHtml(username) + ' profile">',
            '<span class="gd-profile-card__level">Lvl ' + level + "</span>",
            '<div class="avatar-shell avatar-shell--gd-profile avatar-shell--border" data-forgeon-avatar data-user-level="' + level + '">',
            '<div class="avatar-frame" aria-hidden="true"></div>',
            '<img class="gd-profile-card__avatar" src="' + escapeHtml(avatar) + '" alt="' + escapeHtml(username) + ' avatar" width="72" height="72" />',
            "</div>",
            "</a>",
            '<div class="gd-profile-card__body">',
            '<h3 class="gd-profile-card__name"><a class="gd-profile-card__link" href="' + profileHref + '">' + escapeHtml(username) + "</a></h3>",
            '<p class="gd-profile-card__handle">@' + escapeHtml(normalize(username).replace(/\s+/g, "")) + "</p>",
            '<p class="gd-profile-card__meta">' + escapeHtml(meta) + "</p>",
            "</div>",
            '<div class="d-flex align-items-center gap-2">',
            '<a class="gd-profile-card__link" href="' + profileHref + '">View profile</a>',
            '<button type="button" class="dg-btn dg-btn--secondary" data-action="send-friend-invitation" data-user-id="' + escapeHtml(userId) + '"' + (inviteDisabled ? " disabled" : "") + ">" + escapeHtml(inviteLabel) + "</button>",
            "</div>",
            "</article>",
            "</li>",
          ].join("");
        })
        .join("") +
      "</ul></div>";

    if (window.ForgeonAvatarFrames && typeof window.ForgeonAvatarFrames.refreshAll === "function") {
      window.ForgeonAvatarFrames.refreshAll();
    }
  }

  function renderThreadResults(threads) {
    if (!threads.length) {
      renderNoResults();
      return;
    }

    panel.className = "dg-surface-card";
    panel.innerHTML =
      '<div class="p-3"><ul class="gd-thread-list">' +
      threads
        .map(function (thread) {
          var threadId = thread && (thread.id || thread._id) ? String(thread.id || thread._id) : "";
          var title = thread && thread.title ? String(thread.title) : "Untitled thread";
          var author =
            thread && thread.author && (thread.author.username || thread.author.email)
              ? String(thread.author.username || thread.author.email)
              : "Unknown";
          var avatar =
            resolveAssetUrl(thread && thread.author && thread.author.avatarUrl) || "/assets/images/default-avatar.svg";
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
        })
        .join("") +
      "</ul></div>";

    if (window.ForgeonAvatarFrames && typeof window.ForgeonAvatarFrames.refreshAll === "function") {
      window.ForgeonAvatarFrames.refreshAll();
    }
  }

  function buildThreadCommentItem(comment) {
    var author =
      comment && comment.author && (comment.author.username || comment.author.email)
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
    var inputEl = document.getElementById("gtvCommentInput");
    var buttonEl = document.getElementById("gtvPostCommentBtn");
    if (!inputEl || !buttonEl) return;

    var content = String(inputEl.value || "").trim();
    if (!content) return;

    buttonEl.disabled = true;
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
      inputEl.value = "";
      await loadThreadComments(activeThreadId);
    } catch (error) {
      window.alert(error && error.message ? error.message : "Could not post comment.");
    } finally {
      buttonEl.disabled = false;
    }
  }

  function renderResults(data) {
    var groups = data.results && Array.isArray(data.results.groups) ? data.results.groups : [];
    var users = data.results && Array.isArray(data.results.users) ? data.results.users : [];
    var threads = data.results && Array.isArray(data.results.threads) ? data.results.threads : [];

    if (currentScope === "groups") {
      renderGroupResults(groups);
      return;
    }
    if (currentScope === "users") {
      renderUserResults(users);
      return;
    }
    renderThreadResults(threads);
  }

  async function handleSendFriendInvitation(targetUserId, triggerButton) {
    if (!targetUserId || !window.ForgeonFriendsInvitationsController) return;
    if (friendByUserId[targetUserId] || sentInvitationByUserId[targetUserId] || targetUserId === currentUserId) return;

    try {
      triggerButton.disabled = true;
      triggerButton.textContent = "Sending...";
      await window.ForgeonFriendsInvitationsController.create({ recipient: targetUserId });
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

  async function doSearch(term) {
    var query = String(term || "").trim();
    if (!query) {
      renderEmpty();
      return;
    }

    var token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      window.location.href = "/login.html";
      return;
    }

    activeRequest += 1;
    var requestId = activeRequest;
    renderLoading();

    try {
      var url = API_URL + "?q=" + encodeURIComponent(query) + "&scope=" + encodeURIComponent(currentScope) + "&limit=" + LIMIT;
      var response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: "Bearer " + token,
        },
      });

      var payload = await response.json().catch(function () {
        return {};
      });
      if (!response.ok) {
        throw new Error(payload.message || "Search request failed.");
      }

      if (requestId !== activeRequest) {
        return;
      }
      if (currentScope === "users") {
        await ensureRelationshipState();
      }
      renderResults(payload);
    } catch (error) {
      if (requestId !== activeRequest) {
        return;
      }
      renderError(error.message);
    }
  }

  function triggerSearch() {
    if (debounceTimer) {
      window.clearTimeout(debounceTimer);
    }
    debounceTimer = window.setTimeout(function () {
      updateUrlState(input.value);
      doSearch(input.value);
    }, DEBOUNCE_MS);
  }

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      setActive(tab);
      triggerSearch();
    });
  });

  panel.addEventListener("click", function (event) {
    var threadLink = event.target.closest("[data-action='open-thread'][data-thread-id]");
    if (threadLink) {
      event.preventDefault();
      openThreadModal(threadLink.getAttribute("data-thread-id"));
      return;
    }

    var inviteButton = event.target.closest("[data-action='send-friend-invitation']");
    if (!inviteButton) return;
    event.preventDefault();
    handleSendFriendInvitation(inviteButton.getAttribute("data-user-id"), inviteButton);
  });

  input.addEventListener("input", triggerSearch);

  var postThreadCommentButton = document.getElementById("gtvPostCommentBtn");
  var threadCommentInput = document.getElementById("gtvCommentInput");
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

  var initialParams = new URLSearchParams(window.location.search);
  var initialScope = String(initialParams.get("scope") || "").toLowerCase().trim();
  var initialQuery = String(initialParams.get("q") || "").trim();
  var initialTab = Array.prototype.find.call(tabs, function (tab) {
    return scopeByTabId[tab.id] === initialScope;
  });
  if (initialTab) {
    setActive(initialTab);
  } else {
    var defaultGroupsTab = document.getElementById("sr-tab-groups");
    if (defaultGroupsTab) setActive(defaultGroupsTab);
  }
  if (initialQuery) {
    input.value = initialQuery;
    doSearch(initialQuery);
    return;
  }

  renderEmpty();
})();
