export type DashboardMode = "basic" | "pro";

const DASHBOARD_MODE_KEY = "dashboard_view_mode";
const DASHBOARD_MODE_EVENT = "dashboard-mode-changed";

export function getDashboardMode(): DashboardMode {
  if (typeof window === "undefined") {
    return "basic";
  }

  return localStorage.getItem(DASHBOARD_MODE_KEY) === "pro" ? "pro" : "basic";
}

export function setDashboardMode(mode: DashboardMode) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(DASHBOARD_MODE_KEY, mode);
  window.dispatchEvent(new CustomEvent(DASHBOARD_MODE_EVENT, { detail: mode }));
}

export function subscribeDashboardMode(listener: (mode: DashboardMode) => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === DASHBOARD_MODE_KEY) {
      listener(getDashboardMode());
    }
  };

  const handleCustomEvent = (event: Event) => {
    const mode = (event as CustomEvent<DashboardMode>).detail;
    listener(mode === "pro" ? "pro" : "basic");
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(DASHBOARD_MODE_EVENT, handleCustomEvent);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(DASHBOARD_MODE_EVENT, handleCustomEvent);
  };
}
