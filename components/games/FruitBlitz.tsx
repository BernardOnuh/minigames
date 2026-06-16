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
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  radius: number;
}

interface SlashPoint {
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
// Slower gravity & velocity
const GRAVITY = 0.018;
const SLASH_TRAIL_DURATION = 200;
const SLASH_RADIUS = 4;

// ─── XP Claim Screen ──────────────────────────────────────────────────────────

function XPClaimScreen({
  score,
  xpEarned,
  onClaim,
}: {
  score: number;
  xpEarned: number;
  onClaim: () => void;
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
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-6"
      style={{ background: "rgba(10,6,25,0.97)" }}
    >
      {/* Trophy */}
      <div style={{ fontSize: 56 }}>🏆</div>

      {/* Score */}
      <div className="text-center">
        <p className="font-mono-arc text-[9px] text-gray-500 uppercase tracking-[0.2em] mb-1">Final score</p>
        <p className="font-mono-arc text-5xl font-bold text-white tabular-nums">{score.toLocaleString()}</p>
      </div>

      {/* Divider */}
      <div className="w-full h-px" style={{ background: "rgba(167,139,250,0.15)" }} />

      {/* XP section */}
      {!claimed ? (
        <div className="text-center flex flex-col items-center gap-4">
          <p className="font-mono-arc text-[9px] text-violet-400 uppercase tracking-[0.2em]">XP earned this round</p>
          <div
            className="font-mono-arc text-3xl font-bold"
            style={{ color: "#a78bfa", textShadow: "0 0 20px rgba(167,139,250,0.5)" }}
          >
            +{xpEarned} XP
          </div>
          <button
            onClick={() => { setClaimed(true); }}
            className="font-mono-arc text-xs font-bold uppercase tracking-widest px-8 py-3 rounded-lg transition-all hover:opacity-90 active:scale-95"
            style={{
              background: "linear-gradient(135deg,#7c3aed,#a78bfa)",
              color: "#fff",
              boxShadow: "0 0 24px rgba(167,139,250,0.3)",
            }}
          >
            Claim XP →
          </button>
        </div>
      ) : (
        <div className="text-center flex flex-col items-center gap-4">
          <p className="font-mono-arc text-[9px] text-violet-400 uppercase tracking-[0.2em]">XP claimed!</p>
          <div
            className="font-mono-arc text-4xl font-bold"
            style={{ color: "#4ade80", textShadow: "0 0 20px rgba(74,222,128,0.4)" }}
          >
            +{counting} XP ✓
          </div>
          <button
            onClick={onClaim}
            className="font-mono-arc text-[10px] uppercase tracking-widest px-6 py-2.5 rounded-lg transition-all hover:opacity-80"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "0.5px solid rgba(255,255,255,0.12)",
              color: "#9ca3af",
            }}
          >
            Back to lobby →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Game ────────────────────────────────────────────────────────────────

export default function FruitBlitzGame({
  gameConfig,
  onGameComplete,
  onGameFail,
  shortAddress,
}: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // All mutable game state lives here — never causes re-renders
  const stateRef = useRef({
    items: [] as Item[],
    particles: [] as Particle[],
    slashPoints: [] as SlashPoint[],
    score: 0,
    lives: 3,
    combo: 0,
    comboTimer: 0,
    frame: 0,
    spawnTimer: 0,
    spawnInterval: 110,   // frames between spawns (slower start)
    nextId: 0,
    phase: "playing" as "playing" | "dead",
    isSlashing: false,
  });

  const rafRef = useRef<number>(0);
  const isRunningRef = useRef(false); // prevents double-loop on StrictMode

  const [displayScore, setDisplayScore] = useState(0);
  const [displayLives, setDisplayLives] = useState(3);
  const [displayCombo, setDisplayCombo] = useState(0);
  const [gamePhase, setGamePhase] = useState<"countdown" | "playing" | "dead" | "results">("countdown");
  const [countdown, setCountdown] = useState(3);
  const [finalScore, setFinalScore] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const spawnItem = useCallback(() => {
    const s = stateRef.current;
    const isBomb = Math.random() < 0.10 + s.frame * 0.000015;
    const type: ItemType = isBomb ? "bomb" : FRUITS[Math.floor(Math.random() * FRUITS.length)];
    const x = 12 + Math.random() * 76;
    // Slower launch speed, gentler scaling
    const vy = -(1.4 + Math.random() * 1.0 + s.frame * 0.0003);
    const vx = (Math.random() - 0.5) * 0.7;
    s.items.push({
      id: s.nextId++,
      type,
      x,
      y: 108,
      vx,
      vy,
      radius: type === "bomb" ? 26 : 24 + Math.random() * 8,
      sliced: false,
      splashTimer: 0,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.04,
    });
  }, []);

  const spawnParticles = useCallback((x: number, y: number, color: string, count = 10) => {
    const s = stateRef.current;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 0.4 + Math.random() * 1.2;
      s.particles.push({
        id: s.nextId++,
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        life: 1,
        radius: 3 + Math.random() * 5,
      });
    }
  }, []);

  const hitTest = useCallback(
    (sx: number, sy: number, cx: number, cy: number, r: number, W: number, H: number) => {
      const dx = (sx / 100) * W - (cx / 100) * W;
      const dy = (sy / 100) * H - (cy / 100) * H;
      return Math.sqrt(dx * dx + dy * dy) < r + SLASH_RADIUS * (W / 100);
    },
    []
  );

  const killGame = useCallback((score: number) => {
    const xp = Math.max(10, Math.floor((score / 1000) * (gameConfig.base_xp ?? 75)));
    setFinalScore(score);
    setXpEarned(xp);
    setGamePhase("results");
  }, [gameConfig.base_xp]);

  // ── Countdown ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (gamePhase !== "countdown") return;
    if (countdown <= 0) { setGamePhase("playing"); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, gamePhase]);

  // ── Main loop — starts when gamePhase = "playing" ─────────────────────────

  useEffect(() => {
    if (gamePhase !== "playing") return;
    if (isRunningRef.current) return; // guard against StrictMode double-mount
    isRunningRef.current = true;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Reset state cleanly
    const s = stateRef.current;
    s.items = [];
    s.particles = [];
    s.slashPoints = [];
    s.score = 0;
    s.lives = 3;
    s.combo = 0;
    s.comboTimer = 0;
    s.frame = 0;
    s.spawnTimer = 0;
    s.spawnInterval = 110;
    s.phase = "playing";

    let dead = false; // local flag so loop stops synchronously

    const loop = () => {
      if (dead) return;

      const W = canvas.width;
      const H = canvas.height;
      s.frame++;
      s.spawnTimer++;
      s.comboTimer = Math.max(0, s.comboTimer - 1);
      if (s.comboTimer === 0 && s.combo > 0) {
        s.combo = 0;
        setDisplayCombo(0);
      }

      // Spawn fruit
      if (s.spawnTimer >= s.spawnInterval) {
        spawnItem();
        // Randomly spawn 2 at once sometimes (later in game)
        if (s.frame > 300 && Math.random() < 0.25) spawnItem();
        s.spawnTimer = 0;
        s.spawnInterval = Math.max(45, 110 - s.frame * 0.04);
      }

      // Update items
      for (const item of s.items) {
        if (item.sliced) { item.splashTimer++; continue; }
        item.vy += GRAVITY;
        item.y += item.vy;
        item.x += item.vx;
        item.rotation += item.rotSpeed;

        if (item.y > 112 && !item.sliced) {
          item.sliced = true;
          if (item.type !== "bomb") {
            s.lives = Math.max(0, s.lives - 1);
            s.combo = 0;
            setDisplayLives(s.lives);
            setDisplayCombo(0);
            if (s.lives <= 0 && !dead) {
              dead = true;
              killGame(s.score);
            }
          }
        }
      }

      s.items = s.items.filter((i) => !i.sliced || i.splashTimer < 28);
      s.particles = s.particles.filter((p) => p.life > 0);

      for (const p of s.particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.06;
        p.life -= 0.022;
      }

      const now = performance.now();
      s.slashPoints = s.slashPoints.filter((pt) => now - pt.t < SLASH_TRAIL_DURATION);

      // ── Draw ───────────────────────────────────────────────────────────────

      ctx.clearRect(0, 0, W, H);

      // BG
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#0c0818");
      bg.addColorStop(1, "#180c2a");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Grid
      ctx.strokeStyle = "rgba(255,255,255,0.018)";
      ctx.lineWidth = 1;
      for (let gx = 0; gx < W; gx += 60) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
      }
      for (let gy = 0; gy < H; gy += 60) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
      }

      // Items
      for (const item of s.items) {
        const cx = (item.x / 100) * W;
        const cy = (item.y / 100) * H;

        if (item.sliced) {
          const alpha = Math.max(0, 1 - item.splashTimer / 24);
          ctx.save();
          ctx.globalAlpha = alpha;
          if (item.type !== "bomb") {
            const fd = FRUIT_DATA[item.type as FruitType];
            // Splash ring
            ctx.beginPath();
            ctx.arc(cx, cy, item.splashTimer * 3.5, 0, Math.PI * 2);
            ctx.strokeStyle = fd.splash;
            ctx.lineWidth = 2.5;
            ctx.globalAlpha = alpha * 0.45;
            ctx.stroke();
            // Flying half
            ctx.globalAlpha = alpha;
            ctx.save();
            ctx.translate(cx - item.splashTimer * 1.5, cy + item.splashTimer * 0.4);
            ctx.rotate(item.rotation + item.splashTimer * 0.06);
            ctx.font = `${item.radius * 1.3}px serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(fd.emoji, 0, 0);
            ctx.restore();
          } else {
            const xg = ctx.createRadialGradient(cx, cy, 0, cx, cy, item.splashTimer * 5.5);
            xg.addColorStop(0, "rgba(255,200,50,0.85)");
            xg.addColorStop(0.4, "rgba(255,80,20,0.5)");
            xg.addColorStop(1, "rgba(255,20,0,0)");
            ctx.beginPath();
            ctx.arc(cx, cy, item.splashTimer * 5.5, 0, Math.PI * 2);
            ctx.fillStyle = xg;
            ctx.fill();
          }
          ctx.restore();
          continue;
        }

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(item.rotation);

        if (item.type === "bomb") {
          ctx.beginPath();
          ctx.arc(0, 0, item.radius, 0, Math.PI * 2);
          const bg2 = ctx.createRadialGradient(-item.radius * 0.3, -item.radius * 0.3, 0, 0, 0, item.radius);
          bg2.addColorStop(0, "#444");
          bg2.addColorStop(1, "#0a0a0a");
          ctx.fillStyle = bg2;
          ctx.fill();
          ctx.strokeStyle = "#555";
          ctx.lineWidth = 1.5;
          ctx.stroke();
          // Fuse
          ctx.beginPath();
          ctx.moveTo(0, -item.radius);
          ctx.quadraticCurveTo(item.radius * 0.5, -item.radius * 1.5, item.radius * 0.2, -item.radius * 1.9);
          ctx.strokeStyle = "#7a5c0a";
          ctx.lineWidth = 2;
          ctx.stroke();
          // Flicker spark
          ctx.beginPath();
          ctx.arc(item.radius * 0.2, -item.radius * 1.9, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = `hsl(${(s.frame * 18) % 60 + 15},100%,62%)`;
          ctx.fill();
          ctx.font = `${item.radius * 0.85}px serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("💀", 0, 2);
        } else {
          const fd = FRUIT_DATA[item.type as FruitType];
          // Soft glow
          const glow = ctx.createRadialGradient(0, 0, item.radius * 0.4, 0, 0, item.radius + 8);
          glow.addColorStop(0, fd.color + "00");
          glow.addColorStop(1, fd.color + "28");
          ctx.beginPath();
          ctx.arc(0, 0, item.radius + 8, 0, Math.PI * 2);
          ctx.fillStyle = glow;
          ctx.fill();
          ctx.font = `${item.radius * 1.65}px serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(fd.emoji, 0, 0);
        }

        ctx.restore();
      }

      // Particles
      for (const p of s.particles) {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc((p.x / 100) * W, (p.y / 100) * H, p.radius * p.life, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.restore();
      }

      // Slash trail
      if (s.slashPoints.length > 1) {
        ctx.save();
        for (let i = 1; i < s.slashPoints.length; i++) {
          const prev = s.slashPoints[i - 1];
          const curr = s.slashPoints[i];
          const age = (now - curr.t) / SLASH_TRAIL_DURATION;
          const a = Math.max(0, 1 - age);
          ctx.beginPath();
          ctx.moveTo((prev.x / 100) * W, (prev.y / 100) * H);
          ctx.lineTo((curr.x / 100) * W, (curr.y / 100) * H);
          ctx.strokeStyle = `rgba(255,255,255,${a * 0.88})`;
          ctx.lineWidth = (1 - age) * 4 + 1;
          ctx.lineCap = "round";
          ctx.shadowColor = "#a78bfa";
          ctx.shadowBlur = 10 * a;
          ctx.stroke();
        }
        ctx.restore();
      }

      if (!dead) rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      isRunningRef.current = false;
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamePhase]);

  // ── Pointer handlers ─────────────────────────────────────────────────────────

  const getPos = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  };

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (gamePhase !== "playing") return;
    const s = stateRef.current;
    s.isSlashing = true;
    const pos = getPos(e);
    s.slashPoints = [{ ...pos, t: performance.now() }];
  }, [gamePhase]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (gamePhase !== "playing") return;
    const s = stateRef.current;
    if (!s.isSlashing) return;
    const canvas = canvasRef.current!;
    const W = canvas.width, H = canvas.height;
    const pos = getPos(e);
    s.slashPoints.push({ ...pos, t: performance.now() });

    for (const item of s.items) {
      if (item.sliced) continue;
      if (!hitTest(pos.x, pos.y, item.x, item.y, item.radius, W, H)) continue;
      item.sliced = true;
      item.splashTimer = 0;

      if (item.type === "bomb") {
        s.combo = 0;
        s.lives = Math.max(0, s.lives - 1);
        setDisplayLives(s.lives);
        setDisplayCombo(0);
        spawnParticles(item.x, item.y, "#ef4444", 14);
        if (s.lives <= 0) killGame(s.score);
      } else {
        s.combo++;
        s.comboTimer = 100;
        const fd = FRUIT_DATA[item.type as FruitType];
        const points = 10 * Math.max(1, s.combo);
        s.score += points;
        setDisplayScore(s.score);
        setDisplayCombo(s.combo);
        spawnParticles(item.x, item.y, fd.splash, 12);
      }
    }
  }, [gamePhase, hitTest, spawnParticles, killGame]);

  const handlePointerUp = useCallback(() => {
    stateRef.current.isSlashing = false;
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div
      className="relative w-full flex items-center justify-center"
      style={{ height: "calc(100vh - 64px)" }}
    >
      <div
        className="relative overflow-hidden"
        style={{
          width: "min(420px, 100vw)",
          height: "min(680px, calc(100vh - 64px))",
          borderRadius: "12px",
          border: "0.5px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Canvas always mounted so ref is stable */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          style={{ cursor: "crosshair" }}
        />

        {/* HUD */}
        {(gamePhase === "playing") && (
          <div
            className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 pointer-events-none"
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.65), transparent)" }}
          >
            <div>
              <p className="font-mono-arc text-[8px] text-gray-500 uppercase tracking-widest">Score</p>
              <p className="font-mono-arc text-xl font-bold text-white tabular-nums">
                {displayScore.toLocaleString()}
              </p>
            </div>
            <div className="flex gap-1">
              {[...Array(3)].map((_, i) => (
                <span key={i} className="text-lg" style={{ opacity: i < displayLives ? 1 : 0.15 }}>
                  ❤️
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Combo badge */}
        {displayCombo >= 2 && gamePhase === "playing" && (
          <div className="absolute top-16 left-0 right-0 flex justify-center pointer-events-none">
            <div
              key={displayCombo}
              className="font-mono-arc text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full"
              style={{
                background: "rgba(167,139,250,0.15)",
                border: "0.5px solid rgba(167,139,250,0.4)",
                color: "#c4b5fd",
                animation: "combo-pop 0.15s ease-out",
              }}
            >
              {displayCombo}x combo 🔥
            </div>
            <style>{`@keyframes combo-pop{from{transform:scale(1.35)}to{transform:scale(1)}}`}</style>
          </div>
        )}

        {/* Countdown */}
        {gamePhase === "countdown" && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ background: "rgba(10,6,25,0.88)" }}
          >
            <p className="font-mono-arc text-[10px] text-violet-400 uppercase tracking-[0.22em] mb-3">
              Fruit Blitz
            </p>
            <p className="font-mono-arc text-[9px] text-gray-600 uppercase tracking-widest mb-10">
              Slash fruits · Dodge bombs
            </p>
            <div
              className="font-mono-arc font-bold text-white"
              style={{ fontSize: 80, lineHeight: 1, textShadow: "0 0 40px #a78bfa" }}
            >
              {countdown > 0 ? countdown : "GO!"}
            </div>
          </div>
        )}

        {/* Results / XP claim */}
        {gamePhase === "results" && (
          <XPClaimScreen
            score={finalScore}
            xpEarned={xpEarned}
            onClaim={() => onGameComplete(finalScore)}
          />
        )}

        {/* Hint */}
        {gamePhase === "playing" && stateRef.current.frame < 160 && (
          <div className="absolute bottom-5 left-0 right-0 flex justify-center pointer-events-none">
            <p className="font-mono-arc text-[9px] text-gray-700 uppercase tracking-widest">
              Swipe to slash fruits
            </p>
          </div>
        )}
      </div>
    </div>
  );
}