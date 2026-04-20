(function () {
  var ta = document.getElementById("groupDesc");
  var out = document.getElementById("charCount");
  var form = document.getElementById("groupSettingsForm");

  function updateCount() {
    if (!ta || !out) return;
    var n = ta.value.length;
    out.textContent = n + " character" + (n === 1 ? "" : "s");
  }

  if (ta) {
    ta.addEventListener("input", updateCount);
    updateCount();
  }

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      window.location.href = "./group_invitations.html";
    });
  }
})();
