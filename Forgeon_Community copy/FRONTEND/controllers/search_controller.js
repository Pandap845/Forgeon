(function () {
  var API_BASE = "/api/search";
  var TOKEN_KEY = "forgeonAuthToken";

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  async function search(params) {
    var token = getToken();
    var query = params || {};
    var qs = new URLSearchParams();

    if (query.q !== undefined) qs.set("q", query.q);
    if (query.scope !== undefined) qs.set("scope", query.scope);
    if (query.limit !== undefined) qs.set("limit", String(query.limit));

    var response = await fetch(API_BASE + "?" + qs.toString(), {
      method: "GET",
      headers: token ? { Authorization: "Bearer " + token } : {},
    });

    var data;
    try {
      data = await response.json();
    } catch (_error) {
      data = {};
    }

    if (!response.ok) {
      throw new Error(data.message || "Search request failed.");
    }

    return data;
  }

  window.ForgeonSearchController = {
    search: search,
  };
})();
