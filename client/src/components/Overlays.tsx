import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useEffect } from "react";
import { useNotify } from "../state/notify.tsx";
import { Button, Coins } from "./ui.tsx";

export function Toasts() {
  const { toasts, dismiss } = useNotify();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.tone}`}>
          {t.art ? <span className="art" aria-hidden>{t.art}</span> : (
            <span className="toast__icon" aria-hidden>
              {t.tone === "bad" || t.tone === "warn" ? <AlertTriangle size={20} /> : t.tone === "good" ? <CheckCircle2 size={20} /> : <Info size={20} />}
            </span>
          )}
          <div>
            <b>{t.title}</b>
            {t.body && <p>{t.body}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={() => dismiss(t.id)} aria-label="Dismiss"><X size={16} /></Button>
        </div>
      ))}
    </div>
  );
}

export function Celebrations() {
  const { celebrations, dismissCelebration } = useNotify();
  const current = celebrations[0];
  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => dismissCelebration(current.id), 3800);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismissCelebration(current.id);
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [current, dismissCelebration]);
  if (!current) return null;
  return (
    <div className="celebrate" role="alertdialog" aria-live="assertive" aria-label="Celebration" onClick={() => dismissCelebration(current.id)}>
      <div className="celebrate__card">
        {current.kind === "levelUp" ? (
          <>
            <div className="celebrate__crest">{current.level}</div>
            <h2>Level up!</h2>
            <p>You reached level {current.level}. Your health is fully restored.</p>
          </>
        ) : (
          <>
            <div className="celebrate__crest"><span className="art">{current.icon}</span></div>
            <h2>{current.name}</h2>
            <p>Achievement unlocked. <Coins value={current.coins} compact /></p>
            {current.title && <p>New title: <b className="gold">“{current.title}”</b></p>}
          </>
        )}
        <span className="faint">Tap anywhere to continue</span>
      </div>
    </div>
  );
}
