(function () {
  var searchInput = document.getElementById("inviteSearch");
  var inviteList = document.getElementById("inviteList");
  var inviteCountBadge = document.getElementById("inviteCountBadge");
  var revokeAllBtn = document.getElementById("revokeAllBtn");
  var emptyState = document.getElementById("giEmpty");

  if (!searchInput || !inviteList || !inviteCountBadge || !revokeAllBtn || !emptyState) return;

  function getItems() {
    return Array.prototype.slice.call(inviteList.querySelectorAll("[data-invite-item]"));
  }

  function updateCount() {
    inviteCountBadge.textContent = String(getItems().length);
    revokeAllBtn.disabled = getItems().length === 0;
  }

  function applyFilter() {
    var query = (searchInput.value || "").toLowerCase().trim();
    var visible = 0;

    getItems().forEach(function (item) {
      var text = (item.getAttribute("data-search") || "").toLowerCase();
      var match = query.length === 0 || text.includes(query);
      item.hidden = !match;
      if (match) visible += 1;
    });

    emptyState.hidden = !(visible === 0);
  }

  inviteList.addEventListener("click", function (event) {
    var button = event.target.closest("[data-revoke]");
    if (!button) return;
    var item = button.closest("[data-invite-item]");
    if (!item) return;
    item.remove();
    updateCount();
    applyFilter();
  });

  revokeAllBtn.addEventListener("click", function () {
    getItems().forEach(function (item) {
      item.remove();
    });
    updateCount();
    applyFilter();
  });

  searchInput.addEventListener("input", applyFilter);

  updateCount();
  applyFilter();
})();
