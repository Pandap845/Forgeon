(function () {
  var API_BASE = "/api/groups";
  var TOKEN_KEY = "forgeonAuthToken";

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  async function request(path, options) {
    var opts = options || {};
    var headers = opts.headers || {};
    var token = getToken();
    var isFormData = typeof FormData !== "undefined" && opts.body instanceof FormData;

    if (token) {
      headers.Authorization = "Bearer " + token;
    }

    if (opts.body && !isFormData && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    var response = await fetch(API_BASE + path, {
      method: opts.method || "GET",
      headers: headers,
      body: opts.body ? (isFormData ? opts.body : JSON.stringify(opts.body)) : undefined,
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

  // Creates a new group.
  async function create(payload) {
    return request("", { method: "POST", body: payload });
  }

  // Returns groups with optional filters (creator, createdBy).
  async function list(filters) {
    var f = filters || {};
    var qs = new URLSearchParams();
    if (f.creator) qs.set("creator", f.creator);
    if (f.createdBy) qs.set("createdBy", f.createdBy);
    var suffix = qs.toString() ? "?" + qs.toString() : "";
    return request(suffix);
  }

  // Returns one group by id.
  async function getById(id) {
    return request("/" + encodeURIComponent(id));
  }

  // Updates one group by id.
  async function update(id, payload) {
    return request("/" + encodeURIComponent(id), { method: "PATCH", body: payload });
  }

  // Deletes one group by id.
  async function remove(id) {
    return request("/" + encodeURIComponent(id), { method: "DELETE" });
  }

  window.ForgeonGroupsController = {
    create: create,
    list: list,
    getById: getById,
    update: update,
    remove: remove,
  };
})();
