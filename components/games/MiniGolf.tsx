"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { GameProps } from "../../app/game/[gameId]/page";

const W = 600, H = 400;
const BALL_R = 6, HOLE_R = 8, FRICTION = 0.95, MAX_POWER = 17;
const STEPS = 3; // sub-steps per frame for reliable collision

type Obstacle = "wall" | "water" | "spike";
type Point = { x: number; y: number };

interface HoleDef {
  id: number;
  start: Point;
  hole: Point;
  obstacles: { type: Obstacle; x: number; y: number; w: number; h: number }[];
  par: number;
}

const HOLES: HoleDef[] = [
  { id: 1, start: { x: 80, y: 200 }, hole: { x: 520, y: 200 }, obstacles: [], par: 2 },
  { id: 2, start: { x: 80, y: 200 }, hole: { x: 520, y: 100 }, obstacles: [{ type: "wall", x: 300, y: 150, w: 20, h: 100 }], par: 2 },
  { id: 3, start: { x: 80, y: 200 }, hole: { x: 520, y: 200 }, obstacles: [{ type: "water", x: 250, y: 100, w: 150, h: 200 }], par: 3 },
  { id: 4, start: { x: 80, y: 200 }, hole: { x: 520, y: 50 }, obstacles: [
    { type: "wall", x: 200, y: 100, w: 20, h: 150 }, { type: "wall", x: 350, y: 200, w: 20, h: 150 }
  ], par: 3 },
  { id: 5, start: { x: 80, y: 200 }, hole: { x: 520, y: 200 }, obstacles: [
    { type: "water", x: 150, y: 0, w: 30, h: 200 }, { type: "spike", x: 300, y: 150, w: 60, h: 60 },
    { type: "water", x: 450, y: 100, w: 30, h: 250 }
  ], par: 3 },
  { id: 6, start: { x: 80, y: 200 }, hole: { x: 520, y: 200 }, obstacles: [
    { type: "wall", x: 150, y: 0, w: 250, h: 150 }, { type: "wall", x: 200, y: 250, w: 250, h: 150 }
  ], par: 3 },
  { id: 7, start: { x: 80, y: 100 }, hole: { x: 520, y: 300 }, obstacles: [{ type: "water", x: 200, y: 150, w: 200, h: 100 }], par: 3 },
  { id: 8, start: { x: 80, y: 200 }, hole: { x: 520, y: 200 }, obstacles: [
    { type: "spike", x: 150, y: 150, w: 40, h: 100 }, { type: "spike", x: 300, y: 100, w: 40, h: 100 },
    { type: "spike", x: 450, y: 150, w: 40, h: 100 }
  ], par: 4 },
  { id: 9, start: { x: 80, y: 200 }, hole: { x: 520, y: 200 }, obstacles: [
    { type: "water", x: 0, y: 0, w: 100, h: 400 }, { type: "spike", x: 200, y: 100, w: 100, h: 50 },
    { type: "wall", x: 300, y: 200, w: 20, h: 200 }, { type: "water", x: 500, y: 0, w: 100, h: 400 }
  ], par: 4 },
];

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
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-6 rounded-2xl" style={{ background: "rgba(10,6,25,0.97)" }}>
      <div style={{ fontSize: 56 }}>⛳</div>
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

// ─── Main Game ─────────────────────────────────────────────────────────────────

