"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { GameProps } from "../../app/game/[gameId]/page";

// ─── Types ────────────────────────────────────────────────────────────────────

type FruitType = "watermelon" | "orange" | "strawberry" | "banana" | "grape" | "pineapple";
type ItemType = FruitType | "bomb";

interface Item {
  id: number;
  type: ItemType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  sliced: boolean;
  splashTimer: number;
  rotation: number;
  rotSpeed: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  radius: number;
}

interface SlashPt {
  x: number;
  y: number;
  t: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FRUIT_DATA: Record<FruitType, { emoji: string; color: string; splash: string }> = {
  watermelon: { emoji: "🍉", color: "#22c55e", splash: "#ef4444" },
  orange:     { emoji: "🍊", color: "#f97316", splash: "#fbbf24" },
  strawberry: { emoji: "🍓", color: "#f43f5e", splash: "#fda4af" },
  banana:     { emoji: "🍌", color: "#eab308", splash: "#fef08a" },
  grape:      { emoji: "🍇", color: "#a855f7", splash: "#c084fc" },
  pineapple:  { emoji: "🍍", color: "#ca8a04", splash: "#fde047" },
};

const FRUITS: FruitType[] = ["watermelon", "orange", "strawberry", "banana", "grape", "pineapple"];
const GRAVITY = 0.019;
const SLASH_TRAIL_MS = 200;
const SLASH_RADIUS = 4;

// ─── XP Claim Screen ──────────────────────────────────────────────────────────

function XPClaimScreen({ score, xpEarned, onClaim }: {
  score: number; xpEarned: number; onClaim: () => void;
}) {
  const [claimed, setClaimed] = useState(false);
  const [counting, setCounting] = useState(0);

  useEffect(() => {
    if (!claimed) return;
    let n = 0;
    const step = Math.ceil(xpEarned / 40);
    const iv = setInterval(() => {
      n = Math.min(n + step, xpEarned);
      setCounting(n);
      if (n >= xpEarned) clearInterval(iv);
    }, 30);
    return () => clearInterval(iv);
  }, [claimed, xpEarned]);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-6" style={{ background: "rgba(10,6,25,0.97)" }}>
      <div style={{ fontSize: 56 }}>🏆</div>
      <div className="text-center">
        <p className="font-mono-arc text-[9px] text-gray-500 uppercase tracking-[0.2em] mb-1">Final score</p>
        <p className="font-mono-arc text-5xl font-bold text-white tabular-nums">{score.toLocaleString()}</p>
      </div>
      <div className="w-full h-px" style={{ background: "rgba(167,139,250,0.15)" }} />
      {!claimed ? (
        <div className="text-center flex flex-col items-center gap-4">
          <p className="font-mono-arc text-[9px] text-violet-400 uppercase tracking-[0.2em]">XP earned this round</p>
          <div className="font-mono-arc text-3xl font-bold" style={{ color: "#a78bfa", textShadow: "0 0 20px rgba(167,139,250,0.5)" }}>
            +{xpEarned} XP
          </div>
          <button onClick={() => setClaimed(true)}
            className="font-mono-arc text-xs font-bold uppercase tracking-widest px-8 py-3 rounded-lg transition-all hover:opacity-90 active:scale-95"
            style={{ background: "linear-gradient(135deg,#7c3aed,#a78bfa)", color: "#fff", boxShadow: "0 0 24px rgba(167,139,250,0.3)" }}
          >
            Claim XP →
          </button>
        </div>
      ) : (
        <div className="text-center flex flex-col items-center gap-4">
          <p className="font-mono-arc text-[9px] text-violet-400 uppercase tracking-[0.2em]">XP claimed!</p>
          <div className="font-mono-arc text-4xl font-bold" style={{ color: "#4ade80", textShadow: "0 0 20px rgba(74,222,128,0.4)" }}>
            +{counting} XP ✓
          </div>
          <button onClick={onClaim}
            className="font-mono-arc text-[10px] uppercase tracking-widest px-6 py-2.5 rounded-lg transition-all hover:opacity-80"
            style={{ background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.12)", color: "#9ca3af" }}
          >
            Back to lobby →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Game ────────────────────────────────────────────────────────────────

export default function FruitBlitzGame({ gameConfig, onGameComplete }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const loopAlive = useRef(false);
  const gameOverLock = useRef(false);

  // All mutable game state lives in a ref to avoid stale-closure issues
  const g = useRef({
    items: [] as Item[],
    particles: [] as Particle[],
    slashPts: [] as SlashPt[],
    score: 0,
    lives: 3,
    combo: 0,
    comboTimer: 0,
    frame: 0,
    spawnTimer: 0,
    spawnInterval: 110,
    nextId: 0,
    isSlashing: false,
    isGameOver: false,
  });

  const [displayScore, setDisplayScore] = useState(0);
  const [displayLives, setDisplayLives] = useState(3);
  const [displayCombo, setDisplayCombo] = useState(0);
  const [phase, setPhase] = useState<"countdown" | "playing" | "results">("countdown");
  const [countdown, setCountdown] = useState(3);
  const [finalScore, setFinalScore] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);

  // ── Spawn helpers ────────────────────────────────────────────────────────

  const spawnItem = useCallback(() => {
    const s = g.current;
    if (s.isGameOver) return;
    const isBomb = Math.random() < 0.10 + s.frame * 0.000015;
    const type: ItemType = isBomb ? "bomb" : FRUITS[Math.floor(Math.random() * FRUITS.length)];
    s.items.push({
      id: s.nextId++,
      type,
      x: 12 + Math.random() * 76,
      y: 108,
      vx: (Math.random() - 0.5) * 0.7,
      vy: -(1.4 + Math.random() * 1.0 + s.frame * 0.0003),
      radius: type === "bomb" ? 26 : 24 + Math.random() * 8,
      sliced: false,
      splashTimer: 0,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.04,
    });
  }, []);

  const spawnParticles = useCallback((x: number, y: number, color: string, count = 10) => {
    const s = g.current;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const spd = 0.4 + Math.random() * 1.2;
      s.particles.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, color, life: 1, radius: 3 + Math.random() * 5 });
    }
  }, []);

  const endGame = useCallback((score: number) => {
    if (gameOverLock.current) return;
    gameOverLock.current = true;
    const s = g.current;
    s.isGameOver = true;
    loopAlive.current = false;
    const xp = Math.max(100, Math.floor((score / 100) * (gameConfig.base_xp ?? 75)));
    setFinalScore(score);
    setXpEarned(xp);
    setPhase("results");
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
  }, [gameConfig.base_xp]);

  // ── Countdown ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) { setPhase("playing"); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, phase]);

  // ── Main loop ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== "playing") {
      loopAlive.current = false;
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
      return;
    }

