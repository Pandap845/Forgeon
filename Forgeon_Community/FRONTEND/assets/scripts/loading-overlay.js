(function () {
  if (window.__forgeonLoadingOverlayBootstrapped) return;
  window.__forgeonLoadingOverlayBootstrapped = true;

  var OVERLAY_ID = "forgeonLoadingOverlay";
  var CONTAINER_ID = "forgeonLoadingAnimation";
  var activeRequests = 0;
  var overlayElement = null;
  var animationInstance = null;
  var animationPromise = null;
  var lottieRuntimePromise = null;
  var isHooked = false;

  // Injects the minimal styles for the loading overlay.
  function injectStyles() {
    if (document.getElementById("forgeonLoadingOverlayStyles")) return;
    var style = document.createElement("style");
    style.id = "forgeonLoadingOverlayStyles";
    style.textContent =
      "#" +
      OVERLAY_ID +
      "{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(8,10,18,.55);backdrop-filter:blur(2px);z-index:99999}" +
      "#" +
      OVERLAY_ID +
      ".is-visible{display:flex}" +
      "#" +
      CONTAINER_ID +
      "{width:180px;height:180px}";
    document.head.appendChild(style);
  }

  // Creates the overlay container in the page body.
  function ensureOverlay() {
    if (overlayElement && document.body.contains(overlayElement)) return overlayElement;
    overlayElement = document.getElementById(OVERLAY_ID);
    if (overlayElement) return overlayElement;

    overlayElement = document.createElement("div");
    overlayElement.id = OVERLAY_ID;
    overlayElement.setAttribute("aria-hidden", "true");
    overlayElement.innerHTML = '<div id="' + CONTAINER_ID + '"></div>';
    document.body.appendChild(overlayElement);
    return overlayElement;
  }

  // Loads Lottie runtime if it is not already available.
  function loadLottieRuntime() {
    if (window.lottie) return Promise.resolve(window.lottie);
    if (lottieRuntimePromise) return lottieRuntimePromise;
    lottieRuntimePromise = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.12.2/lottie.min.js";
      script.async = true;
      script.onload = function () {
        resolve(window.lottie || null);
      };
      script.onerror = function () {
        lottieRuntimePromise = null;
        reject(new Error("Could not load lottie runtime."));
      };
      document.head.appendChild(script);
    });
    return lottieRuntimePromise;
  }

  // Creates or reuses the loading animation instance.
  async function ensureAnimation() {
    if (animationInstance) return animationInstance;
    if (animationPromise) return animationPromise;

    animationPromise = (async function () {
      var lottie = await loadLottieRuntime();
      if (!lottie) return null;

      var container = document.getElementById(CONTAINER_ID);
      if (!container) return null;

      if (animationInstance) return animationInstance;
      animationInstance = lottie.loadAnimation({
        container: container,
        renderer: "svg",
        loop: true,
        autoplay: true,
        path: "/assets/loading.json",
      });
      return animationInstance;
    })().finally(function () {
      animationPromise = null;
    });

    return animationPromise;
  }

  // Shows the loading overlay while requests are in progress.
  async function showOverlay() {
    injectStyles();
    ensureOverlay();
    if (!overlayElement) return;

    overlayElement.classList.add("is-visible");
    try {
      await ensureAnimation();
    } catch (_error) {}
  }

  // Hides the loading overlay when no active requests remain.
  function hideOverlay() {
    if (!overlayElement) return;
    overlayElement.classList.remove("is-visible");
  }

  // Excludes static assets and non-API calls from loading overlay logic.
  function shouldTrackRequest(input) {
    var url = typeof input === "string" ? input : input && input.url ? input.url : "";
    if (!url) return false;
    if (url.indexOf("/assets/loading.json") !== -1) return false;
    return url.indexOf("/api/") !== -1;
  }

  // Wraps window.fetch globally to control loading visibility.
  function hookFetch() {
    if (isHooked || typeof window.fetch !== "function") return;
    isHooked = true;

    var originalFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      var track = shouldTrackRequest(input);
      if (track) {
        activeRequests += 1;
        showOverlay();
      }

      return originalFetch(input, init).finally(function () {
        if (!track) return;
        activeRequests = Math.max(0, activeRequests - 1);
        if (activeRequests === 0) {
          hideOverlay();
        }
      });
    };
  }

  // Boots loading overlay behavior when DOM is ready.
  function boot() {
    hookFetch();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
