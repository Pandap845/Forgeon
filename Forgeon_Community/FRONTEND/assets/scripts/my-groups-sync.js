(function () {
  var KEY = "forgeon_my_groups_count";

  function readCount() {
    var raw = localStorage.getItem(KEY);
    if (raw === null) return null;
    var n = parseInt(raw, 10);
    if (isNaN(n) || n < 0) return null;
    return n;
  }

  function writeCount(n) {
    localStorage.setItem(KEY, String(Math.max(0, n)));
  }

  window.ForgeonMyGroups = {
    storageKey: KEY,
    getCount: function (fallback) {
      var v = readCount();
      return v === null ? fallback : v;
    },
    setCount: writeCount,
    /** Count .ug-card inside root (default .ug-list), persist, return count */
    syncFromList: function (root) {
      root = root || document.querySelector(".ug-list");
      if (!root) return 0;
      var n = root.querySelectorAll(".ug-card").length;
      writeCount(n);
      return n;
    },
  };
})();
