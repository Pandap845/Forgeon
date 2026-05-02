(function () {
  var modal = document.getElementById("notificationsModal");
  var notificationsController = window.ForgeonNotificationController;
  if (!modal || !notificationsController) return;

  // Escapes HTML-sensitive characters.
  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Formats relative display time.
  function formatTime(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Just now";
    var seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
    if (seconds < 86400) return Math.floor(seconds / 3600) + "h ago";
    return Math.floor(seconds / 86400) + "d ago";
  }

  // Finds or creates the notifications render host inside modal.
  function getHost() {
    var body = modal.querySelector(".modal-body");
    if (!body) return null;

    var existingHost = body.querySelector("[data-forgeon-notifications-host]");
    if (existingHost) return existingHost;

    var placeholders = body.querySelectorAll(".forgeon-card");
    placeholders.forEach(function (el) {
      el.remove();
    });

    var host = document.createElement("div");
    host.setAttribute("data-forgeon-notifications-host", "true");
    body.appendChild(host);
    return host;
  }

  // Renders notification cards into modal.
  function renderItems(items) {
    var host = getHost();
    if (!host) return;

    if (!items.length) {
      host.innerHTML =
        '<div class="forgeon-card p-3"><div class="text-muted-2 small">No new invitations.</div></div>';
      return;
    }

    host.innerHTML = items
      .map(function (item) {
        return (
          '<div class="forgeon-card p-3 mb-2">' +
          '<div class="d-flex gap-3">' +
          '<div class="tv-notif-dot" aria-hidden="true"><i class="bi bi-bell"></i></div>' +
          '<div class="flex-grow-1">' +
          '<div class="fw-medium">' +
          escapeHtml(item.message) +
          "</div>" +
          '<div class="text-muted-3 small mt-2">' +
          escapeHtml(formatTime(item.createdAt)) +
          "</div>" +
          "</div>" +
          "</div>" +
          "</div>"
        );
      })
      .join("");
  }

  // Loads notifications and updates modal content.
  async function loadNotifications() {
    var host = getHost();
    if (!host) return;
    host.innerHTML = '<div class="forgeon-card p-3"><div class="text-muted-2 small">Loading notifications...</div></div>';

    try {
      var items = await notificationsController.listReceivedNotifications();
      renderItems(items);
    } catch (_error) {
      host.innerHTML =
        '<div class="forgeon-card p-3"><div class="text-muted-2 small">Could not load notifications.</div></div>';
    }
  }

  // Refreshes notifications each time modal opens.
  modal.addEventListener("show.bs.modal", loadNotifications);
})();
