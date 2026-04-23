(function () {
  var DATA = window.ForgeonGroupDetailData;
  if (DATA) {
    var params = new URLSearchParams(window.location.search);
    var slug = params.get("g") || "react-developers";
    var group = DATA[slug];
    if (!group) {
      slug = "react-developers";
      group = DATA[slug];
    }
    if (group) {
      var titleEl = document.getElementById("groupTitle");
      if (titleEl) titleEl.textContent = group.title;
      document.title = "Forgeon — " + group.title;

      var badge = document.getElementById("groupCategoryBadge");
      if (badge) badge.textContent = group.category;

      var hero = document.getElementById("groupHeroImg");
      if (hero) hero.src = group.hero;

      var av = document.getElementById("groupAvatarImg");
      if (av) {
        av.src = group.avatar;
        av.alt = group.title + " avatar";
      }

      var membersCount = document.getElementById("groupMembersCount");
      if (membersCount) membersCount.textContent = group.members;

      var creatorLine = document.getElementById("groupCreatorLine");
      if (creatorLine) creatorLine.textContent = group.creator;

      var about = document.getElementById("groupAboutText");
      if (about) about.textContent = group.about;

      var join = document.getElementById("groupJoinLink");
      if (join) join.setAttribute("href", "./group_management.html?g=" + encodeURIComponent(slug));
    }
  }

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
