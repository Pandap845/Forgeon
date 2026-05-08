(function () {
  var USER_KEY = "forgeonCurrentUser";
  var TOKEN_KEY = "forgeonAuthToken";
  var ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  var MIN_LEVEL_CREATE_GROUP = 10;

  var accountNameEl = document.getElementById("gmAccountName");
  var createdLineEl = document.getElementById("gmCreatedLine");
  var statusValueEl = document.getElementById("gmStatusValue");
  var groupListEl = document.getElementById("gmGroupList");
  var createBtn = document.getElementById("gmCreateGroupBtn");
  var deleteNameEl = document.getElementById("gmDeleteGroupName");
  var deleteConfirmBtn = document.getElementById("gmDeleteGroupConfirmBtn");
  var deleteModalEl = document.getElementById("gmDeleteGroupModal");
  var deleteModal = deleteModalEl ? new bootstrap.Modal(deleteModalEl) : null;
  var pendingDelete = null;

  if (!accountNameEl || !createdLineEl || !statusValueEl || !groupListEl || !createBtn) return;

  function parseCurrentUser() {
    var raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_error) {
      return null;
    }
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
      .replace(/'/g, "&#039;");
  }

  function setEligibility(createdAt, userLevel) {
    var created = new Date(createdAt);
    var weekOk = !Number.isNaN(created.getTime()) && Date.now() - created.getTime() >= ONE_WEEK_MS;
    var levelNum = parseInt(userLevel, 10);
    if (Number.isNaN(levelNum) || levelNum < 1) levelNum = 1;
    var levelOk = levelNum >= MIN_LEVEL_CREATE_GROUP;
    var eligible = weekOk && levelOk;

    if (eligible) {
      statusValueEl.className = "gm-status-ok";
      statusValueEl.textContent = "✓ Eligible to create groups";
      createBtn.style.pointerEvents = "";
      createBtn.style.opacity = "";
      createBtn.removeAttribute("aria-disabled");
      return;
    }

    statusValueEl.className = "gm-status-warn";
    var parts = [];
    if (!weekOk) parts.push("account must be 1 week old");
    if (!levelOk) parts.push("reach level " + MIN_LEVEL_CREATE_GROUP + " (you are level " + levelNum + ")");
    statusValueEl.textContent = "Not eligible yet (" + parts.join("; ") + ")";
    createBtn.style.pointerEvents = "none";
    createBtn.style.opacity = "0.5";
    createBtn.setAttribute("aria-disabled", "true");
  }

  function renderGroups(groups) {
    if (!Array.isArray(groups) || groups.length === 0) {
      groupListEl.innerHTML =
        '<li><span class="gm-group-pill"><span class="gm-group-pill__name">No groups created yet.</span></span></li>';
      return;
    }

    groupListEl.innerHTML = groups
      .map(function (group) {
        var name = group && group.name ? group.name : "Untitled group";
        var members = typeof group.memberCount === "number" ? group.memberCount : 0;
        var id = group && group._id ? group._id : "";
        return [
          "<li>",
          '<span class="gm-group-pill">',
          '<span class="gm-group-pill__name">' + escapeHtml(name) + "</span>",
          '<span class="gm-group-pill__meta">' + members + " members</span>",
          '<span class="d-inline-flex gap-2 ms-auto">',
          '<a class="dg-btn dg-btn--ghost" href="./group_detail.html?groupId=' + encodeURIComponent(id) + '">View</a>',
          '<button type="button" class="btn btn-sm btn-outline-danger gm-delete-group-btn" data-group-id="' + encodeURIComponent(id) + '" data-group-name="' + escapeHtml(name) + '">Delete</button>',
          "</span>",
          "</span>",
          "</li>",
        ].join("");
      })
      .join("");
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
      await window.ForgeonGroupsController.remove(pendingDelete.id);
      if (deleteModal) deleteModal.hide();
      pendingDelete = null;
      await loadData();
    } catch (error) {
      alert(error && error.message ? error.message : "Could not delete group.");
    } finally {
      if (deleteConfirmBtn) deleteConfirmBtn.disabled = false;
    }
  }

  async function loadData() {
    var token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      window.location.href = "/login.html";
      return;
    }

    var currentUser = parseCurrentUser();
    if (!currentUser || !currentUser.id) {
      window.location.href = "/login.html";
      return;
    }

    try {
      var user = await window.ForgeonUsersController.getById(currentUser.id);
      var groups = await window.ForgeonGroupsController.list({ createdBy: "me" });

      accountNameEl.textContent = user.username || "Unknown user";
      createdLineEl.textContent = "Created: " + formatDate(user.createdAt);
      setEligibility(user.createdAt, user.level);
      renderGroups(groups);
    } catch (error) {
      statusValueEl.className = "gm-status-warn";
      statusValueEl.textContent = error.message || "Could not load account status.";
      groupListEl.innerHTML =
        '<li><span class="gm-group-pill"><span class="gm-group-pill__name">Could not load groups.</span></span></li>';
    }
  }

  groupListEl.addEventListener("click", function (event) {
    var target = event.target;
    if (!target) return;
    var deleteBtn = target.closest(".gm-delete-group-btn");
    if (!deleteBtn) return;
    var groupId = deleteBtn.getAttribute("data-group-id");
    var groupName = deleteBtn.getAttribute("data-group-name");
    if (!groupId) return;
    openDeleteModal(decodeURIComponent(groupId), groupName || "this group");
  });

  if (deleteConfirmBtn) {
    deleteConfirmBtn.addEventListener("click", confirmDeleteGroup);
  }

  loadData();
})();