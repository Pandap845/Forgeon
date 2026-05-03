(function () {
  var API_BASE = "/api/friends";
  var TOKEN_KEY = "forgeonAuthToken";

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  async function request(path, options) {
    var opts = options || {};
    var headers = opts.headers || {};
    var token = getToken();

    if (token) {
      headers.Authorization = "Bearer " + token;
    }

    if (opts.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    var response = await fetch(API_BASE + path, {
      method: opts.method || "GET",
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });

    var data;
    try {
      data = await response.json();
    } catch (_error) {
      data = {};
    }

    if (!response.ok) {
      throw new Error(data.message || "Request failed.");
    }

    return data;
  }

  // Creates a new friendship.
  async function create(payload) {
    return request("", { method: "POST", body: payload });
  }

  // Returns friendships with optional userId filter.
  async function list(userId) {
    var query = userId ? "?userId=" + encodeURIComponent(userId) : "";
    return request(query);
  }

  // Returns one friendship by id.
  async function getById(id) {
    return request("/" + encodeURIComponent(id));
  }

  // Deletes one friendship by id.
  async function remove(id) {
    return request("/" + encodeURIComponent(id), { method: "DELETE" });
  }

  window.ForgeonFriendsController = {
    create: create,
    list: list,
    getById: getById,
    remove: remove,
  };
})();