export default function MiniGolfGame({ gameConfig, onGameComplete, onGameFail }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  // All mutable state in a single ref to avoid stale closures
  const g = useRef({
    holeIdx: 0,
    strokes: 0,
    totalScore: 0,
    phase: "start" as "start" | "playing" | "results",
    showStart: true,
    gameComplete: false,
    ball: { x: HOLES[0].start.x, y: HOLES[0].start.y, vx: 0, vy: 0, moving: false },
    drag: { active: false, dx: 0, dy: 0 },
    finalScore: 0,
    xpEarned: 0,
    holeInHole: false, // prevent double-counting
  });

  // React state for rendering
  const [renderTick, setRenderTick] = useState(0);
  const rerender = useCallback(() => setRenderTick(t => t + 1), []);

  const hole = HOLES[g.current.holeIdx];
  const UI_SCORE = g.current.totalScore;
  const UI_STROKES = g.current.strokes;
  const UI_HOLE = g.current.holeIdx;
  const UI_GAMECOMPLETE = g.current.gameComplete;
  const UI_SHOWSTART = g.current.showStart;
  const UI_PHASE = g.current.phase;
  const UI_FINAL = g.current.finalScore;
  const UI_XP = g.current.xpEarned;

  // ── Drawing ──────────────────────────────────────────────────────────────

  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const s = g.current;
    const holeDef = HOLES[s.holeIdx];
    const b = s.ball;

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0a1f3f"); bg.addColorStop(0.5, "#1a3f5f"); bg.addColorStop(1, "#0f2a4f");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = "rgba(34,197,94,0.04)";
    ctx.lineWidth = 0.5;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // Obstacles
    const colorMap: Record<string, string> = { wall: "#7c3aed", water: "#0ea5e9", spike: "#ef4444" };
    holeDef.obstacles.forEach(o => {
      ctx.fillStyle = colorMap[o.type];
      ctx.shadowColor = colorMap[o.type] + "66";
      ctx.shadowBlur = 15;
      ctx.fillRect(o.x, o.y, o.w, o.h);
      if (o.type === "spike") {
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        for (let sx = o.x; sx < o.x + o.w; sx += 10) {
          ctx.beginPath();
          ctx.moveTo(sx, o.y); ctx.lineTo(sx + 5, o.y + o.h); ctx.lineTo(sx - 5, o.y + o.h);
          ctx.closePath(); ctx.fill();
        }
      }
    });
    ctx.shadowBlur = 0;

    // Hole
    ctx.shadowColor = "rgba(34,197,94,0.8)"; ctx.shadowBlur = 20;
    ctx.fillStyle = "#22c55e";
    ctx.beginPath(); ctx.arc(holeDef.hole.x, holeDef.hole.y, HOLE_R, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#16a34a";
    ctx.beginPath(); ctx.arc(holeDef.hole.x, holeDef.hole.y, HOLE_R - 2, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // Ball
    const grad = ctx.createRadialGradient(b.x - BALL_R * 0.3, b.y - BALL_R * 0.3, 0, b.x, b.y, BALL_R);
    grad.addColorStop(0, "#fbbf24"); grad.addColorStop(1, "#d97706");
    ctx.shadowColor = "rgba(251,191,36,0.6)"; ctx.shadowBlur = 18;
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // Drag arrow + power bar
    if (s.drag.active && !b.moving) {
      const len = Math.min(200, Math.hypot(s.drag.dx, s.drag.dy));
      const ang = Math.atan2(s.drag.dy, s.drag.dx);
      const ex = b.x + Math.cos(ang) * len;
      const ey = b.y + Math.sin(ang) * len;
      ctx.strokeStyle = "rgba(147,197,253,0.5)"; ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.setLineDash([]);
      const pwr = Math.min(1, Math.hypot(s.drag.dx, s.drag.dy) / 150);
      const bw = 80;
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(b.x - bw / 2, b.y - 28, bw, 6);
      ctx.fillStyle = `rgb(${Math.floor(255 * (1 - pwr))}, ${Math.floor(200 * pwr)}, 50)`;
      ctx.fillRect(b.x - bw / 2, b.y - 28, bw * pwr, 6);
    }

    // HUD
    ctx.font = "bold 13px 'Courier New', monospace"; ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(`HOLE ${s.holeIdx + 1}/${HOLES.length} - PAR ${holeDef.par}`, 15, 25);
    ctx.fillText(`STROKES: ${s.strokes}`, 15, 45);
    ctx.textAlign = "right";
    ctx.fillStyle = "#a78bfa";
    ctx.fillText(`TOTAL: ${s.totalScore}`, W - 15, 25);
    const vs = s.strokes - holeDef.par;
    ctx.fillStyle = vs < 0 ? "#4ade80" : vs === 0 ? "#f59e0b" : "#ef4444";
    ctx.fillText(vs === 0 ? "PAR" : vs < 0 ? `${vs}` : `+${vs}`, W - 15, 45);

    // Start overlay
    if (s.showStart && s.phase !== "results") {
      ctx.fillStyle = "rgba(0,0,0,0.65)"; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = "center";
      ctx.fillStyle = "#22c55e"; ctx.font = "bold 32px 'Courier New', monospace";
      ctx.fillText("MINI GOLF", W / 2, H / 2 - 50);
      ctx.fillStyle = "rgba(255,255,255,0.8)"; ctx.font = "14px 'Courier New', monospace";
      ctx.fillText("Drag from the ball → aim & set power", W / 2, H / 2);
      ctx.fillText("Release to shoot!", W / 2, H / 2 + 25);
      ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.font = "11px 'Courier New', monospace";
      ctx.fillText("Sink the ball in the hole. Avoid obstacles.", W / 2, H / 2 + 60);
    }

    // Game complete overlay
    if (s.gameComplete && s.phase !== "results") {
      ctx.fillStyle = "rgba(0,0,0,0.75)"; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = "center";
      ctx.fillStyle = "#4ade80"; ctx.font = "bold 28px 'Courier New', monospace";
      ctx.fillText("COURSE COMPLETE!", W / 2, H / 2 - 40);
      ctx.fillStyle = "#fbbf24"; ctx.font = "bold 20px 'Courier New', monospace";
      ctx.fillText(`Score: ${s.totalScore}`, W / 2, H / 2 + 10);
      ctx.fillStyle = "#a78bfa"; ctx.font = "bold 14px 'Courier New', monospace";
      ctx.fillText("TAP TO CONTINUE", W / 2, H / 2 + 55);
    }
  }, []);

  // ── Physics ──────────────────────────────────────────────────────────────

  const tick = useCallback(() => {
    const s = g.current;
    const b = s.ball;
    if (!b.moving || s.gameComplete || s.phase === "results") return;

    for (let step = 0; step < STEPS; step++) {
      if (Math.hypot(b.vx, b.vy) < 0.06) {
        b.vx = 0; b.vy = 0; b.moving = false;
        break;
      }
      const subVx = b.vx / STEPS, subVy = b.vy / STEPS;
      b.x += subVx; b.y += subVy;

      // Boundary bounce
      if (b.x - BALL_R < 0) { b.x = BALL_R; b.vx = -b.vx * 0.6; }
      if (b.x + BALL_R > W) { b.x = W - BALL_R; b.vx = -b.vx * 0.6; }
      if (b.y - BALL_R < 0) { b.y = BALL_R; b.vy = -b.vy * 0.6; }
      if (b.y + BALL_R > H) { b.y = H - BALL_R; b.vy = -b.vy * 0.6; }

      // Obstacles
      const holeDef = HOLES[s.holeIdx];
      for (const o of holeDef.obstacles) {
        if (b.x + BALL_R > o.x && b.x - BALL_R < o.x + o.w && b.y + BALL_R > o.y && b.y - BALL_R < o.y + o.h) {
          if (o.type === "water" || o.type === "spike") {
            s.strokes++;
            b.x = holeDef.start.x; b.y = holeDef.start.y; b.vx = 0; b.vy = 0; b.moving = false;
            rerender();
            return;
          } else if (o.type === "wall") {
            const ox = Math.min(b.x + BALL_R - o.x, o.x + o.w - (b.x - BALL_R));
            const oy = Math.min(b.y + BALL_R - o.y, o.y + o.h - (b.y - BALL_R));
            if (ox < oy) { b.vx = -b.vx * 0.6; b.x += (b.x > o.x + o.w / 2) ? ox : -ox; }
            else { b.vy = -b.vy * 0.6; b.y += (b.y > o.y + o.h / 2) ? oy : -oy; }
          }
        }
      }
    }

    // Check hole (only when ball stopped)
    if (!b.moving && !s.holeInHole) {
      const holeDef = HOLES[s.holeIdx];
      if (Math.hypot(b.x - holeDef.hole.x, b.y - holeDef.hole.y) < HOLE_R + BALL_R) {
        s.holeInHole = true;
        const hs = Math.max(1, 10 - (s.strokes - holeDef.par) * 2);
        s.totalScore += hs;
        if (s.holeIdx < HOLES.length - 1) {
          s.holeIdx++;
          s.strokes = 0;
          b.x = HOLES[s.holeIdx].start.x; b.y = HOLES[s.holeIdx].start.y; b.vx = 0; b.vy = 0; b.moving = false;
          s.holeInHole = false;
        } else {
          s.gameComplete = true;
        }
        rerender();
      }
    }

    // Apply friction
    b.vx *= FRICTION;
    b.vy *= FRICTION;
  }, [rerender]);

  // ── Game Loop ────────────────────────────────────────────────────────────

  useEffect(() => {
    const loop = () => {
      tick();
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tick, draw]);

  // ── Input ────────────────────────────────────────────────────────────────

  const getPos = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const t = "touches" in e ? (e as TouchEvent).touches[0] || (e as TouchEvent).changedTouches[0] : e as MouseEvent;
    return {
      x: ((t.clientX - rect.left) / rect.width) * W,
      y: ((t.clientY - rect.top) / rect.height) * H,
    };
  };

  const onStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const s = g.current;
    if (s.phase === "results") return;
    const b = s.ball;
    if (b.moving) return;

    if (s.showStart) {
      s.showStart = false; s.phase = "playing"; rerender(); return;
    }
    if (s.gameComplete) {
      s.finalScore = s.totalScore;
      s.xpEarned = Math.max(100, Math.floor((s.totalScore / 100) * (gameConfig.base_xp ?? 50)));
      s.phase = "results";
      rerender();
      return;
    }

    const p = getPos(e);
    const dist = Math.hypot(p.x - b.x, p.y - b.y);
    if (dist < 60) {
      s.drag = { active: true, dx: 0, dy: 0 };
    }
  }, [gameConfig.base_xp, rerender]);

  const onMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const s = g.current;
    const b = s.ball;
    if (!s.drag.active || b.moving) return;
    const p = getPos(e);
    s.drag.dx = p.x - b.x;
    s.drag.dy = p.y - b.y;
  }, []);

  const onEnd = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const s = g.current;
    const b = s.ball;
    if (!s.drag.active) return;
    const power = Math.min(MAX_POWER, Math.hypot(s.drag.dx, s.drag.dy) / 8);
    if (power > 0.5) {
      const ang = Math.atan2(s.drag.dy, s.drag.dx);
      b.vx = Math.cos(ang) * power;
      b.vy = Math.sin(ang) * power;
      b.moving = true;
      s.holeInHole = false;
      s.strokes++;
      rerender();
    }
    s.drag = { active: false, dx: 0, dy: 0 };
  }, [rerender]);

  const handleClaim = useCallback(() => {
    onGameComplete(g.current.finalScore);
  }, [onGameComplete]);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const s = g.current;
      if (s.showStart && (e.key === " " || e.key === "Enter")) {
        e.preventDefault(); s.showStart = false; s.phase = "playing"; rerender(); return;
      }
      if (s.gameComplete && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        s.finalScore = s.totalScore;
        s.xpEarned = Math.max(100, Math.floor((s.totalScore / 100) * (gameConfig.base_xp ?? 50)));
        s.phase = "results";
        rerender();
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [gameConfig.base_xp, rerender]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-[600px] mx-auto px-2">
      <div className="relative w-full">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onMouseDown={onStart}
          onMouseMove={onMove}
          onMouseUp={onEnd}
          onMouseLeave={onEnd}
          onTouchStart={onStart}
          onTouchMove={onMove}
          onTouchEnd={onEnd}
          className="w-full rounded-2xl shadow-2xl touch-none cursor-crosshair border border-green-400/30"
          style={{ maxWidth: "100%", height: "auto", aspectRatio: `${W}/${H}`, background: "#0a1f3f" }}
        />
        {g.current.phase === "results" && (
          <div className="absolute inset-0">
            <XPClaimScreen score={g.current.finalScore} xpEarned={g.current.xpEarned} onClaim={handleClaim} />
          </div>
        )}
      </div>
      <div className="text-center w-full">
        <p className="font-mono-arc text-xs text-gray-500 uppercase tracking-wider mb-1">Total Score</p>
        <p className="font-mono-arc text-3xl font-bold text-emerald-400 tabular-nums">
          {g.current.totalScore}
        </p>
        <p className="font-mono-arc text-[10px] text-gray-600 mt-1">
          Hole {g.current.holeIdx + 1}/{HOLES.length} · {g.current.strokes} stroke{g.current.strokes !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
}
