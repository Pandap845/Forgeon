(function () {
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

  async function loadGroup() {
    if (!window.ForgeonGroupsController) return;

    var params = new URLSearchParams(window.location.search);
    var groupId = params.get("groupId");
    if (!groupId) return;

    try {
      var group = await window.ForgeonGroupsController.getById(groupId);
      var titleEl = document.getElementById("groupTitle");
      var badge = document.getElementById("groupCategoryBadge");
      var hero = document.getElementById("groupHeroImg");
      var avatar = document.getElementById("groupAvatarImg");
      var membersCount = document.getElementById("groupMembersCount");
      var creatorLine = document.getElementById("groupCreatorLine");
      var about = document.getElementById("groupAboutText");
      var join = document.getElementById("groupJoinLink");

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

      if (join) {
        join.setAttribute("href", "./group_settings.html?groupId=" + encodeURIComponent(groupId));
      }
    } catch (_error) {}
  }

  loadGroup();

  var tabThreads = document.getElementById("tab-threads");
  var tabMembers = document.getElementById("tab-members");
  var panelThreads = document.getElementById("panel-threads");
  var panelMembers = document.getElementById("panel-members");

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
