import { LoaderCircle, X } from "lucide-react";
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { duration, fmt, pct } from "../lib/format.ts";
import { play } from "../lib/sound.ts";

type BtnVariant = "primary" | "default" | "danger" | "ghost";

export function Button({
  variant = "default", size, block, loading, icon, children, className = "", onClick, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "lg"; block?: boolean; loading?: boolean; icon?: ReactNode }) {
  const cls = ["btn", variant !== "default" && `btn--${variant}`, size && `btn--${size}`, block && "btn--block", !children && "btn--icon", className].filter(Boolean).join(" ");
  return (
    <button
      type="button"
      className={cls}
      disabled={rest.disabled || loading}
      aria-busy={loading || undefined}
      onClick={(e) => {
        play("click");
        onClick?.(e);
      }}
      {...rest}
    >
      {loading ? <LoaderCircle size={18} className="spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

/** Counts smoothly to a new value instead of swapping digits. */
export function AnimatedNumber({ value, format = fmt }: { value: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(value);
  const [bumped, setBumped] = useState(false);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t0 = performance.now();
    const dur = reduce ? 0 : Math.min(900, 250 + Math.abs(value - start) * 2);
    let raf = 0;
    const step = (t: number) => {
      if (!reduce) setBumped(true);
      const k = dur === 0 ? 1 : Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(start + (value - start) * eased));
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    const off = setTimeout(() => setBumped(false), 450);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(off);
      from.current = value;
    };
  }, [value]);
  return <span className={`num${bumped ? " bump" : ""}`}>{format(shown)}</span>;
}

export function Coins({ value, compact }: { value: number; compact?: boolean }) {
  return (
    <span className="coins" aria-label={`${fmt(value)} coins`}>
      <span className="coin" aria-hidden />
      {compact ? fmt(value) : <AnimatedNumber value={value} />}
    </span>
  );
}

export function Bar({ value, max, kind = "hp", label, showNumbers, size }: { value: number; max: number; kind?: "hp" | "xp" | "ward"; label?: ReactNode; showNumbers?: boolean; size?: "lg" }) {
  const p = pct(value, max);
  // The pale "ghost" trails behind a drop so you can see how much a hit took.
  const [trail, setTrail] = useState(p);
  useEffect(() => {
    const t = setTimeout(() => setTrail(p), 650);
    return () => clearTimeout(t);
  }, [p]);
  const ghost = Math.max(p, trail);
  return (
    <div>
      {(label || showNumbers) && (
        <div className="bar-label">
          <span>{label}</span>
          {showNumbers && <b className="num">{fmt(value)} / {fmt(max)}</b>}
        </div>
      )}
      <div className={`bar bar--${kind}${size ? ` bar--${size}` : ""}`} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={typeof label === "string" ? label : kind.toUpperCase()}>
        <div className="bar__ghost" style={{ "--ghost": `${ghost}%` } as React.CSSProperties} />
        <div className="bar__fill" style={{ "--pct": `${p}%` } as React.CSSProperties} />
      </div>
    </div>
  );
}

export function PageHead({ title, children, actions }: { title: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {children && <p>{children}</p>}
      </div>
      {actions && <div className="page-head__actions">{actions}</div>}
    </header>
  );
}

export function Panel({ title, action, children, tight, className = "" }: { title?: ReactNode; action?: ReactNode; children: ReactNode; tight?: boolean; className?: string }) {
  return (
    <section className={`panel${tight ? " panel--tight" : ""} ${className}`}>
      {(title || action) && (
        <div className="panel__head">
          {typeof title === "string" ? <h2>{title}</h2> : title}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Tabs<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; badge?: number }[]; label: string }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" className="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
          {!!o.badge && <span className="badge">{o.badge}</span>}
        </button>
      ))}
    </div>
  );
}

export function Empty({ art, title, children, action }: { art: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="art" aria-hidden>{art}</span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="stack" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton" style={{ height: 72 }} />)}
    </div>
  );
}

export function Sheet({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="sheet"
      style={wide ? { width: "min(820px, 100vw)" } : undefined}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <>
          <div className="sheet__head">
            <h3>{title}</h3>
            <Button variant="ghost" onClick={onClose} aria-label="Close"><X size={20} /></Button>
          </div>
          <div className="sheet__body">{children}</div>
        </>
      )}
    </dialog>
  );
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function Countdown({ to, done = "Ready" }: { to: number; done?: string }) {
  const now = useNow();
  const left = to - now;
  return <span className="timer">{left <= 0 ? done : duration(left)}</span>;
}

export function Chip({ children, tone, className = "" }: { children: ReactNode; tone?: "gold" | "good" | "warn"; className?: string }) {
  return <span className={`chip${tone ? ` chip--${tone}` : ""} ${className}`}>{children}</span>;
}

export function RarityChip({ rarity }: { rarity: string }) {
  return <span className={`chip chip--rarity r-${rarity}`}>{rarity}</span>;
}
