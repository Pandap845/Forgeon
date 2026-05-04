(function () {
  var API_BASE = "/api/group-memberships";
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

  // Creates a new group membership.
  async function create(payload) {
    return request("", { method: "POST", body: payload });
  }

  // Returns memberships with optional group and user filters.
  async function list(filters) {
    var f = filters || {};
    var qs = new URLSearchParams();
    if (f.group) qs.set("group", f.group);
    if (f.user) qs.set("user", f.user);
    var suffix = qs.toString() ? "?" + qs.toString() : "";
    return request(suffix);
  }

  // Returns one membership by id.
  async function getById(id) {
    return request("/" + encodeURIComponent(id));
  }

  // Updates one membership by id.
  async function update(id, payload) {
    return request("/" + encodeURIComponent(id), { method: "PATCH", body: payload });
  }

  // Deletes one membership by id.
  async function remove(id) {
    return request("/" + encodeURIComponent(id), { method: "DELETE" });
  }

  window.ForgeonGroupMembershipsController = {
    create: create,
    list: list,
    getById: getById,
    update: update,
    remove: remove,
  };
})();