    if (loopAlive.current) return;
    loopAlive.current = true;
    gameOverLock.current = false;

    const canvas = canvasRef.current;
    if (!canvas) { loopAlive.current = false; return; }
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      const el = wrapperRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (!r || r.width === 0 || r.height === 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      canvas.style.width = `${r.width}px`;
      canvas.style.height = `${r.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // Reset state
    const s = g.current;
    s.items = []; s.particles = []; s.slashPts = [];
    s.score = 0; s.lives = 3; s.combo = 0; s.comboTimer = 0;
    s.frame = 0; s.spawnTimer = 0; s.spawnInterval = 110; s.isGameOver = false; s.isSlashing = false;
    setDisplayScore(0); setDisplayLives(3); setDisplayCombo(0);

    const loop = () => {
      if (!loopAlive.current || s.isGameOver) return;
      const el = wrapperRef.current;
      if (!el) { rafRef.current = requestAnimationFrame(loop); return; }
      const r = el.getBoundingClientRect();
      if (!r || r.width === 0 || r.height === 0) { rafRef.current = requestAnimationFrame(loop); return; }
      const W = r.width, H = r.height;

      s.frame++;
      s.spawnTimer++;
      s.comboTimer = Math.max(0, s.comboTimer - 1);
      if (s.comboTimer === 0 && s.combo > 0) { s.combo = 0; setDisplayCombo(0); }

      // Spawn
      if (s.spawnTimer >= s.spawnInterval) {
        spawnItem();
        if (s.frame > 300 && Math.random() < 0.25) spawnItem();
        s.spawnTimer = 0;
        s.spawnInterval = Math.max(45, 110 - s.frame * 0.04);
      }

      // Update items
      for (const item of s.items) {
        if (item.sliced) { item.splashTimer++; continue; }
        item.vy += GRAVITY; item.y += item.vy; item.x += item.vx; item.rotation += item.rotSpeed;
        if (item.y > 112 && !s.isGameOver) {
          item.sliced = true;
          if (item.type !== "bomb") {
            s.lives = Math.max(0, s.lives - 1);
            setDisplayLives(s.lives);
            s.combo = 0; setDisplayCombo(0);
            if (s.lives <= 0) { endGame(s.score); return; }
          }
        }
      }

      s.items = s.items.filter(i => !i.sliced || i.splashTimer < 28);
      s.particles = s.particles.filter(p => p.life > 0);
      for (const p of s.particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.life -= 0.022; }
      const now = performance.now();
      s.slashPts = s.slashPts.filter(pt => now - pt.t < SLASH_TRAIL_MS);

      // ── Draw ───────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, W, H);

      // BG
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#0c0818"); bg.addColorStop(1, "#180c2a");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      // Grid
      ctx.strokeStyle = "rgba(255,255,255,0.025)"; ctx.lineWidth = 1;
      for (let gx = 0; gx < W; gx += 60) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
      for (let gy = 0; gy < H; gy += 60) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

      // Items
      for (const item of s.items) {
        const cx = (item.x / 100) * W, cy = (item.y / 100) * H;

        if (item.sliced) {
          const alpha = Math.max(0, 1 - item.splashTimer / 24);
          ctx.save(); ctx.globalAlpha = alpha;

          if (item.type !== "bomb") {
            const fd = FRUIT_DATA[item.type as FruitType];
            ctx.beginPath();
            ctx.arc(cx, cy, item.splashTimer * 3.5, 0, Math.PI * 2);
            ctx.strokeStyle = fd.splash; ctx.lineWidth = 2.5; ctx.globalAlpha = alpha * 0.45;
            ctx.stroke();
            ctx.globalAlpha = alpha;
            ctx.save();
            ctx.translate(cx - item.splashTimer * 1.5, cy + item.splashTimer * 0.4);
            ctx.rotate(item.rotation + item.splashTimer * 0.06);
            ctx.font = `${Math.max(item.radius * 1.6, 30)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(fd.emoji, 0, 0);
            ctx.restore();
          } else {
            const xg = ctx.createRadialGradient(cx, cy, 0, cx, cy, item.splashTimer * 5.5);
            xg.addColorStop(0, "rgba(255,200,50,0.85)"); xg.addColorStop(0.4, "rgba(255,80,20,0.5)"); xg.addColorStop(1, "rgba(255,20,0,0)");
            ctx.beginPath(); ctx.arc(cx, cy, item.splashTimer * 5.5, 0, Math.PI * 2); ctx.fillStyle = xg; ctx.fill();
          }
          ctx.restore(); continue;
        }

