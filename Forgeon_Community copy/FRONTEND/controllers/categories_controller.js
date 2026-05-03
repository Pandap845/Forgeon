(function () {
  var API_BASE = "/api/categories";
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

  // Creates a new category.
  async function create(payload) {
    return request("", { method: "POST", body: payload });
  }

  // Returns all categories.
  async function list() {
    return request("");
  }

  // Returns one category by id.
  async function getById(id) {
    return request("/" + encodeURIComponent(id));
  }

  // Updates a category by id.
  async function update(id, payload) {
    return request("/" + encodeURIComponent(id), { method: "PATCH", body: payload });
  }

  // Deletes a category by id.
  async function remove(id) {
    return request("/" + encodeURIComponent(id), { method: "DELETE" });
  }

  window.ForgeonCategoriesController = {
    create: create,
    list: list,
    getById: getById,
    update: update,
    remove: remove,
  };
})();
