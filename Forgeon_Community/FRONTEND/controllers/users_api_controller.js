(function () {
  var API_BASE = "/api/users";
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

  // Registers a new user.
  async function create(payload) {
    return request("", { method: "POST", body: payload });
  }

  // Authenticates a user with email/username and password.
  async function login(payload) {
    return request("/login", { method: "POST", body: payload });
  }

  // Ends the current session in backend.
  async function logout() {
    return request("/logout", { method: "POST" });
  }

  // Returns all users (protected endpoint).
  async function list() {
    return request("");
  }

  // Returns one user by id (protected endpoint).
  async function getById(id) {
    return request("/" + encodeURIComponent(id));
  }

  // Updates one user by id (protected endpoint).
  async function update(id, payload) {
    return request("/" + encodeURIComponent(id), { method: "PATCH", body: payload });
  }

  // Deletes one user by id (protected endpoint).
  async function remove(id) {
    return request("/" + encodeURIComponent(id), { method: "DELETE" });
  }

  // Upload profile picture; saves copy under BACKEND/uploads/profile-pictures.
  async function uploadAvatar(file) {
    var token = getToken();
    var formData = new FormData();
    formData.append("avatar", file);
    var headers = {};
    if (token) headers.Authorization = "Bearer " + token;

    var response = await fetch(API_BASE + "/avatar", {
      method: "POST",
      headers: headers,
      body: formData,
    });

    var data;
    try {
      data = await response.json();
    } catch (_error) {
      data = {};
    }

    if (!response.ok) {
      throw new Error(data.message || "Upload failed.");
    }

    return data;
  }

  window.ForgeonUsersController = {
    create: create,
    login: login,
    logout: logout,
    list: list,
    getById: getById,
    update: update,
    remove: remove,
    uploadAvatar: uploadAvatar,
  };
})();