        ctx.save(); ctx.translate(cx, cy); ctx.rotate(item.rotation);

        if (item.type === "bomb") {
          ctx.beginPath(); ctx.arc(0, 0, item.radius, 0, Math.PI * 2);
          const bg2 = ctx.createRadialGradient(-item.radius * 0.3, -item.radius * 0.3, 0, 0, 0, item.radius);
          bg2.addColorStop(0, "#444"); bg2.addColorStop(1, "#0a0a0a");
          ctx.fillStyle = bg2; ctx.fill();
          ctx.strokeStyle = "#555"; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, -item.radius); ctx.quadraticCurveTo(item.radius * 0.5, -item.radius * 1.5, item.radius * 0.2, -item.radius * 1.9);
          ctx.strokeStyle = "#7a5c0a"; ctx.lineWidth = 2; ctx.stroke();
          ctx.beginPath(); ctx.arc(item.radius * 0.2, -item.radius * 1.9, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = `hsl(${(s.frame * 18) % 60 + 15},100%,62%)`; ctx.fill();
          ctx.font = `${Math.max(item.radius * 1.2, 24)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText("💀", 0, 2);
        } else {
          const fd = FRUIT_DATA[item.type as FruitType];
          const glow = ctx.createRadialGradient(0, 0, item.radius * 0.4, 0, 0, item.radius + 8);
          glow.addColorStop(0, fd.color + "00"); glow.addColorStop(1, fd.color + "28");
          ctx.beginPath(); ctx.arc(0, 0, item.radius + 8, 0, Math.PI * 2); ctx.fillStyle = glow; ctx.fill();
          ctx.font = `${Math.max(item.radius * 2.2, 40)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
          ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(fd.emoji, 0, 0);
        }
        ctx.restore();
      }

