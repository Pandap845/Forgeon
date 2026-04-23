(function () {
  const grid = document.getElementById("groupsGrid");
  const btnGrid = document.getElementById("btnGridView");
  const btnList = document.getElementById("btnListView");
  const search = document.getElementById("groupSearch");
  const countEl = document.getElementById("groupCount");

  const totalCards = document.querySelectorAll(".dg-card").length;

  function setView(mode) {
    const isGrid = mode === "grid";
    grid.classList.toggle("dg-cards--grid", isGrid);
    grid.classList.toggle("dg-cards--list", !isGrid);
    btnGrid.classList.toggle("dg-view-btn--active", isGrid);
    btnList.classList.toggle("dg-view-btn--active", !isGrid);
    btnGrid.setAttribute("aria-pressed", String(isGrid));
    btnList.setAttribute("aria-pressed", String(!isGrid));
  }

  btnGrid.addEventListener("click", function () {
    setView("grid");
  });

  btnList.addEventListener("click", function () {
    setView("list");
  });

  grid.addEventListener("click", function (event) {
    var trigger = event.target.closest(".dg-btn");
    if (!trigger) return;
    if (trigger.classList.contains("dg-btn--ghost")) {
      if (trigger.tagName === "A" && trigger.getAttribute("href")) return;
      window.location.href = "./group_detail.html";
      return;
    }
    if (
      trigger.classList.contains("dg-btn--primary") ||
      trigger.classList.contains("dg-btn--secondary")
    ) {
      window.location.href = "./group_management.html";
    }
  });

  function normalize(s) {
    return (s || "").toLowerCase().trim();
  }

  function filterCards() {
    const q = normalize(search.value);
    let visible = 0;

    document.querySelectorAll(".dg-card").forEach(function (card) {
      const title = card.querySelector(".dg-card-title");
      const desc = card.querySelector(".dg-card-desc");
      const cat = card.getAttribute("data-category") || "";
      const hay = normalize(
        (title ? title.textContent : "") +
          " " +
          (desc ? desc.textContent : "") +
          " " +
          cat
      );
      const match = !q || hay.includes(q);
      card.hidden = !match;
      if (match) visible += 1;
    });

    countEl.textContent =
      "Showing " + visible + " of " + totalCards + " groups";
  }

  search.addEventListener("input", filterCards);
})();
