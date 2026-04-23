(function () {
  var tabs = document.querySelectorAll(".sr-tab");
  if (!tabs.length) return;

  function setActive(activeBtn) {
    tabs.forEach(function (tab) {
      var on = tab === activeBtn;
      tab.classList.toggle("sr-tab--active", on);
      tab.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      setActive(tab);
    });
  });
})();
