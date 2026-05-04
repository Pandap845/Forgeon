(function () {
  var USER_KEY = "forgeonCurrentUser";
  var usernameField = document.getElementById("username");
  var deleteConfirmUsernameHint = document.getElementById("deleteConfirmUsernameHint");

  if (!usernameField && !deleteConfirmUsernameHint) return;

  if (window.ForgeonProfileViewUserId) return;

  var rawUser = localStorage.getItem(USER_KEY);
  if (!rawUser) return;

  var currentUser = null;
  try {
    currentUser = JSON.parse(rawUser);
  } catch (_error) {
    currentUser = null;
  }

  var username = currentUser && currentUser.username ? String(currentUser.username).trim() : "";
  if (!username) return;

  if (usernameField) {
    usernameField.value = username;
  }

  if (deleteConfirmUsernameHint) {
    deleteConfirmUsernameHint.textContent = username;
  }
})();
