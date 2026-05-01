(function () {
  var TOKEN_KEY = "forgeonAuthToken";
  var API_URL = "/api/search";
  var DEBOUNCE_MS = 300;
  var LIMIT = 15;
  var currentScope = "all";
  var activeRequest = 0;
  var debounceTimer = null;

  var scopeByTabId = {
    "sr-tab-all": "all",
    "sr-tab-groups": "groups",
    "sr-tab-threads": "threads",
    "sr-tab-users": "users",
  };

  var tabs = document.querySelectorAll(".sr-tab");
  var input = document.getElementById("globalSearch");
  var panel = document.getElementById("sr-panel-all");
  if (!tabs.length || !input || !panel) return;

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function setActive(activeBtn) {
    tabs.forEach(function (tab) {
      var on = tab === activeBtn;
      tab.classList.toggle("sr-tab--active", on);
      tab.setAttribute("aria-selected", on ? "true" : "false");
    });
    currentScope = scopeByTabId[activeBtn.id] || "all";
  }

  function updateUrlState(term) {
    var params = new URLSearchParams(window.location.search);
    var cleaned = String(term || "").trim();
    if (cleaned) params.set("q", cleaned);
    else params.delete("q");
    if (currentScope && currentScope !== "all") params.set("scope", currentScope);
    else params.delete("scope");
    var next = window.location.pathname + (params.toString() ? "?" + params.toString() : "");
    window.history.replaceState({}, "", next);
  }

  function renderEmpty() {
    panel.className = "sr-empty dg-surface-card";
    panel.innerHTML = [
      '<img class="sr-empty__icon" src="https://www.figma.com/api/mcp/asset/2ec120f2-a579-4b81-b357-5c1b37701b3b" alt="" width="48" height="48" />',
      "<h2 class=\"sr-empty__title\">Start Searching</h2>",
      "<p class=\"sr-empty__hint\">Type in the search bar above to find groups, threads, or users</p>",
      '<a class="sr-empty__link" href="./discover_groups.html">Browse Discover Groups</a>',
    ].join("");
  }

  function renderLoading() {
    panel.className = "sr-empty dg-surface-card";
    panel.innerHTML = [
      '<img class="sr-empty__icon" src="https://www.figma.com/api/mcp/asset/2ec120f2-a579-4b81-b357-5c1b37701b3b" alt="" width="48" height="48" />',
      "<h2 class=\"sr-empty__title\">Searching...</h2>",
      "<p class=\"sr-empty__hint\">Finding matching groups, threads, and users</p>",
    ].join("");
  }

  function renderError(message) {
    panel.className = "sr-empty dg-surface-card";
    panel.innerHTML = [
      "<h2 class=\"sr-empty__title\">Search failed</h2>",
      "<p class=\"sr-empty__hint\">" + escapeHtml(message || "Could not complete search.") + "</p>",
    ].join("");
  }

  function itemTemplate(title, subtitle, meta) {
    return [
      '<article class="dg-surface-card p-3 mb-3">',
      '<h3 class="h6 mb-1">' + escapeHtml(title) + "</h3>",
      subtitle ? '<p class="text-muted-2 small mb-2">' + escapeHtml(subtitle) + "</p>" : "",
      meta ? '<div class="text-muted-3 small">' + escapeHtml(meta) + "</div>" : "",
      "</article>",
    ].join("");
  }

  function sectionTemplate(title, itemsHtml) {
    if (!itemsHtml.length) return "";
    return [
      '<section class="mb-4">',
      '<h2 class="h5 mb-3">' + escapeHtml(title) + "</h2>",
      itemsHtml.join(""),
      "</section>",
    ].join("");
  }

  function renderResults(data) {
    var groups = data.results && Array.isArray(data.results.groups) ? data.results.groups : [];
    var threads = data.results && Array.isArray(data.results.threads) ? data.results.threads : [];
    var users = data.results && Array.isArray(data.results.users) ? data.results.users : [];

    var hasAny = groups.length || threads.length || users.length;
    if (!hasAny) {
      panel.className = "sr-empty dg-surface-card";
      panel.innerHTML = [
        "<h2 class=\"sr-empty__title\">No results found</h2>",
        "<p class=\"sr-empty__hint\">Try a different search term or switch tabs.</p>",
      ].join("");
      return;
    }

    var groupsItems = groups.map(function (g) {
      var category = g.category && g.category.name ? g.category.name : "No category";
      return itemTemplate(g.name, g.description, category + " • " + (g.memberCount || 0) + " members");
    });
    var threadsItems = threads.map(function (t) {
      var author = t.author && t.author.username ? t.author.username : "Unknown author";
      var visibility = t.publishTo === "group" ? "Group thread" : "General thread";
      return itemTemplate(t.title, t.description, visibility + " • by " + author);
    });
    var usersItems = users.map(function (u) {
      var level = typeof u.level === "number" ? "Level " + u.level : "Member";
      return itemTemplate(u.username, u.bio || u.email, level);
    });

    panel.className = "dg-surface-card";
    panel.innerHTML = [
      '<div class="p-3">',
      sectionTemplate("Groups", groupsItems),
      sectionTemplate("Threads", threadsItems),
      sectionTemplate("Users", usersItems),
      "</div>",
    ].join("");
  }

  async function doSearch(term) {
    var query = String(term || "").trim();
    if (!query) {
      renderEmpty();
      return;
    }

    var token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      window.location.href = "/login.html";
      return;
    }

    activeRequest += 1;
    var requestId = activeRequest;
    renderLoading();

    try {
      var url = API_URL + "?q=" + encodeURIComponent(query) + "&scope=" + encodeURIComponent(currentScope) + "&limit=" + LIMIT;
      var response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: "Bearer " + token,
        },
      });

      var payload = await response.json().catch(function () {
        return {};
      });
      if (!response.ok) {
        throw new Error(payload.message || "Search request failed.");
      }

      if (requestId !== activeRequest) {
        return;
      }
      renderResults(payload);
    } catch (error) {
      if (requestId !== activeRequest) {
        return;
      }
      renderError(error.message);
    }
  }

  function triggerSearch() {
    if (debounceTimer) {
      window.clearTimeout(debounceTimer);
    }
    debounceTimer = window.setTimeout(function () {
      updateUrlState(input.value);
      doSearch(input.value);
    }, DEBOUNCE_MS);
  }

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      setActive(tab);
      triggerSearch();
    });
  });

  input.addEventListener("input", triggerSearch);

  var initialParams = new URLSearchParams(window.location.search);
  var initialScope = String(initialParams.get("scope") || "").toLowerCase().trim();
  var initialQuery = String(initialParams.get("q") || "").trim();
  var initialTab = Array.prototype.find.call(tabs, function (tab) {
    return scopeByTabId[tab.id] === initialScope;
  });
  if (initialTab) {
    setActive(initialTab);
  }
  if (initialQuery) {
    input.value = initialQuery;
    doSearch(initialQuery);
    return;
  }

  renderEmpty();
})();
