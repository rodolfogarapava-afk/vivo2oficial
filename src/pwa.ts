// Guarded service worker registration.
// Never registers in dev / Lovable preview / iframes, and supports ?sw=off kill switch.

const SW_URL = "/sw.js";

let appRegistration: ServiceWorkerRegistration | undefined;
let activateWaitingWorker: ((reloadPage?: boolean) => Promise<void>) | undefined;

function isBlockedContext(): boolean {
  if (!import.meta.env.PROD) return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return true;
  return false;
}

async function unregisterAppServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    registrations
      .filter((r) => (r.active?.scriptURL || r.waiting?.scriptURL || r.installing?.scriptURL || "").endsWith(SW_URL))
      .map((r) => r.unregister()),
  );
}

export async function registerPWA() {
  if (!("serviceWorker" in navigator)) return;

  if (isBlockedContext()) {
    await unregisterAppServiceWorkers();
    return;
  }

  const { registerSW } = await import("virtual:pwa-register");

  const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      appRegistration = registration;
      // Check for a new version periodically and when the app regains focus.
      const check = () => registration.update().catch(() => {});
      setInterval(check, 60 * 1000);
      window.addEventListener("focus", check);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
    },
    onNeedRefresh() {
      // autoUpdate: apply immediately.
      updateSW(true);
    },
  });

  activateWaitingWorker = updateSW;

  // Reload once when the new service worker takes control.
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });
}

export async function checkForPWAUpdate() {
  if (isBlockedContext() || !("serviceWorker" in navigator)) return;

  const registration = appRegistration ?? await navigator.serviceWorker.getRegistration(SW_URL);
  if (!registration) return;

  appRegistration = registration;
  await registration.update();

  if (registration.waiting && activateWaitingWorker) {
    localStorage.setItem("app_refreshed_for_update", "true");
    await activateWaitingWorker(true);
  }
}
