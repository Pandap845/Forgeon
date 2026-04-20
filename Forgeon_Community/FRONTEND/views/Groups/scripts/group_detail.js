(function () {
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
