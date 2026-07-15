"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { GameProps } from "../../app/game/[gameId]/page";

const COLS = 20;
const ROWS = 20;

type Difficulty = "easy" | "medium" | "hard";
type DifficultyConfig = {
  label: string;
  tickMs: number;
  pointsPerFood: number;
  xpMultiplier: number;
};
const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  easy:   { label: "Easy",   tickMs: 175, pointsPerFood: 10, xpMultiplier: 0.5 },
  medium: { label: "Medium", tickMs: 120, pointsPerFood: 10, xpMultiplier: 1 },
  hard:   { label: "Hard",   tickMs: 68,  pointsPerFood: 10, xpMultiplier: 1.5 },
};

type Dir = { dx: number; dy: number };
const DIRS: Record<string, Dir> = {
  up:    { dx: 0,  dy: -1 },
  down:  { dx: 0,  dy: 1 },
  left:  { dx: -1, dy: 0 },
  right: { dx: 1,  dy: 0 },
};
const OPPOSITE: Record<string, string> = { up: "down", down: "up", left: "right", right: "left" };

type Point = { x: number; y: number };

function randomFood(snake: Point[]): Point {
  for (let i = 0; i < 200; i++) {
    const p = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    if (!snake.some((s) => s.x === p.x && s.y === p.y)) return p;
  }
  return { x: 0, y: 0 };
}

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
      <div style={{ fontSize: 56 }}>🐍</div>
      <div className="text-center">
        <p className="font-mono-arc text-[9px] text-gray-500 uppercase tracking-[0.2em] mb-1">Final score</p>
        <p className="font-mono-arc text-5xl font-bold text-white tabular-nums">{score.toLocaleString()}</p>
      </div>
      <div className="w-full h-px" style={{ background: "rgba(167,139,250,0.15)" }} />
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
            onClick={() => setClaimed(true)}
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

// ─── Main Game Component ──────────────────────────────────────────────────────

