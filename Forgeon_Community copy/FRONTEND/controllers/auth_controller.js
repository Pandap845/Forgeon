(function () {
  var API_BASE = "/api/users";
  var TOKEN_KEY = "forgeonAuthToken";
  var USER_KEY = "forgeonCurrentUser";

  function showError(message) {
    var err = document.getElementById("authError");
    if (!err) return;
    err.textContent = message;
    err.classList.add("is-visible");
  }

  function clearError() {
    var err = document.getElementById("authError");
    if (!err) return;
    err.textContent = "";
    err.classList.remove("is-visible");
  }

  function setButtonLoading(button, isLoading, loadingText, defaultText) {
    if (!button) return;
    button.disabled = isLoading;
    button.textContent = isLoading ? loadingText : defaultText;
  }

  async function parseResponse(response) {
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

  //Store data in Local Storage to persist session across page reloads
  function persistSession(data) {
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  }

  async function handleRegisterSubmit(event) {
    event.preventDefault();
    clearError();

    var form = event.target;
    var submitButton = form.querySelector('button[type="submit"]');
    var username = document.getElementById("username").value.trim();
    var email = document.getElementById("email").value.trim();
    var password = document.getElementById("password").value;
    var confirmPassword = document.getElementById("confirmPassword").value;
    var terms = document.getElementById("terms").checked;

    if (!form.checkValidity()) {
      showError("Please fill in all fields and accept the terms.");
      return;
    }

    if (!terms) {
      showError("You must agree to the Terms of Service and Privacy Policy.");
      return;
    }

    if (password !== confirmPassword) {
      showError("Passwords do not match.");
      return;
    }

    try {
      setButtonLoading(submitButton, true, "Creating account...", "Create Account");

      var response = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username,
          email: email,
          password: password,
        }),
      });

      var data = await parseResponse(response);
      persistSession(data);
      window.location.href = "/homepage.html";
    } catch (error) {
      showError(error.message || "Could not create account.");
    } finally {
      setButtonLoading(submitButton, false, "Creating account...", "Create Account");
    }
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    clearError();

    var form = event.target;
    var submitButton = form.querySelector('button[type="submit"]');
    var identifier = document.getElementById("identifier").value.trim();
    var password = document.getElementById("password").value;

    if (!identifier || !password) {
      showError("Please enter your email or username and password.");
      return;
    }

    var payload = { password: password };
    if (identifier.includes("@")) payload.email = identifier;
    else payload.username = identifier;

    try {
      setButtonLoading(submitButton, true, "Signing in...", "Sign In");

      var response = await fetch(API_BASE + "/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      var data = await parseResponse(response);
      persistSession(data);
      window.location.href = "/homepage.html";
    } catch (error) {
      showError(error.message || "Could not sign in.");
    } finally {
      setButtonLoading(submitButton, false, "Signing in...", "Sign In");
    }
  }

  var loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", handleLoginSubmit);
  }

  var registerForm = document.getElementById("registerForm");
  if (registerForm) {
    registerForm.addEventListener("submit", handleRegisterSubmit);
  }
})();
