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
            '<div class="gd-profile-card__avatar-zone">',
            '<span class="gd-profile-card__level">Lvl ' + level + "</span>",
            '<div class="avatar-shell avatar-shell--gd-profile avatar-shell--border" data-forgeon-avatar data-user-level="' + level + '">',
            '<div class="avatar-frame" aria-hidden="true"></div>',
            '<img class="gd-profile-card__avatar" src="' + escapeHtml(avatar) + '" alt="' + escapeHtml(username) + ' avatar" width="72" height="72" />',
            "</div>",
            "</div>",
            '<div class="gd-profile-card__body">',
            '<h3 class="gd-profile-card__name">' + escapeHtml(username) + "</h3>",
            '<p class="gd-profile-card__handle">@' + escapeHtml(normalize(username).replace(/\s+/g, "")) + "</p>",
            '<p class="gd-profile-card__meta">' + escapeHtml(meta) + "</p>",
            "</div>",
            '<div class="d-flex align-items-center gap-2">',
            '<a class="gd-profile-card__link" href="../Profile/profile.html' +
              (userId ? "?id=" + encodeURIComponent(userId) : "") +
              '">View profile</a>',
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
    panel.className = "sr-empty dg-surface-card";
    panel.innerHTML = [
      "<h2 class=\"sr-empty__title\">Threads view coming next</h2>",
      "<p class=\"sr-empty__hint\">Threads are found, but this tab UI is pending.</p>",
    ].join("");
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
    var inviteButton = event.target.closest("[data-action='send-friend-invitation']");
    if (!inviteButton) return;
    event.preventDefault();
    handleSendFriendInvitation(inviteButton.getAttribute("data-user-id"), inviteButton);
  });

  input.addEventListener("input", triggerSearch);

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
