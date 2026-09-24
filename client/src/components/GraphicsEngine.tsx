import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { useMe } from "../state/game.ts";
import type { HeroSnap } from "../lib/api.ts";

export type GraphicsQuality = "low" | "medium" | "high";

export const GRAPHICS_KEY = "dte_graphics_quality";
export const CRT_KEY = "dte_crt_filter";

export function getStoredGraphicsQuality(): GraphicsQuality {
  if (typeof window === "undefined") return "high";
  const stored = localStorage.getItem(GRAPHICS_KEY);
  if (stored === "low" || stored === "medium" || stored === "high") return stored;
  return "high";
}

export function setStoredGraphicsQuality(q: GraphicsQuality) {
  if (typeof window === "undefined") return;
  localStorage.setItem(GRAPHICS_KEY, q);
  document.documentElement.setAttribute("data-graphics", q);
  window.dispatchEvent(new CustomEvent("graphics_changed", { detail: q }));
}

export function getStoredCrtFilter(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(CRT_KEY) === "true";
}

export function setStoredCrtFilter(enabled: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CRT_KEY, enabled ? "true" : "false");
  document.documentElement.setAttribute("data-scanlines", enabled ? "true" : "false");
  window.dispatchEvent(new CustomEvent("crt_changed", { detail: enabled }));
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  maxAlpha: number;
  life: number;
  maxLife: number;
  color: string;
}

export function GraphicsEngine() {
  const { data } = useMe();
  const me = data as HeroSnap | undefined;
  const heroSetting = me?.hero?.settings?.graphicsQuality as GraphicsQuality | undefined;
  const crtSetting = me?.hero?.settings?.crtFilter;
  const [quality, setQuality] = useState<GraphicsQuality>(() => heroSetting ?? getStoredGraphicsQuality());
  const [crt, setCrt] = useState<boolean>(() => crtSetting ?? getStoredCrtFilter());
  const location = useLocation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sync state if hero settings change on server
  useEffect(() => {
    if (heroSetting && heroSetting !== quality) {
      setQuality(heroSetting);
      setStoredGraphicsQuality(heroSetting);
    }
  }, [heroSetting, quality]);

  useEffect(() => {
    if (crtSetting !== undefined && crtSetting !== crt) {
      setCrt(crtSetting);
      setStoredCrtFilter(crtSetting);
    }
  }, [crtSetting, crt]);

  // Apply data-attributes to document element
  useEffect(() => {
    document.documentElement.setAttribute("data-graphics", quality);
    document.documentElement.setAttribute("data-scanlines", crt ? "true" : "false");

    const onGraphics = (e: Event) => {
      const q = (e as CustomEvent<GraphicsQuality>).detail;
      setQuality(q);
    };
    const onCrt = (e: Event) => {
      const c = (e as CustomEvent<boolean>).detail;
      setCrt(c);
    };
    window.addEventListener("graphics_changed", onGraphics);
    window.addEventListener("crt_changed", onCrt);
    return () => {
      window.removeEventListener("graphics_changed", onGraphics);
      window.removeEventListener("crt_changed", onCrt);
    };
  }, [quality, crt]);

  // Particle & 2D dynamic lighting canvas animation
  useEffect(() => {
    if (quality === "low") return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);

    const path = location.pathname;
    const isSmithyOrTown = path.includes("smithy") || path.includes("town") || path.includes("estate");
    const isDungeon = path.includes("dungeon") || path.includes("tower") || path.includes("abyss");
    const isBattle = path.includes("battle") || path.includes("arena") || path.includes("raid");

    const maxParticles = quality === "high" ? 45 : 18;
    const particles: Particle[] = [];

    function spawnParticle(): Particle {
      const size = Math.random() * (quality === "high" ? 3.5 : 2.5) + 1;
      const maxLife = 80 + Math.random() * 120;
      let color = "rgba(217, 164, 65, "; // Default gold
      if (isSmithyOrTown) {
        // Hearth ember or bonfire sparks
        color = Math.random() > 0.4 ? "rgba(255, 122, 61, " : "rgba(243, 201, 109, ";
      } else if (isDungeon) {
        // Cyan magic pool reflections and dungeon motes
        color = Math.random() > 0.5 ? "rgba(90, 169, 255, " : "rgba(166, 108, 240, ";
      } else if (isBattle) {
        // Fiery combat sparks
        color = Math.random() > 0.5 ? "rgba(255, 90, 60, " : "rgba(255, 210, 80, ";
      }

      return {
        x: Math.random() * width,
        y: height + Math.random() * 20,
        vx: (Math.random() - 0.5) * 0.9,
        vy: -(Math.random() * 1.4 + 0.5),
        size,
        alpha: 0,
        maxAlpha: Math.random() * 0.7 + 0.2,
        life: 0,
        maxLife,
        color,
      };
    }

    for (let i = 0; i < maxParticles; i++) {
      const p = spawnParticle();
      p.y = Math.random() * height;
      p.life = Math.random() * p.maxLife;
      particles.push(p);
    }

    let frame = 0;
    const render = () => {
      frame++;
      ctx.clearRect(0, 0, width, height);

      // 1. Dynamic 2D Lighting Radial Shimmers (High Graphics Only)
      if (quality === "high") {
        const pulse = Math.sin(frame * 0.03) * 0.05 + 0.12;
        // Warm torch/hearth glow in upper center or bottom right
        const glowX = isSmithyOrTown ? width * 0.75 : isDungeon ? width * 0.25 : width * 0.5;
        const glowY = isSmithyOrTown ? height * 0.4 : isDungeon ? height * 0.6 : height * 0.3;
        const radius = Math.min(width, height) * 0.5;

        const radial = ctx.createRadialGradient(glowX, glowY, 10, glowX, glowY, radius);
        if (isDungeon) {
          radial.addColorStop(0, `rgba(90, 169, 255, ${pulse * 0.55})`);
          radial.addColorStop(0.6, `rgba(40, 20, 70, ${pulse * 0.2})`);
          radial.addColorStop(1, "rgba(0, 0, 0, 0)");
        } else {
          radial.addColorStop(0, `rgba(217, 164, 65, ${pulse * 0.6})`);
          radial.addColorStop(0.5, `rgba(255, 122, 61, ${pulse * 0.2})`);
          radial.addColorStop(1, "rgba(0, 0, 0, 0)");
        }
        ctx.fillStyle = radial;
        ctx.fillRect(0, 0, width, height);
      }

      // 2. Animated Ambient Atmosphere Particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]!;
        p.life++;
        p.x += p.vx + Math.sin((frame + p.life) * 0.02) * 0.4;
        p.y += p.vy;

        // Fade in and fade out
        if (p.life < p.maxLife * 0.2) {
          p.alpha = (p.life / (p.maxLife * 0.2)) * p.maxAlpha;
        } else if (p.life > p.maxLife * 0.7) {
          p.alpha = ((p.maxLife - p.life) / (p.maxLife * 0.3)) * p.maxAlpha;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${Math.max(0, p.alpha)})`;
        ctx.shadowBlur = quality === "high" ? 6 : 0;
        ctx.shadowColor = p.color + "0.8)";
        ctx.fill();

        if (p.life >= p.maxLife || p.y < -10) {
          particles[i] = spawnParticle();
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
    };
  }, [quality, location.pathname]);

  return (
    <>
      {quality !== "low" && (
        <canvas
          ref={canvasRef}
          className="realm-fx-canvas"
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            zIndex: 0,
            opacity: quality === "high" ? 1 : 0.6,
          }}
        />
      )}
      {crt && <div className="crt-scanline-overlay" aria-hidden="true" />}
    </>
  );
}
