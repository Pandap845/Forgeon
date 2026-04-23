(function () {
  var tabIncoming = document.getElementById("tab-incoming");
  var tabSent = document.getElementById("tab-sent");
  var panelIncoming = document.getElementById("panel-incoming");
  var panelSent = document.getElementById("panel-sent");

  if (!tabIncoming || !tabSent || !panelIncoming || !panelSent) return;

  function showIncoming() {
    tabIncoming.classList.add("fr-tab--active");
    tabSent.classList.remove("fr-tab--active");
    tabIncoming.setAttribute("aria-selected", "true");
    tabSent.setAttribute("aria-selected", "false");
    panelIncoming.classList.remove("fr-panel--hidden");
    panelIncoming.hidden = false;
    panelSent.classList.add("fr-panel--hidden");
    panelSent.hidden = true;
  }

  function showSent() {
    tabSent.classList.add("fr-tab--active");
    tabIncoming.classList.remove("fr-tab--active");
    tabSent.setAttribute("aria-selected", "true");
    tabIncoming.setAttribute("aria-selected", "false");
    panelSent.classList.remove("fr-panel--hidden");
    panelSent.hidden = false;
    panelIncoming.classList.add("fr-panel--hidden");
    panelIncoming.hidden = true;
  }

  tabIncoming.addEventListener("click", showIncoming);
  tabSent.addEventListener("click", showSent);
})();