export default function SnakeGame({ gameConfig, onGameComplete, onGameFail }: GameProps) {
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const diffConfig = DIFFICULTIES[difficulty];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    snake: [{ x: 10, y: 10 }],
    food: { x: 15, y: 15 },
    dir: "right" as string,
    nextDir: "right" as string,
    score: 0,
    alive: false,
    started: false,
    gameOver: false,
    showStart: true,
    ateThisTick: false,
    difficulty: "medium" as Difficulty,
  });
  const rafRef = useRef(0);
  const lastTickRef = useRef(0);

  const [score, setScore] = useState(0);
  const [length, setLength] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [showStart, setShowStart] = useState(true);
  const [showDifficulty, setShowDifficulty] = useState(true);
  const [gamePhase, setGamePhase] = useState<"playing" | "results">("playing");
  const [finalScore, setFinalScore] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);

  const cellSize = 24;

  // ── Drawing ──────────────────────────────────────────────────────────────

  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const s = stateRef.current;
    const W = COLS * cellSize, H = ROWS * cellSize;

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0a0e27");
    bg.addColorStop(1, "#1a1f3a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = "rgba(34,197,94,0.08)";
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath(); ctx.moveTo(x * cellSize, 0); ctx.lineTo(x * cellSize, H); ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * cellSize); ctx.lineTo(W, y * cellSize); ctx.stroke();
    }

    // Food
    const fx = s.food.x * cellSize + cellSize / 2;
    const fy = s.food.y * cellSize + cellSize / 2;
    const pulse = 1 + Math.sin(Date.now() / 160) * 0.14;
    const foodGrad = ctx.createRadialGradient(fx, fy, 0, fx, fy, cellSize / 2 * pulse);
    foodGrad.addColorStop(0, "#fbbf24");
    foodGrad.addColorStop(0.6, "#f59e0b");
    foodGrad.addColorStop(1, "rgba(251,191,36,0)");
    ctx.shadowColor = "rgba(251,191,36,0.6)";
    ctx.shadowBlur = 15;
    ctx.fillStyle = foodGrad;
    ctx.beginPath();
    ctx.arc(fx, fy, cellSize / 2.2 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Snake body
    s.snake.forEach((seg, i) => {
      const t = i / Math.max(s.snake.length - 1, 1);
      const isHead = i === 0;
      const segX = seg.x * cellSize;
      const segY = seg.y * cellSize;
      const pad = 2;
      const size = cellSize - pad * 2;

      const grad = ctx.createLinearGradient(segX, segY, segX + size, segY + size);
      if (isHead) {
        grad.addColorStop(0, "#34d399");
        grad.addColorStop(1, "#10b981");
      } else {
        const bright = 0.7 + t * 0.25;
        grad.addColorStop(0, `rgba(5,150,105,${bright})`);
        grad.addColorStop(1, `rgba(16,185,129,${bright})`);
      }
      ctx.fillStyle = grad;

      const r = isHead ? 6 : 4;
      const cx = segX + cellSize / 2;
      const cy = segY + cellSize / 2;
      ctx.beginPath();
      ctx.roundRect(cx - size / 2, cy - size / 2, size, size, r);
      ctx.fill();

      if (isHead) {
        ctx.shadowColor = "rgba(16,185,129,0.5)";
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;

        const eyeDir = s.dir;
        let ex1 = cx - 3, ey1 = cy - 2, ex2 = cx + 3, ey2 = cy - 2;
        if (eyeDir === "up")    { ex1 = cx - 3; ey1 = cy - 3; ex2 = cx + 3; ey2 = cy - 3; }
        if (eyeDir === "down")  { ex1 = cx - 3; ey1 = cy + 2; ex2 = cx + 3; ey2 = cy + 2; }
        if (eyeDir === "left")  { ex1 = cx - 3; ey1 = cy - 2; ex2 = cx - 3; ey2 = cy + 2; }
        if (eyeDir === "right") { ex1 = cx + 3; ey1 = cy - 2; ex2 = cx + 3; ey2 = cy + 2; }
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(ex1, ey1, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(ex2, ey2, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#000";
        ctx.beginPath(); ctx.arc(ex1 + (eyeDir === "right" ? 1 : eyeDir === "left" ? -1 : 0), ey1 + (eyeDir === "down" ? 1 : eyeDir === "up" ? -1 : 0), 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(ex2 + (eyeDir === "right" ? 1 : eyeDir === "left" ? -1 : 0), ey2 + (eyeDir === "down" ? 1 : eyeDir === "up" ? -1 : 0), 1.2, 0, Math.PI * 2); ctx.fill();
      }
    });

    // Overlays
    if (s.showStart) {
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#34d399";
      ctx.font = "bold 36px 'Courier New', monospace";
      ctx.textAlign = "center";
      ctx.shadowColor = "#34d399";
      ctx.shadowBlur = 25;
      ctx.fillText("SNAKE", W / 2, H / 2 - 50);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.font = "14px 'Courier New', monospace";
      ctx.fillText("Swipe or tap arrows to move", W / 2, H / 2 + 10);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "12px 'Courier New', monospace";
      ctx.fillText("Eat food to grow. Don't hit yourself!", W / 2, H / 2 + 45);
    }

    if (s.gameOver && gamePhase === "playing") {
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ef4444";
      ctx.font = "bold 32px 'Courier New', monospace";
      ctx.textAlign = "center";
      ctx.shadowColor = "#ef4444";
      ctx.shadowBlur = 20;
      ctx.fillText("GAME OVER", W / 2, H / 2 - 40);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fbbf24";
      ctx.font = "bold 22px 'Courier New', monospace";
      ctx.fillText(`Score: ${s.score}`, W / 2, H / 2 + 10);
      ctx.fillStyle = "#34d399";
      ctx.font = "14px 'Courier New', monospace";
      ctx.fillText(`Length: ${s.snake.length}`, W / 2, H / 2 + 40);
      ctx.fillStyle = "#a78bfa";
      ctx.font = "bold 14px 'Courier New', monospace";
      ctx.fillText("TAP TO CONTINUE", W / 2, H / 2 + 85);
    }
  }, [gamePhase]);

  // ── Game Tick ────────────────────────────────────────────────────────────

  const endGame = useCallback(() => {
    const s = stateRef.current;
    if (s.gameOver) return;
    s.gameOver = true;
    s.alive = false;
    setGameOver(true);
    const finalScoreValue = s.score;
    setFinalScore(finalScoreValue);
    const dc = DIFFICULTIES[s.difficulty];
    const xp = Math.max(100, Math.floor((finalScoreValue / 100) * (gameConfig.base_xp ?? 50) * dc.xpMultiplier));
    setXpEarned(xp);
    setGamePhase("results");
  }, [gameConfig.base_xp]);

  const tick = useCallback(() => {
    const s = stateRef.current;
    if (!s.started || s.gameOver) return;

    s.dir = s.nextDir;
    const d = DIRS[s.dir];
    if (!d) return;

    const head = s.snake[0];
    const newHead: Point = {
      x: (head.x + d.dx + COLS) % COLS,
      y: (head.y + d.dy + ROWS) % ROWS,
    };

    if (s.snake.some((seg) => seg.x === newHead.x && seg.y === newHead.y)) {
      endGame();
      return;
    }

    s.ateThisTick = false;
    const newSnake = [newHead, ...s.snake];
    const dc = DIFFICULTIES[s.difficulty];

    if (newHead.x === s.food.x && newHead.y === s.food.y) {
      s.score += dc.pointsPerFood;
      setScore(s.score);
      setLength(newSnake.length);
      s.food = randomFood(newSnake);
      s.ateThisTick = true;
    } else {
      newSnake.pop();
    }

    s.snake = newSnake;
  }, [endGame]);

  // ── Game Loop ────────────────────────────────────────────────────────────

  const loop = useCallback((now: number) => {
    const s = stateRef.current;
    if (s.gameOver) {
      draw();
      return;
    }
    const elapsed = now - lastTickRef.current;
    const dc = DIFFICULTIES[s.difficulty];
    if (elapsed >= dc.tickMs) {
      lastTickRef.current = now;
      tick();
      draw();
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [tick, draw]);

  useEffect(() => {
    lastTickRef.current = performance.now();
    rafRef.current = requestAnimationFrame(loop);
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [loop, draw]);

  // ── Input ────────────────────────────────────────────────────────────────

  const startGame = useCallback(() => {
    const s = stateRef.current;
    const dc = DIFFICULTIES[difficulty];
    s.snake = [{ x: 10, y: 10 }];
    s.food = randomFood(s.snake);
    s.dir = "right";
    s.nextDir = "right";
    s.score = 0;
    s.started = true;
    s.gameOver = false;
    s.showStart = false;
    s.alive = true;
    s.difficulty = difficulty;
    setScore(0);
    setLength(1);
    setGameOver(false);
    setShowStart(false);
    setShowDifficulty(false);
    setGamePhase("playing");
  }, [difficulty]);

  const setDir = useCallback((dir: string) => {
    const s = stateRef.current;
    if (!s.started || s.gameOver) return;
    if (dir === OPPOSITE[s.dir]) return;
    s.nextDir = dir;
  }, []);

  const handleCanvasClick = useCallback(() => {
    const s = stateRef.current;
    if (showDifficulty && !s.started) return;
    if (s.showStart) { startGame(); return; }
    if (s.gameOver && gamePhase === "playing") { startGame(); return; }
  }, [startGame, showDifficulty, gamePhase]);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const s = stateRef.current;
    if (showDifficulty && !s.started) return;
    if (s.showStart) { startGame(); return; }
    if (s.gameOver && gamePhase === "playing") { startGame(); return; }
    const start = touchStartRef.current;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const absDx = Math.abs(dx), absDy = Math.abs(dy);
    if (Math.max(absDx, absDy) < 20) return;
    if (absDx > absDy) setDir(dx > 0 ? "right" : "left");
    else setDir(dy > 0 ? "down" : "up");
    touchStartRef.current = null;
  }, [startGame, setDir, showDifficulty, gamePhase]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (e.code === "Space" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (showDifficulty && !s.started) return;
        if (s.showStart) { startGame(); return; }
        if (s.gameOver && gamePhase === "playing") { startGame(); return; }
        return;
      }
      if (!s.started || s.gameOver) return;
      const map: Record<string, string> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
      const dir = map[e.key];
      if (dir) { e.preventDefault(); setDir(dir); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [startGame, setDir, showDifficulty, gamePhase]);

  const handleClaim = useCallback(() => {
    onGameComplete(finalScore);
  }, [onGameComplete, finalScore]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-[500px] mx-auto px-2">
      <div className="relative w-full">
        <canvas
          ref={canvasRef}
          width={COLS * cellSize}
          height={ROWS * cellSize}
          onClick={handleCanvasClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="rounded-2xl shadow-2xl border border-green-400/30 w-full h-auto"
          style={{ maxWidth: "100%", touchAction: "manipulation", cursor: "pointer", background: "#0a0e27" }}
        />

        {/* Difficulty Selector */}
        {showDifficulty && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 rounded-2xl"
            style={{ background: "rgba(10,6,25,0.95)" }}
          >
            <div className="text-4xl">🐍</div>
            <p className="font-mono-arc text-lg font-bold text-green-400 uppercase tracking-wider text-center" style={{ textShadow: "0 0 20px rgba(34,197,94,0.4)" }}>
              Snake
            </p>
            <p className="font-mono-arc text-[9px] text-gray-500 uppercase tracking-[0.2em]">Select difficulty</p>
            <div className="flex gap-2 w-full px-2 justify-center">
              {(["easy", "medium", "hard"] as Difficulty[]).map((d) => {
                const config = DIFFICULTIES[d];
                const selected = difficulty === d;
                return (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`flex-1 px-3 py-3 rounded-lg font-mono-arc text-[10px] font-bold uppercase tracking-wider transition-all ${
                      selected ? "scale-110" : "opacity-50 hover:opacity-80"
                    }`}
                    style={{
                      background: selected
                        ? d === "easy" ? "linear-gradient(135deg,#22c55e,#4ade80)"
                          : d === "medium" ? "linear-gradient(135deg,#f59e0b,#fbbf24)"
                          : "linear-gradient(135deg,#ef4444,#f87171)"
                        : "rgba(255,255,255,0.05)",
                      border: selected ? "none" : "0.5px solid rgba(255,255,255,0.12)",
                      color: selected ? "#000" : "#9ca3af",
                      boxShadow: selected ? "0 0 20px rgba(167,139,250,0.3)" : "none",
                    }}
                  >
                    <p className="text-xs font-bold">{config.label}</p>
                    <p className="text-[8px] opacity-60 mt-0.5">
                      {d === "easy" ? "Relaxed" : d === "medium" ? "Classic" : "Pro"}
                    </p>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => { setShowDifficulty(false); startGame(); }}
              className="font-mono-arc text-sm font-bold uppercase tracking-widest w-[80%] px-8 py-4 rounded-lg transition-all hover:opacity-90 active:scale-95 mt-4"
              style={{
                background: "linear-gradient(135deg,#7c3aed,#a78bfa)",
                color: "#fff",
                boxShadow: "0 0 24px rgba(167,139,250,0.3)",
              }}
            >
              Start Game →
            </button>
            <p className="font-mono-arc text-[8px] text-gray-600 mt-1">or tap the screen</p>
          </div>
        )}

        {/* XP Claim Screen Overlay */}
        {gamePhase === "results" && (
          <div className="absolute inset-0">
            <XPClaimScreen
              score={finalScore}
              xpEarned={xpEarned}
              onClaim={handleClaim}
            />
          </div>
        )}
      </div>

      {/* Score */}
      <div className="text-center w-full px-2">
        <p className="font-mono-arc text-xs text-gray-500 uppercase tracking-[0.15em] mb-1">Score</p>
        <p className="font-mono-arc text-3xl font-bold text-green-400 tabular-nums">{score}</p>
        <p className="font-mono-arc text-[9px] text-gray-600 mt-1">Length: {length}</p>
        <p className="font-mono-arc text-[8px] text-gray-700 mt-0.5 uppercase tracking-wider">{DIFFICULTIES[difficulty].label} mode</p>
      </div>

      {/* D-Pad */}
      <div className="grid grid-cols-3 gap-1.5 w-[180px] mx-auto select-none">
        <div />
        <DPadButton dir="up" label="▲" onDir={setDir} />
        <div />
        <DPadButton dir="left" label="◀" onDir={setDir} />
        <div className="flex items-center justify-center">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm"
            style={{ background: "rgba(16,185,129,0.08)", border: "0.5px solid rgba(16,185,129,0.15)", color: "#10b981" }}
          >
            🐍
          </div>
        </div>
        <DPadButton dir="right" label="▶" onDir={setDir} />
        <div />
        <DPadButton dir="down" label="▼" onDir={setDir} />
        <div />
      </div>
      <p className="font-mono-arc text-[8px] text-gray-700 uppercase tracking-wider -mt-1">Swipe or tap arrows</p>
    </div>
  );
}

function DPadButton({ dir, label, onDir }: { dir: string; label: string; onDir: (d: string) => void }) {
  return (
    <button
      onPointerDown={(e) => { e.preventDefault(); onDir(dir); }}
      className="w-12 h-12 rounded-xl flex items-center justify-center text-base font-bold active:scale-90 transition-transform select-none"
      style={{
        background: "rgba(16,185,129,0.1)",
        border: "0.5px solid rgba(16,185,129,0.2)",
        color: "#34d399",
        touchAction: "manipulation",
      }}
    >
      {label}
    </button>
  );
}
