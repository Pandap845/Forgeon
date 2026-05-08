(function () {
  var modal = document.getElementById("notificationsModal");
  var notificationsController = window.ForgeonNotificationController;
  var notificationButtons = Array.from(
    document.querySelectorAll('button[aria-label="Notifications"][data-bs-target="#notificationsModal"]')
  );
  if (!modal || !notificationsController || !notificationButtons.length) return;

  // Adds a visual unread count badge to each header notification trigger.
  function ensureBadge(button) {
    button.classList.add("forgeon-notif-btn");
    var badge = button.querySelector(".forgeon-notif-badge");
    if (badge) return badge;
    badge = document.createElement("span");
    badge.className = "forgeon-notif-badge is-hidden";
    badge.setAttribute("aria-hidden", "true");
    button.appendChild(badge);
    return badge;
  }

  var badgeEls = notificationButtons.map(ensureBadge);
  var currentTab = "unread";
  var cachedItems = [];
  var itemById = {};

  function setUnreadBadgeCount(count) {
    var safeCount = Number(count) || 0;
    var text = safeCount > 99 ? "99+" : String(safeCount);
    badgeEls.forEach(function (badge) {
      if (!badge) return;
      if (safeCount <= 0) {
        badge.classList.add("is-hidden");
        badge.textContent = "";
        return;
      }
      badge.classList.remove("is-hidden");
      badge.textContent = text;
    });
  }

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

  function normalizeTab(tab) {
    return tab === "read" ? "read" : "unread";
  }

  function buildTabs(unreadCount, readCount) {
    return (
      '<div class="forgeon-notif-toolbar mb-3">' +
      '<div class="forgeon-notif-tabs-wrap">' +
      '<button type="button" class="forgeon-notif-tab' +
      (currentTab === "unread" ? " is-active" : "") +
      '" data-notif-tab="unread"><i class="bi bi-envelope-fill" aria-hidden="true"></i><span>Unread</span><span class="forgeon-notif-tab-count">' +
      unreadCount +
      "</span></button>" +
      '<button type="button" class="forgeon-notif-tab' +
      (currentTab === "read" ? " is-active" : "") +
      '" data-notif-tab="read"><i class="bi bi-check2-circle" aria-hidden="true"></i><span>Read</span><span class="forgeon-notif-tab-count">' +
      readCount +
      "</span></button>" +
      "</div>" +
      '<button type="button" class="forgeon-mark-read-btn" data-action="mark-all-read"' +
      (unreadCount <= 0 ? " disabled" : "") +
      ">Mark all as read</button>" +
      "</div>"
    );
  }

  function buildCard(item) {
    var id = item && item.id ? String(item.id) : "";
    var href = item && item.sourceHref ? String(item.sourceHref) : "#";
    var message = item && item.message ? item.message : "Notification";
    var sourceLabel = item && item.sourceLabel ? item.sourceLabel : "Open";
    var cardClass = item && item.seen ? "forgeon-notif-item is-read" : "forgeon-notif-item is-unread";

    return (
      '<a class="' +
      cardClass +
      '" href="' +
      escapeHtml(href) +
      '" data-action="open-notification" data-notification-id="' +
      escapeHtml(id) +
      '">' +
      '<div class="forgeon-card p-3 mb-2">' +
      '<div class="d-flex gap-3">' +
      '<div class="tv-notif-dot" aria-hidden="true"><i class="bi bi-bell"></i></div>' +
      '<div class="flex-grow-1">' +
      '<div class="fw-medium">' +
      escapeHtml(message) +
      "</div>" +
      '<div class="text-muted-2 small mt-1">' +
      escapeHtml(sourceLabel) +
      "</div>" +
      '<div class="text-muted-3 small mt-2">' +
      escapeHtml(formatTime(item.createdAt)) +
      "</div>" +
      "</div>" +
      "</div>" +
      "</div>" +
      "</a>"
    );
  }

  // Renders notification cards into modal.
  function renderItems(items) {
    var host = getHost();
    if (!host) return;

    cachedItems = Array.isArray(items) ? items.slice() : [];
    itemById = {};
    cachedItems.forEach(function (item) {
      if (!item || !item.id) return;
      itemById[String(item.id)] = item;
    });

    var unreadItems = cachedItems.filter(function (item) {
      return item && !item.seen;
    });
    var readItems = cachedItems.filter(function (item) {
      return item && item.seen;
    });
    var visibleItems = currentTab === "read" ? readItems : unreadItems;
    var emptyText = currentTab === "read" ? "No read notifications yet." : "No unread notifications.";

    host.innerHTML =
      buildTabs(unreadItems.length, readItems.length) +
      (visibleItems.length
        ? visibleItems.map(buildCard).join("")
        : '<div class="forgeon-card p-3"><div class="text-muted-2 small">' + emptyText + "</div></div>");
  }

  // Loads notifications and updates modal content.
  async function loadNotifications() {
    var host = getHost();
    if (!host) return;
    host.innerHTML = '<div class="forgeon-card p-3"><div class="text-muted-2 small">Loading notifications...</div></div>';

    try {
      var items = await notificationsController.listReceivedNotifications({ status: "all" });
      renderItems(items);
      setUnreadBadgeCount(
        Array.isArray(items)
          ? items.filter(function (item) {
            return item && !item.seen;
          }).length
          : 0
      );
    } catch (_error) {
      host.innerHTML =
        '<div class="forgeon-card p-3"><div class="text-muted-2 small">Could not load notifications.</div></div>';
    }
  }

  // Loads unseen notifications count for header badge.
  async function refreshUnreadCount() {
    try {
      var unseenItems = await notificationsController.listReceivedNotifications({ status: "unread" });
      setUnreadBadgeCount(Array.isArray(unseenItems) ? unseenItems.length : 0);
    } catch (_error) {
      setUnreadBadgeCount(0);
    }
  }

  async function handleOpenNotification(link) {
    var id = link && link.getAttribute("data-notification-id");
    if (!id || !notificationsController || typeof notificationsController.markAsSeen !== "function") return;
    var item = itemById[String(id)];
    if (!item || item.seen) return;
    notificationsController.markAsSeen([item]);
    item.seen = true;
    renderItems(cachedItems);
    setUnreadBadgeCount(
      cachedItems.filter(function (row) {
        return row && !row.seen;
      }).length
    );
  }

  function markAllAsRead() {
    if (!notificationsController || typeof notificationsController.markAsSeen !== "function") return;
    var unreadItems = cachedItems.filter(function (row) {
      return row && !row.seen;
    });
    if (!unreadItems.length) return;
    notificationsController.markAsSeen(unreadItems);
    unreadItems.forEach(function (item) {
      item.seen = true;
    });
    renderItems(cachedItems);
    setUnreadBadgeCount(0);
  }

  // Refreshes notifications each time modal opens.
  modal.addEventListener("show.bs.modal", loadNotifications);
  modal.addEventListener("click", function (event) {
    var tabButton = event.target.closest("[data-notif-tab]");
    if (tabButton) {
      event.preventDefault();
      currentTab = normalizeTab(tabButton.getAttribute("data-notif-tab"));
      renderItems(cachedItems);
      return;
    }

    var markAllButton = event.target.closest("[data-action='mark-all-read']");
    if (markAllButton) {
      event.preventDefault();
      markAllAsRead();
      return;
    }

    var notifLink = event.target.closest("[data-action='open-notification'][data-notification-id]");
    if (!notifLink) return;
    handleOpenNotification(notifLink);
  });
  window.addEventListener("pageshow", refreshUnreadCount);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") refreshUnreadCount();
  });
  refreshUnreadCount();
})();