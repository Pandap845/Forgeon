(function () {
  var grid = document.getElementById("groupsGrid");
  var btnGrid = document.getElementById("btnGridView");
  var btnList = document.getElementById("btnListView");
  var search = document.getElementById("groupSearch");
  var sortSelect = document.getElementById("sortSelect");
  var countEl = document.getElementById("groupCount");

  if (!grid || !btnGrid || !btnList || !search || !sortSelect || !countEl) return;

  var allGroups = [];
  var visibleGroups = [];
  var membershipByGroupId = {};
  var currentUserId = "";

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

  function setView(mode) {
    var isGrid = mode === "grid";
    grid.classList.toggle("dg-cards--grid", isGrid);
    grid.classList.toggle("dg-cards--list", !isGrid);
    btnGrid.classList.toggle("dg-view-btn--active", isGrid);
    btnList.classList.toggle("dg-view-btn--active", !isGrid);
    btnGrid.setAttribute("aria-pressed", String(isGrid));
    btnList.setAttribute("aria-pressed", String(!isGrid));
  }

  function sortGroups(list) {
    var sortValue = sortSelect.value;
    var copy = list.slice();

    if (sortValue === "newest") {
      copy.sort(function (a, b) {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
      return copy;
    }

    copy.sort(function (a, b) {
      var membersA = typeof a.memberCount === "number" ? a.memberCount : 0;
      var membersB = typeof b.memberCount === "number" ? b.memberCount : 0;
      if (membersB !== membersA) return membersB - membersA;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
    return copy;
  }

  function renderGroups(groups) {
    visibleGroups = groups.slice();
    if (!groups.length) {
      grid.innerHTML =
        '<article class="dg-card"><div class="dg-card-body"><div class="dg-card-main"><h2 class="dg-card-title">No groups found</h2><p class="dg-card-desc">Try a different name or create a new group.</p></div></div></article>';
      countEl.textContent = "Showing 0 of " + allGroups.length + " groups";
      return;
    }

    grid.innerHTML = groups
      .map(function (group) {
        var id = group && (group._id || group.id) ? String(group._id || group.id) : "";
        var name = escapeHtml(group && group.name ? group.name : "Untitled group");
        var description = escapeHtml(group && group.description ? group.description : "");
        var categoryName = escapeHtml(group && group.category && group.category.name ? group.category.name : "Uncategorized");
        var memberCount = typeof group.memberCount === "number" ? group.memberCount : 0;
        var coverImage = resolveAssetUrl(group && group.coverImageUrl);
        var creatorId = group && group.creator && (group.creator._id || group.creator.id) ? String(group.creator._id || group.creator.id) : "";
        var isOwner = currentUserId && creatorId === currentUserId;
        var isMember = !!membershipByGroupId[id];
        var actionMarkup = isOwner
          ? '<a class="dg-btn dg-btn--primary" href="./group_settings.html?groupId=' + encodeURIComponent(id) + '">Manage</a>'
          : isMember
          ? '<button type="button" class="dg-btn dg-btn--secondary" disabled>Joined</button>'
          : '<button type="button" class="dg-btn dg-btn--primary" data-action="join" data-group-id="' + escapeHtml(id) + '">Join</button>';
        var coverMarkup = coverImage
          ? '<img class="dg-card-img" src="' + escapeHtml(coverImage) + '" alt="" width="344" height="194" />'
          : '<div class="dg-card-img"></div>';

        return [
          '<article class="dg-card" data-group-id="' + escapeHtml(id) + '">',
          '<div class="dg-card-media">',
          coverMarkup,
          "</div>",
          '<div class="dg-card-body">',
          '<div class="dg-card-main">',
          '<span class="dg-badge dg-badge--category">' + categoryName + "</span>",
          '<h2 class="dg-card-title">' + name + "</h2>",
          '<p class="dg-card-desc">' + description + "</p>",
          "</div>",
          '<footer class="dg-card-footer">',
          '<div class="dg-members"><span>' + memberCount + " members</span></div>",
          '<div class="dg-card-actions">',
          '<a class="dg-btn dg-btn--ghost" href="./group_detail.html?groupId=' + encodeURIComponent(id) + '">View</a>',
          actionMarkup,
          "</div>",
          "</footer>",
          "</div>",
          "</article>",
        ].join("");
      })
      .join("");

    countEl.textContent = "Showing " + groups.length + " of " + allGroups.length + " groups";
  }

  function applyFilters() {
    var q = normalize(search.value);
    var filtered = allGroups.filter(function (group) {
      return normalize(group && group.name).includes(q);
    });
    renderGroups(sortGroups(filtered));
  }

  async function loadGroups() {
    try {
      var rawCurrentUser = localStorage.getItem("forgeonCurrentUser");
      if (rawCurrentUser) {
        try {
          var parsedCurrentUser = JSON.parse(rawCurrentUser);
          currentUserId = String(parsedCurrentUser && parsedCurrentUser.id ? parsedCurrentUser.id : "");
        } catch (_error) {
          currentUserId = "";
        }
      }

      var groupsPromise = window.ForgeonGroupsController.list();
      var membershipsPromise = window.ForgeonGroupMembershipsController
        ? window.ForgeonGroupMembershipsController.list()
        : Promise.resolve([]);
      var loaded = await Promise.all([groupsPromise, membershipsPromise]);
      allGroups = loaded[0];
      var memberships = loaded[1];
      if (!Array.isArray(allGroups)) allGroups = [];
      membershipByGroupId = {};
      if (Array.isArray(memberships)) {
        memberships.forEach(function (membership) {
          var gid = membership && membership.group && (membership.group._id || membership.group.id || membership.group);
          if (gid) {
            membershipByGroupId[String(gid)] = membership;
          }
        });
      }
      applyFilters();
    } catch (error) {
      grid.innerHTML =
        '<article class="dg-card"><div class="dg-card-body"><div class="dg-card-main"><h2 class="dg-card-title">Could not load groups</h2><p class="dg-card-desc">' +
        escapeHtml(error.message || "Request failed.") +
        "</p></div></div></article>";
      countEl.textContent = "Showing 0 of 0 groups";
      if (String(error.message || "").toLowerCase().includes("missing authentication token")) {
        window.location.href = "/login.html";
      }
    }
  }

  async function handleJoin(groupId, triggerButton) {
    if (!groupId || !window.ForgeonGroupMembershipsController) return;
    try {
      triggerButton.disabled = true;
      triggerButton.textContent = "Joining...";
      await window.ForgeonGroupMembershipsController.create({ group: groupId });
      membershipByGroupId[String(groupId)] = { group: groupId };

      allGroups = allGroups.map(function (group) {
        var id = group && (group._id || group.id) ? String(group._id || group.id) : "";
        if (id !== String(groupId)) return group;
        var nextCount = typeof group.memberCount === "number" ? group.memberCount + 1 : 1;
        return Object.assign({}, group, { memberCount: nextCount });
      });

      applyFilters();
    } catch (_error) {
      triggerButton.disabled = false;
      triggerButton.textContent = "Join";
    }
  }

  btnGrid.addEventListener("click", function () {
    setView("grid");
  });

  btnList.addEventListener("click", function () {
    setView("list");
  });

  grid.addEventListener("click", function (event) {
    var joinButton = event.target.closest("[data-action='join']");
    if (!joinButton) return;
    event.preventDefault();
    handleJoin(joinButton.getAttribute("data-group-id"), joinButton);
  });

  search.addEventListener("input", applyFilters);
  sortSelect.addEventListener("change", applyFilters);

  setView("grid");
  loadGroups();
})();
