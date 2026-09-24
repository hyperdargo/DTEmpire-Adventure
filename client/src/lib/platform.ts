/**
 * Detect whether the client is currently running inside the standalone native
 * wrapper (Electron desktop or Android APK) rather than a standard web browser.
 */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const w = window as unknown as {
    electronApp?: { isElectron?: boolean; isNativeApp?: boolean };
    isNativeApp?: boolean;
  };
  return Boolean(
    w.electronApp?.isElectron ||
    w.electronApp?.isNativeApp ||
    w.isNativeApp ||
    ua.includes("DTEmpireAdventureNative") ||
    ua.includes("Electron")
  );
}