      // Particles
      for (const p of s.particles) {
        ctx.save(); ctx.globalAlpha = p.life;
        ctx.beginPath(); ctx.arc((p.x / 100) * W, (p.y / 100) * H, p.radius * p.life, 0, Math.PI * 2);
        ctx.fillStyle = p.color; ctx.fill(); ctx.restore();
      }

      // Slash trail
      if (s.slashPts.length > 1) {
        ctx.save();
        for (let i = 1; i < s.slashPts.length; i++) {
          const prev = s.slashPts[i - 1], curr = s.slashPts[i];
          const age = (now - curr.t) / SLASH_TRAIL_MS;
          const a = Math.max(0, 1 - age);
          ctx.beginPath(); ctx.moveTo((prev.x / 100) * W, (prev.y / 100) * H);
          ctx.lineTo((curr.x / 100) * W, (curr.y / 100) * H);
          ctx.strokeStyle = `rgba(255,255,255,${a * 0.88})`;
          ctx.lineWidth = (1 - age) * 4 + 1; ctx.lineCap = "round";
          ctx.shadowColor = "#a78bfa"; ctx.shadowBlur = 10 * a; ctx.stroke();
        }
        ctx.restore();
      }

      // Only schedule next frame if still alive
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      loopAlive.current = false;
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
      window.removeEventListener("resize", resize);
    };
  }, [phase, spawnItem, spawnParticles, endGame]);

  // ── Input (unified PointerEvents only) ────────────────────────────────────

  const getPos = useCallback((e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 };
  }, []);

  const hitTest = useCallback((sx: number, sy: number, cx: number, cy: number, r: number, W: number, H: number) => {
    const dx = (sx / 100) * W - (cx / 100) * W;
    const dy = (sy / 100) * H - (cy / 100) * H;
    return Math.sqrt(dx * dx + dy * dy) < r + SLASH_RADIUS * (W / 100);
  }, []);

  const doSlash = useCallback((pos: { x: number; y: number }, W: number, H: number) => {
    const s = g.current;
    const now = performance.now();
    s.slashPts.push({ ...pos, t: now });

    for (const item of s.items) {
      if (item.sliced) continue;
      if (!hitTest(pos.x, pos.y, item.x, item.y, item.radius, W, H)) continue;
      item.sliced = true; item.splashTimer = 0;

      if (item.type === "bomb") {
        s.combo = 0; s.lives = Math.max(0, s.lives - 1);
        setDisplayLives(s.lives); setDisplayCombo(0);
        spawnParticles(item.x, item.y, "#ef4444", 14);
        if (s.lives <= 0) { endGame(s.score); return; }
      } else {
        s.combo++; s.comboTimer = 100;
        s.score += 10 * Math.max(1, s.combo);
        setDisplayScore(s.score); setDisplayCombo(s.combo);
        spawnParticles(item.x, item.y, FRUIT_DATA[item.type as FruitType].splash, 12);
      }
    }
  }, [hitTest, spawnParticles, endGame]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    if (phase !== "playing" || g.current.isGameOver) return;
    g.current.isSlashing = true;
    const pos = getPos(e);
    g.current.slashPts = [{ ...pos, t: performance.now() }];
  }, [phase, getPos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    if (phase !== "playing" || !g.current.isSlashing || g.current.isGameOver) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    doSlash(getPos(e), rect.width, rect.height);
  }, [phase, getPos, doSlash]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    g.current.isSlashing = false;
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="relative w-full flex items-center justify-center" style={{ height: "calc(100vh - 64px)" }}>
      <div ref={wrapperRef}
        className="relative overflow-hidden"
        style={{
          width: "min(420px, 100vw)", height: "min(680px, calc(100vh - 64px))",
          borderRadius: "12px", border: "0.5px solid rgba(255,255,255,0.08)",
          touchAction: "none",
        }}
      >
        <canvas ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          style={{ touchAction: "none", cursor: "crosshair" }}
        />

        {/* HUD */}
        {phase === "playing" && (
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 pointer-events-none"
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.65), transparent)" }}>
            <div>
              <p className="font-mono-arc text-[8px] text-gray-500 uppercase tracking-widest">Score</p>
              <p className="font-mono-arc text-xl font-bold text-white tabular-nums">{displayScore.toLocaleString()}</p>
            </div>
            <div className="flex gap-1">
              {[...Array(3)].map((_, i) => (
                <span key={i} className="text-lg" style={{ opacity: i < displayLives ? 1 : 0.15 }}>❤️</span>
              ))}
            </div>
          </div>
        )}

        {displayCombo >= 2 && phase === "playing" && (
          <div className="absolute top-16 left-0 right-0 flex justify-center pointer-events-none">
            <div key={displayCombo}
              className="font-mono-arc text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full"
              style={{ background: "rgba(251,191,36,0.15)", border: "0.5px solid rgba(251,191,36,0.4)", color: "#fbbf24", animation: "combo-pop 0.15s ease-out" }}
            >
              {displayCombo}x combo 🔥
            </div>
            <style>{`@keyframes combo-pop{from{transform:scale(1.35)}to{transform:scale(1)}}`}</style>
          </div>
        )}

        {phase === "countdown" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: "rgba(10,6,25,0.88)" }}>
            <p className="font-mono-arc text-[10px] text-violet-400 uppercase tracking-[0.22em] mb-3">Fruit Blitz</p>
            <p className="font-mono-arc text-[9px] text-gray-600 uppercase tracking-widest mb-10">Slash fruits · Dodge bombs</p>
            <div className="font-mono-arc font-bold text-white" style={{ fontSize: 80, lineHeight: 1, textShadow: "0 0 40px #a78bfa" }}>
              {countdown > 0 ? countdown : "GO!"}
            </div>
          </div>
        )}

        {phase === "results" && (
          <XPClaimScreen score={finalScore} xpEarned={xpEarned} onClaim={() => onGameComplete(finalScore)} />
        )}

        {phase === "playing" && g.current.frame < 160 && !g.current.isGameOver && (
          <div className="absolute bottom-5 left-0 right-0 flex justify-center pointer-events-none">
            <p className="font-mono-arc text-[9px] text-gray-700 uppercase tracking-widest">Swipe to slash fruits</p>
          </div>
        )}
      </div>
    </div>
  );
}
