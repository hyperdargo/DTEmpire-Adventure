import { useRegisterSW } from "virtual:pwa-register/react";
import { Button } from "./ui.tsx";

/** Offers the new version when the service worker has one ready, instead of reloading under the player. */
export function UpdatePrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (reg) setInterval(() => void reg.update(), 60 * 60 * 1000);
    },
  });
  if (!needRefresh) return null;
  return (
    <div className="update-prompt" role="status">
      <span>A new version of the realm is ready.</span>
      <Button size="sm" variant="primary" onClick={() => void updateServiceWorker(true)}>Update now</Button>
      <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>Later</Button>
    </div>
  );
}
