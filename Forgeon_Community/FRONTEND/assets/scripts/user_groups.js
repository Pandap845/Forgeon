(function () {
  var membershipsController = window.ForgeonGroupMembershipsController;
  var groupsController = window.ForgeonGroupsController;
  var invitationsController = window.ForgeonGroupsInvitationsController;

  var searchInput = document.getElementById("userGroupsSearch");
  var countLabel = document.getElementById("userGroupsCountLabel");
  var tabJoined = document.getElementById("ug-tab-joined");
  var tabInvitations = document.getElementById("ug-tab-invitations");
  var joinedPanel = document.getElementById("ug-panel-joined");
  var invitationsPanel = document.getElementById("ug-panel-invitations");
  var joinedList = document.getElementById("ugJoinedList");
  var invitationsList = document.getElementById("ugInvitationsList");
  var joinedTabCount = document.getElementById("ugJoinedTabCount");
  var invitationsTabCount = document.getElementById("ugInvitationsTabCount");
  var deleteNameEl = document.getElementById("ugDeleteGroupName");
  var deleteConfirmBtn = document.getElementById("ugDeleteGroupConfirmBtn");
  var deleteModalEl = document.getElementById("ugDeleteGroupModal");
  var deleteModal = deleteModalEl && typeof bootstrap !== "undefined" ? new bootstrap.Modal(deleteModalEl) : null;
  var pendingDelete = null;

  if (
    !membershipsController ||
    !groupsController ||
    !invitationsController ||
    !searchInput ||
    !countLabel ||
    !tabJoined ||
    !tabInvitations ||
    !joinedPanel ||
    !invitationsPanel ||
    !joinedList ||
    !invitationsList ||
    !joinedTabCount ||
    !invitationsTabCount
  ) {
    return;
  }

  var joinedItems = [];
  var invitationItems = [];
  var activeTab = "joined";

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatCount(count, noun) {
    return count + " " + noun + (count === 1 ? "" : "s");
  }

  function showJoinedTab() {
    activeTab = "joined";
    tabJoined.classList.add("fr-tab--active");
    tabInvitations.classList.remove("fr-tab--active");
    tabJoined.setAttribute("aria-selected", "true");
    tabInvitations.setAttribute("aria-selected", "false");
    joinedPanel.classList.remove("fr-panel--hidden");
    joinedPanel.hidden = false;
    invitationsPanel.classList.add("fr-panel--hidden");
    invitationsPanel.hidden = true;
    renderActiveTab();
  }

  function showInvitationsTab() {
    activeTab = "invitations";
    tabInvitations.classList.add("fr-tab--active");
    tabJoined.classList.remove("fr-tab--active");
    tabInvitations.setAttribute("aria-selected", "true");
    tabJoined.setAttribute("aria-selected", "false");
    invitationsPanel.classList.remove("fr-panel--hidden");
    invitationsPanel.hidden = false;
    joinedPanel.classList.add("fr-panel--hidden");
    joinedPanel.hidden = true;
    renderActiveTab();
  }

  function updateCounts() {
    joinedTabCount.textContent = String(joinedItems.length);
    invitationsTabCount.textContent = String(invitationItems.length);
  }

  function buildJoinedCard(item) {
    var group = item.group || {};
    var role = item.role === "owner" ? "owner" : "member";
    var isOwner = role === "owner";
    var categoryName = group.category && group.category.name ? group.category.name : "Uncategorized";
    var groupName = group.name || "Unnamed group";
    var description = group.description || "No description available.";
    var memberCount = Number(group.memberCount || 0);
    var iconImageUrl = group.iconImageUrl || "";

    return (
      '<article class="ug-card" data-searchable-name="' +
      escapeHtml(groupName.toLowerCase()) +
      '">' +
      '<div class="ug-card__top">' +
      '<img class="ug-thumb" src="' +
      escapeHtml(iconImageUrl || "https://via.placeholder.com/64x64?text=G") +
      '" alt="" width="64" height="64" />' +
      '<div class="ug-content">' +
      '<h2 class="ug-title">' +
      escapeHtml(groupName) +
      "</h2>" +
      '<p class="ug-desc">' +
      escapeHtml(description) +
      "</p>" +
      '<div class="ug-meta">' +
      '<span class="dg-badge dg-badge--category">' +
      escapeHtml(categoryName) +
      "</span>" +
      (isOwner ? '<span class="dg-badge dg-badge--category">Owner</span>' : "") +
      '<span class="dg-members"><span>' +
      escapeHtml(formatCount(memberCount, "member")) +
      "</span></span>" +
      "</div>" +
      "</div>" +
      '<div class="ug-actions">' +
      '<a class="dg-btn dg-btn--ghost ug-btn" href="./group_detail.html?groupId=' +
      encodeURIComponent(group._id || "") +
      '">View</a>' +
      (isOwner
        ? '<button type="button" class="btn btn-sm btn-outline-danger gm-delete-group-btn ug-btn" data-group-id="' +
        encodeURIComponent(group._id || "") +
        '" data-group-name="' +
        escapeHtml(groupName) +
        '">Delete</button>'
        : '<button type="button" class="dg-btn dg-btn--secondary ug-btn ug-btn--leave" data-membership-id="' +
        escapeHtml(item._id) +
        '">Leave</button>') +
      "</div>" +
      "</div>" +
      "</article>"
    );
  }

  function buildInvitationCard(item) {
    var group = item.group || {};
    var sender = item.sender || {};
    var groupName = group.name || "Unknown group";
    var senderName = sender.username || sender.email || "Unknown user";
    var message = item.message || "";
    var iconImageUrl = group.iconImageUrl || group.coverImageUrl || "";

    return (
      '<article class="ug-card" data-searchable-name="' +
      escapeHtml(groupName.toLowerCase()) +
      '">' +
      '<div class="ug-card__top">' +
      '<img class="ug-thumb" src="' +
      escapeHtml(iconImageUrl || "https://via.placeholder.com/64x64?text=I") +
      '" alt="" width="64" height="64" />' +
      '<div class="ug-content">' +
      '<h2 class="ug-title">' +
      escapeHtml(groupName) +
      "</h2>" +
      '<p class="ug-desc">Invited by ' +
      escapeHtml(senderName) +
      (message ? " — " + escapeHtml(message) : "") +
      "</p>" +
      "</div>" +
      '<div class="ug-actions">' +
      '<button type="button" class="dg-btn dg-btn--secondary ug-btn" data-inv-action="accept" data-invitation-id="' +
      escapeHtml(item._id) +
      '">Accept</button>' +
      '<button type="button" class="dg-btn dg-btn--ghost ug-btn" data-inv-action="reject" data-invitation-id="' +
      escapeHtml(item._id) +
      '">Reject</button>' +
      "</div>" +
      "</div>" +
      "</article>"
    );
  }

  function renderJoined(searchTerm) {
    var term = (searchTerm || "").trim().toLowerCase();
    var filtered = joinedItems.filter(function (item) {
      var name = (((item || {}).group || {}).name || "").toLowerCase();
      return !term || name.indexOf(term) !== -1;
    });

    countLabel.textContent = formatCount(filtered.length, "group");

    if (filtered.length === 0) {
      joinedList.innerHTML = '<article class="ug-card"><div class="ug-card__top"><div class="ug-content"><h2 class="ug-title">No joined groups found.</h2></div></div></article>';
      return;
    }

    joinedList.innerHTML = filtered.map(buildJoinedCard).join("");
  }

  function renderInvitations(searchTerm) {
    var term = (searchTerm || "").trim().toLowerCase();
    var filtered = invitationItems.filter(function (item) {
      var name = (((item || {}).group || {}).name || "").toLowerCase();
      return !term || name.indexOf(term) !== -1;
    });

    countLabel.textContent = formatCount(filtered.length, "invitation");

    if (filtered.length === 0) {
      invitationsList.innerHTML =
        '<article class="ug-card"><div class="ug-card__top"><div class="ug-content"><h2 class="ug-title">No group invitations found.</h2></div></div></article>';
      return;
    }

    invitationsList.innerHTML = filtered.map(buildInvitationCard).join("");
  }

  function renderActiveTab() {
    if (activeTab === "invitations") {
      renderInvitations(searchInput.value);
    } else {
      renderJoined(searchInput.value);
    }
  }

  async function loadData() {
    try {
      var [memberships, invitations, groups] = await Promise.all([
        membershipsController.list(),
        invitationsController.list("received"),
        groupsController.list(),
      ]);

      var groupsById = {};
      (Array.isArray(groups) ? groups : []).forEach(function (group) {
        if (group && group._id) groupsById[group._id] = group;
      });

      joinedItems = (Array.isArray(memberships) ? memberships : [])
        .filter(function (membership) {
          if (!membership) return false;
          if (!membership.group || !membership.group._id) return false;
          return true;
        })
        .map(function (membership) {
          var detailedGroup = groupsById[membership.group._id] || membership.group;
          return {
            _id: membership._id,
            role: membership.role,
            group: detailedGroup,
          };
        })
        .filter(function (item) {
          return item.group && item.group.isDeleted !== true;
        });

      invitationItems = (Array.isArray(invitations) ? invitations : [])
        .filter(function (invitation) {
          return invitation && invitation.status === "pending";
        })
        .map(function (invitation) {
          var invitationGroup = invitation.group || {};
          var groupId = String(invitationGroup._id || invitationGroup.id || invitationGroup || "");
          var detailedGroup = groupsById[groupId] || invitationGroup;
          return {
            _id: invitation._id,
            status: invitation.status,
            message: invitation.message,
            sender: invitation.sender,
            group: detailedGroup,
          };
        });

      updateCounts();
      renderActiveTab();
    } catch (error) {
      joinedList.innerHTML =
        '<article class="ug-card"><div class="ug-card__top"><div class="ug-content"><h2 class="ug-title">Could not load your groups.</h2></div></div></article>';
      invitationsList.innerHTML =
        '<article class="ug-card"><div class="ug-card__top"><div class="ug-content"><h2 class="ug-title">Could not load your invitations.</h2></div></div></article>';
      countLabel.textContent = "0";
      joinedTabCount.textContent = "0";
      invitationsTabCount.textContent = "0";
    }
  }

  function openDeleteModal(groupId, groupName) {
    pendingDelete = { id: groupId, name: groupName };
    if (deleteNameEl) deleteNameEl.textContent = groupName || "this group";
    if (deleteModal) deleteModal.show();
  }

  async function confirmDeleteGroup() {
    if (!pendingDelete || !pendingDelete.id) return;
    if (deleteConfirmBtn) deleteConfirmBtn.disabled = true;
    try {
      await groupsController.remove(pendingDelete.id);
      if (deleteModal) deleteModal.hide();
      pendingDelete = null;
      await loadData();
    } catch (error) {
      window.alert(error && error.message ? error.message : "Could not delete group.");
    } finally {
      if (deleteConfirmBtn) deleteConfirmBtn.disabled = false;
    }
  }

  async function handleJoinedActionsClick(event) {
    var deleteBtn = event.target.closest(".gm-delete-group-btn");
    if (deleteBtn) {
      var groupId = deleteBtn.getAttribute("data-group-id");
      var groupName = deleteBtn.getAttribute("data-group-name");
      if (!groupId) return;
      openDeleteModal(decodeURIComponent(groupId), groupName || "this group");
      return;
    }

    var button = event.target.closest(".ug-btn--leave[data-membership-id]");
    if (!button) return;

    var membershipId = button.getAttribute("data-membership-id");
    if (!membershipId) return;
    if (!window.confirm("Leave this group?")) return;

    button.disabled = true;
    try {
      await membershipsController.remove(membershipId);
      await loadData();
    } catch (error) {
      button.disabled = false;
      window.alert(error && error.message ? error.message : "Could not leave group.");
    }
  }

  if (deleteConfirmBtn) {
    deleteConfirmBtn.addEventListener("click", confirmDeleteGroup);
  }

  async function handleInvitationAction(event) {
    var button = event.target.closest("[data-inv-action][data-invitation-id]");
    if (!button) return;

    var invitationId = button.getAttribute("data-invitation-id");
    var action = button.getAttribute("data-inv-action");
    var status = action === "accept" ? "accepted" : action === "reject" ? "rejected" : "";
    if (!invitationId || !status) return;

    button.disabled = true;
    try {
      await invitationsController.update(invitationId, { status: status });
      await loadData();
    } catch (error) {
      button.disabled = false;
      window.alert(error && error.message ? error.message : "Could not update invitation.");
    }
  }

  tabJoined.addEventListener("click", showJoinedTab);
  tabInvitations.addEventListener("click", showInvitationsTab);
  searchInput.addEventListener("input", renderActiveTab);
  joinedList.addEventListener("click", handleJoinedActionsClick);
  invitationsList.addEventListener("click", handleInvitationAction);

  try {
    var params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "invitations") {
      showInvitationsTab();
    }
  } catch (_e) { }

  loadData();
})();
