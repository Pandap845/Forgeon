(function () {
  var pendingHref = null;
  var confirmWired = false;

  function wireConfirmOnce() {
    if (confirmWired) return;
    var btn = document.getElementById("logoutConfirmButton");
    if (!btn) return;
    confirmWired = true;
    btn.addEventListener("click", function () {
      if (pendingHref) window.location.href = pendingHref;
    });
  }

  function ensureLogoutStyles() {
    if (document.getElementById("nav-logout-styles")) return;
    var s = document.createElement("style");
    s.id = "nav-logout-styles";
    s.textContent =
      "#logoutConfirmModal .nav-logout-modal__title{margin:0 0 0.5rem;font-size:1.05rem;font-weight:700;letter-spacing:-0.02em;color:#f3f5f9;}" +
      "#logoutConfirmModal .nav-logout-modal__copy{margin:0;font-size:0.9rem;line-height:1.55;color:rgba(255,255,255,0.62);}" +
      "#logoutConfirmModal .nav-logout-modal__body{padding:1.25rem 1.35rem 1rem;}" +
      "#logoutConfirmModal .nav-logout-modal__footer{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:0.65rem;padding:0.9rem 1.25rem 1.15rem;margin:0;border-top:1px solid rgba(255,255,255,0.08);background:rgba(0,0,0,0.22);}" +
      "#logoutConfirmModal .btn.nav-logout-cancel-btn{margin:0;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(70,76,88,0.95);border-radius:10px;padding:0.55rem 1.15rem;background:rgba(52,56,64,0.92)!important;color:rgba(240,242,247,0.92)!important;font-size:0.82rem;font-weight:600;line-height:1.2;text-decoration:none!important;box-shadow:none!important;transition:background .15s ease,border-color .15s ease,color .15s ease;}" +
      "#logoutConfirmModal .btn.nav-logout-cancel-btn:hover{background:rgba(68,72,80,0.98)!important;border-color:rgba(95,100,112,1)!important;color:#fff!important;}" +
      "#logoutConfirmModal .btn.nav-logout-cancel-btn:focus-visible{outline:2px solid rgba(160,168,182,0.65);outline-offset:2px;}" +
      "#logoutConfirmModal .btn.nav-logout-confirm-btn{display:inline-flex;align-items:center;justify-content:center;margin:0;min-width:7.5rem;border:1px solid rgba(255,120,120,0.5);border-radius:10px;padding:0.55rem 1.15rem;background:#4f1313!important;color:#ffd8d8!important;font-size:0.82rem;font-weight:700;line-height:1.2;cursor:pointer;text-decoration:none!important;box-shadow:none!important;transition:background .15s ease,border-color .15s ease,color .15s ease;}" +
      "#logoutConfirmModal .btn.nav-logout-confirm-btn:hover{background:#631919!important;border-color:rgba(255,150,150,0.55);color:#fff!important;}" +
      "#logoutConfirmModal .btn.nav-logout-confirm-btn:focus-visible{outline:2px solid rgba(255,120,120,0.65);outline-offset:2px;}";
    document.head.appendChild(s);
  }

  function ensureModal() {
    if (document.getElementById("logoutConfirmModal")) {
      wireConfirmOnce();
      return;
    }
    ensureLogoutStyles();
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div class="modal fade" id="logoutConfirmModal" tabindex="-1" aria-labelledby="logoutConfirmModalLabel" aria-hidden="true">' +
        '<div class="modal-dialog modal-dialog-centered">' +
        '<div class="modal-content forgeon-modal">' +
        '<div class="modal-body nav-logout-modal__body">' +
        '<h2 class="h5 nav-logout-modal__title" id="logoutConfirmModalLabel">Log out?</h2>' +
        '<p class="nav-logout-modal__copy">Are you sure you want to end your session? You will need to sign in again to continue.</p>' +
        "</div>" +
        '<div class="modal-footer nav-logout-modal__footer">' +
        '<button type="button" class="btn nav-logout-cancel-btn" data-bs-dismiss="modal">Cancel</button>' +
        '<button type="button" class="btn nav-logout-confirm-btn" id="logoutConfirmButton">Log out</button>' +
        "</div>" +
        "</div></div></div>"
    );
    wireConfirmOnce();
  }

  document.body.addEventListener("click", function (e) {
    var a = e.target.closest("a.nav-logout-btn");
    if (!a) return;
    e.preventDefault();
    pendingHref = a.getAttribute("href");
    if (!pendingHref) pendingHref = "../Login_Register/login.html";

    ensureModal();
    var el = document.getElementById("logoutConfirmModal");
    if (!el || typeof bootstrap === "undefined" || !bootstrap.Modal) {
      window.location.href = pendingHref;
      return;
    }
    bootstrap.Modal.getOrCreateInstance(el).show();
  });
})();
