"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { GameProps } from "../../app/game/[gameId]/page";

// ─── Constants ────────────────────────────────────────────────────────────────

const PIPE_WIDTH = 72;
const GAME_WIDTH = 500;
const GAME_HEIGHT = 700;

type Difficulty = "easy" | "medium" | "hard";

type DifficultyConfig = {
  label: string;
  gravity: number;
  jumpStrength: number;
  pipeGap: number;
  pipeSpacing: number;
  baseSpeed: number;
  maxSpeed: number;
  xpMultiplier: number;
};

const DIFFICULTY_CONFIGS: Record<Difficulty, DifficultyConfig> = {
  easy: {
    label: "Easy",
    gravity: 0.25,
    jumpStrength: -9,
    pipeGap: 200,
    pipeSpacing: 360,
    baseSpeed: 2.5,
    maxSpeed: 4.5,
    xpMultiplier: 0.5,
  },
  medium: {
    label: "Medium",
    gravity: 0.35,
    jumpStrength: -8.5,
    pipeGap: 160,
    pipeSpacing: 320,
    baseSpeed: 3.5,
    maxSpeed: 6.5,
    xpMultiplier: 1,
  },
  hard: {
    label: "Hard",
    gravity: 0.45,
    jumpStrength: -7.5,
    pipeGap: 130,
    pipeSpacing: 280,
    baseSpeed: 4.5,
    maxSpeed: 8,
    xpMultiplier: 1.5,
  },
};

type Bird = {
  y: number;
  velocity: number;
  rotation: number;
  flapAnimation: number;
};

type Pipe = {
  x: number;
  gapY: number;
  scored: boolean;
  passed: boolean;
};

type PowerUp = {
  id: string;
  x: number;
  y: number;
  type: "shield" | "slow" | "magnet" | "double";
  collected: boolean;
  bobPhase: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type: "sparkle" | "trail" | "burst";
};

type Achievement = {
  id: string;
  name: string;
  unlocked: boolean;
  progress: number;
};

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
      <div style={{ fontSize: 56 }}>🏆</div>
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function FlappyBirdGameEnhanced({
  gameConfig,
  onGameComplete,
  onGameFail,
}: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameLoopRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const frameCountRef = useRef(0);
  const speedRef = useRef(DIFFICULTY_CONFIGS.medium.baseSpeed);
  const difficultyTimerRef = useRef(0);
  const isGameOverRef = useRef(false);

  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [showDifficultySelect, setShowDifficultySelect] = useState(true);
  const [score, setScore] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [combo, setCombo] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [shield, setShield] = useState(false);
  const [slowMode, setSlowMode] = useState(false);
  const [doublePoints, setDoublePoints] = useState(false);
  const [gamePhase, setGamePhase] = useState<"playing" | "results">("playing");
  const [finalScore, setFinalScore] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [achievements, setAchievements] = useState<Achievement[]>([
    { id: "first_pipe", name: "First Flight", unlocked: false, progress: 0 },
    { id: "combo_5", name: "On a Roll", unlocked: false, progress: 0 },
    { id: "combo_10", name: "Unstoppable", unlocked: false, progress: 0 },
    { id: "combo_15", name: "Legendary", unlocked: false, progress: 0 },
    { id: "score_50", name: "50 Points", unlocked: false, progress: 0 },
    { id: "score_100", name: "Century Club", unlocked: false, progress: 0 },
    { id: "no_hit_10", name: "Perfect Run", unlocked: false, progress: 0 },
  ]);
  const [powerUps, setPowerUps] = useState<PowerUp[]>([]);
  const [showAchievement, setShowAchievement] = useState<string | null>(null);
  const [screenShake, setScreenShake] = useState(0);
  const [highScore, setHighScore] = useState(0);

  const birdRef = useRef<Bird>({
    y: GAME_HEIGHT / 2,
    velocity: 0,
    rotation: 0,
    flapAnimation: 0,
  });

  const pipeRef = useRef<Pipe[]>([]);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const consecutivePassesRef = useRef(0);
  const bestComboRef = useRef(0);
  const diffConfigRef = useRef<DifficultyConfig>(DIFFICULTY_CONFIGS.medium);

  // ─── Reset Game ─────────────────────────────────────────────────────────────

  const resetGame = useCallback(() => {
    // Cancel any existing loop
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = 0;
    }

    // Reset all refs
    isGameOverRef.current = false;
    birdRef.current = {
      y: GAME_HEIGHT / 2,
      velocity: 0,
      rotation: 0,
      flapAnimation: 0,
    };
    pipeRef.current = [];
    particlesRef.current = [];
    scoreRef.current = 0;
    comboRef.current = 0;
    consecutivePassesRef.current = 0;
    bestComboRef.current = 0;
    diffConfigRef.current = DIFFICULTY_CONFIGS[difficulty];
    speedRef.current = diffConfigRef.current.baseSpeed;
    difficultyTimerRef.current = 0;
    frameCountRef.current = 0;

    // Reset all state
    setScore(0);
    setCombo(0);
    setMultiplier(1);
    setGameOver(false);
    setGameStarted(false);
    setShowDifficultySelect(true);
    setGamePhase("playing");
    setShield(false);
    setSlowMode(false);
    setDoublePoints(false);
    setPowerUps([]);
    setScreenShake(0);
    setFinalScore(0);
    setXpEarned(0);
  }, [difficulty]);

  // ─── End Game ───────────────────────────────────────────────────────────────

  const endGame = useCallback(() => {
    if (isGameOverRef.current) return;
    isGameOverRef.current = true;
    
    const finalScoreValue = scoreRef.current;
    setFinalScore(finalScoreValue);
    setGameOver(true);
    setGamePhase("results");
    
    const config = DIFFICULTY_CONFIGS[difficulty];
    const xp = Math.max(100, Math.floor((finalScoreValue / 100) * (gameConfig.base_xp ?? 75) * config.xpMultiplier));
    setXpEarned(xp);
    
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = 0;
    }
  }, [gameConfig.base_xp, difficulty]);

  // ─── Particle System ────────────────────────────────────────────────────────

  const createParticles = useCallback((
    x: number, 
    y: number, 
    color: string, 
    count: number = 12,
    type: "sparkle" | "trail" | "burst" = "burst"
  ) => {
    const isSparkle = type === "sparkle";
    const isTrail = type === "trail";
    
    for (let i = 0; i < count; i++) {
      const angle = isTrail 
        ? -Math.PI / 2 + (Math.random() - 0.5) * Math.PI
        : (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      
      const speed = isSparkle 
        ? 0.5 + Math.random() * 1.5
        : 2 + Math.random() * 4;
      
      particlesRef.current.push({
        x: x + (Math.random() - 0.5) * 4,
        y: y + (Math.random() - 0.5) * 4,
        vx: Math.cos(angle) * speed * (isTrail ? 0.5 : 1),
        vy: Math.sin(angle) * speed * (isTrail ? 0.3 : 1) - (isTrail ? 1 : 0),
        life: 1,
        maxLife: isSparkle ? 0.5 + Math.random() * 0.5 : 0.8 + Math.random() * 0.4,
        color: color,
        size: isSparkle ? 1 + Math.random() * 3 : 2 + Math.random() * 4,
        type: type,
      });
    }
  }, []);

  const createTrail = useCallback((x: number, y: number) => {
    if (frameCountRef.current % 2 === 0) {
      createParticles(x, y, "rgba(251,191,36,0.3)", 2, "trail");
    }
  }, [createParticles]);

  // ─── Achievement System ────────────────────────────────────────────────────

  const unlockAchievement = useCallback((achievementId: string) => {
    setAchievements((prev) => {
      const achievement = prev.find((a) => a.id === achievementId);
      if (achievement?.unlocked) return prev;
      
      return prev.map((ach) =>
        ach.id === achievementId ? { ...ach, unlocked: true } : ach
      );
    });
    setShowAchievement(achievementId);
    createParticles(GAME_WIDTH / 2, GAME_HEIGHT / 2, "#4ade80", 20, "sparkle");
    setTimeout(() => setShowAchievement(null), 3000);
  }, [createParticles]);

  // ─── Game Logic ────────────────────────────────────────────────────────────

  const handleCombo = useCallback(() => {
    comboRef.current += 1;
    const newCombo = comboRef.current;
    setCombo(newCombo);
    
    if (newCombo > bestComboRef.current) {
      bestComboRef.current = newCombo;
    }

    const newMultiplier = Math.min(Math.floor(newCombo / 4) + 1, 5);
    setMultiplier(newMultiplier);

    if (newCombo > 0 && newCombo % 3 === 0) {
      createParticles(60, birdRef.current.y, "#fbbf24", 8, "sparkle");
    }

    if (newCombo === 1) unlockAchievement("first_pipe");
    if (newCombo === 5) unlockAchievement("combo_5");
    if (newCombo === 10) unlockAchievement("combo_10");
    if (newCombo === 15) unlockAchievement("combo_15");
    
    if (consecutivePassesRef.current >= 10) {
      unlockAchievement("no_hit_10");
    }
  }, [unlockAchievement, createParticles]);

  // ─── Drawing Functions ────────────────────────────────────────────────────

  const drawBackground = useCallback((ctx: CanvasRenderingContext2D, time: number) => {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    const hue = 220 + Math.sin(time * 0.0001) * 10;
    bgGrad.addColorStop(0, `hsl(${hue}, 70%, 8%)`);
    bgGrad.addColorStop(0.5, `hsl(${hue + 20}, 60%, 15%)`);
    bgGrad.addColorStop(1, `hsl(${hue - 20}, 70%, 8%)`);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    for (let i = 0; i < 50; i++) {
      const x = (i * 137.5 + i * i * 0.1) % GAME_WIDTH;
      const y = (i * 97.3 + i * i * 0.05) % GAME_HEIGHT;
      const size = 0.5 + Math.sin(time * 0.001 + i) * 0.5;
      const alpha = 0.1 + Math.sin(time * 0.002 + i * 1.5) * 0.1;
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = `rgba(56, 189, 248, ${0.02 + Math.sin(time * 0.0005) * 0.01})`;
    ctx.lineWidth = 0.5;
    const offset = (time * 0.02) % 100;
    for (let i = -100; i < GAME_WIDTH + 100; i += 50) {
      ctx.beginPath();
      ctx.moveTo(i + offset, 0);
      ctx.lineTo(i + offset, GAME_HEIGHT);
      ctx.stroke();
    }
    for (let i = -100; i < GAME_HEIGHT + 100; i += 50) {
      ctx.beginPath();
      ctx.moveTo(0, i + offset * 0.5);
      ctx.lineTo(GAME_WIDTH, i + offset * 0.5);
      ctx.stroke();
    }
  }, []);

  const drawBird = useCallback((ctx: CanvasRenderingContext2D, time: number) => {
    const bird = birdRef.current;
    ctx.save();
    ctx.translate(60, bird.y);
    ctx.rotate((bird.rotation * Math.PI) / 180);

    const wingAngle = gameStarted && !gameOver 
      ? Math.sin(time * 0.01 + bird.flapAnimation) * 0.3
      : 0;

    const glowColor = shield ? "#4ade80" : "#fbbf24";
    const glowSize = shield ? 30 : 25;
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, glowSize);
    glow.addColorStop(0, `${glowColor}40`);
    glow.addColorStop(1, `${glowColor}00`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, glowSize, 0, Math.PI * 2);
    ctx.fill();

    const birdGrad = ctx.createRadialGradient(-5, -5, 0, 0, 0, 16);
    birdGrad.addColorStop(0, shield ? "#86efac" : "#fde68a");
    birdGrad.addColorStop(0.7, shield ? "#22c55e" : "#f59e0b");
    birdGrad.addColorStop(1, shield ? "#15803d" : "#b45309");
    ctx.fillStyle = birdGrad;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = shield ? "#4ade80" : "#fbbf24";
    ctx.beginPath();
    ctx.ellipse(-5, -2 + wingAngle * 8, 12, 6, -0.3 + wingAngle, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(8, -3, 4.5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(10, -4.5, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(7, -2, 1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f97316";
    ctx.beginPath();
    ctx.moveTo(15, 2);
    ctx.lineTo(20, 3);
    ctx.lineTo(15, 6);
    ctx.fill();

    ctx.restore();

    if (shield) {
      ctx.save();
      ctx.strokeStyle = `rgba(74, 222, 128, ${0.3 + Math.sin(time * 0.005) * 0.1})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.lineDashOffset = -time * 0.05;
      ctx.beginPath();
      ctx.arc(60, bird.y, 25, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }, [gameStarted, gameOver, shield]);

  const drawPipes = useCallback((ctx: CanvasRenderingContext2D, time: number) => {
    const gap = diffConfigRef.current.pipeGap;
    pipeRef.current.forEach((pipe, index) => {
      const grad = ctx.createLinearGradient(pipe.x, 0, pipe.x + PIPE_WIDTH, 0);
      const alpha = 0.8 + Math.sin(time * 0.001 + index) * 0.1;
      grad.addColorStop(0, `rgba(16, 185, 129, ${alpha})`);
      grad.addColorStop(0.5, `rgba(52, 211, 153, ${alpha})`);
      grad.addColorStop(1, `rgba(16, 185, 129, ${alpha})`);

      ctx.fillStyle = grad;
      ctx.shadowColor = "rgba(16, 185, 129, 0.3)";
      ctx.shadowBlur = 15;

      const radius = 6;
      ctx.beginPath();
      ctx.moveTo(pipe.x + radius, 0);
      ctx.lineTo(pipe.x + PIPE_WIDTH - radius, 0);
      ctx.quadraticCurveTo(pipe.x + PIPE_WIDTH, 0, pipe.x + PIPE_WIDTH, radius);
      ctx.lineTo(pipe.x + PIPE_WIDTH, pipe.gapY);
      ctx.quadraticCurveTo(pipe.x + PIPE_WIDTH, pipe.gapY + radius, pipe.x + PIPE_WIDTH - radius, pipe.gapY + radius);
      ctx.lineTo(pipe.x + radius, pipe.gapY + radius);
      ctx.quadraticCurveTo(pipe.x, pipe.gapY + radius, pipe.x, pipe.gapY);
      ctx.lineTo(pipe.x, radius);
      ctx.quadraticCurveTo(pipe.x, 0, pipe.x + radius, 0);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(pipe.x + radius, pipe.gapY + gap - radius);
      ctx.lineTo(pipe.x + PIPE_WIDTH - radius, pipe.gapY + gap - radius);
      ctx.quadraticCurveTo(pipe.x + PIPE_WIDTH, pipe.gapY + gap - radius, pipe.x + PIPE_WIDTH, pipe.gapY + gap);
      ctx.lineTo(pipe.x + PIPE_WIDTH, GAME_HEIGHT);
      ctx.lineTo(pipe.x, GAME_HEIGHT);
      ctx.lineTo(pipe.x, pipe.gapY + gap);
      ctx.quadraticCurveTo(pipe.x, pipe.gapY + gap - radius, pipe.x + radius, pipe.gapY + gap - radius);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = `rgba(16, 185, 129, ${0.05 + Math.sin(time * 0.002 + index) * 0.02})`;
      ctx.fillRect(pipe.x + 5, 0, 4, pipe.gapY);
      ctx.fillRect(pipe.x + 5, pipe.gapY + gap, 4, GAME_HEIGHT - pipe.gapY - gap);
    });
  }, []);

  const drawPowerUps = useCallback((ctx: CanvasRenderingContext2D, time: number) => {
    powerUps.forEach((pu) => {
      if (pu.collected) return;
      
      const colors = {
        shield: { main: "#4ade80", glow: "rgba(74,222,128,0.3)" },
        slow: { main: "#38bdf8", glow: "rgba(56,189,248,0.3)" },
        magnet: { main: "#a78bfa", glow: "rgba(167,139,250,0.3)" },
        double: { main: "#f472b6", glow: "rgba(244,114,182,0.3)" },
      };
      
      const color = colors[pu.type as keyof typeof colors] || colors.shield;
      const bob = Math.sin(time * 0.003 + pu.bobPhase) * 5;
      
      ctx.shadowColor = color.main;
      ctx.shadowBlur = 25;
      
      ctx.strokeStyle = color.glow;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5 + Math.sin(time * 0.004 + pu.bobPhase) * 0.2;
      ctx.beginPath();
      ctx.arc(pu.x + PIPE_WIDTH / 2, pu.y + bob, 14, 0, Math.PI * 2);
      ctx.stroke();
      
      ctx.fillStyle = color.main;
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(pu.x + PIPE_WIDTH / 2, pu.y + bob, 10, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fff";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      
      const icons = {
        shield: "🛡",
        slow: "⏱",
        magnet: "🧲",
        double: "✖️",
      };
      ctx.fillText(icons[pu.type as keyof typeof icons] || "⭐", pu.x + PIPE_WIDTH / 2, pu.y + bob + 1);
      
      ctx.globalAlpha = 1;
    });
  }, [powerUps]);

  const drawHUD = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.font = "bold 18px 'Courier New', monospace";
    ctx.textAlign = "left";
    
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.roundRect(10, 10, 150, 110, 8);
    ctx.fill();
    
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillText(`🏆 ${scoreRef.current}`, 20, 38);
    
    ctx.font = "14px 'Courier New', monospace";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(`🔥 ${comboRef.current}x`, 20, 62);
    ctx.fillText(`⭐ x${multiplier}`, 20, 86);
    
    const dc = diffConfigRef.current;
    const diffColors: Record<string, string> = { easy: "#4ade80", medium: "#fbbf24", hard: "#f87171" };
    ctx.fillStyle = diffColors[difficulty] || "#9ca3af";
    ctx.font = "11px 'Courier New', monospace";
    ctx.fillText(`${dc.label.toUpperCase()}`, 20, 108);
    
    if (multiplier > 1) {
      const colors = ["#f59e0b", "#f97316", "#ef4444", "#ec4899"];
      const colorIndex = Math.min(multiplier - 2, colors.length - 1);
      ctx.fillStyle = colors[colorIndex];
      ctx.font = "bold 24px 'Courier New', monospace";
      ctx.textAlign = "right";
      ctx.fillText(`x${multiplier}`, GAME_WIDTH - 20, 40);
    }
    
    let powerY = 130;
    ctx.textAlign = "left";
    ctx.font = "12px 'Courier New', monospace";
    
    if (shield) {
      ctx.fillStyle = "#4ade80";
      ctx.fillText("🛡 SHIELD", 20, powerY);
      powerY += 20;
    }
    if (slowMode) {
      ctx.fillStyle = "#38bdf8";
      ctx.fillText("⏱ SLOW", 20, powerY);
      powerY += 20;
    }
    if (doublePoints) {
      ctx.fillStyle = "#f472b6";
      ctx.fillText("✖️ DOUBLE", 20, powerY);
    }
  }, [shield, slowMode, doublePoints, multiplier, difficulty]);

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const time = performance.now();
    frameCountRef.current++;

    // ── Update ──────────────────────────────────────────────────────────────

    const bird = birdRef.current;
    const dc = diffConfigRef.current;
    const currentSpeed = slowMode ? speedRef.current * 0.4 : speedRef.current;
    
    const gravity = slowMode ? dc.gravity * 0.4 : dc.gravity;
    bird.velocity += gravity;
    bird.y += bird.velocity;
    bird.rotation = Math.min(Math.max(bird.velocity * 4, -30), 60);
    bird.flapAnimation += 0.2;

    if (screenShake > 0) {
      setScreenShake(prev => Math.max(0, prev * 0.9));
    }

    // ── Collision ──────────────────────────────────────────────────────────

    if (bird.y - 13 < 0) {
      bird.y = 13;
      bird.velocity = 0;
      if (!shield) {
        endGame();
        return;
      } else {
        setShield(false);
        createParticles(60, bird.y, "#4ade80", 15);
        bird.velocity = 2;
      }
    }
    
    if (bird.y + 13 > GAME_HEIGHT) {
      bird.y = GAME_HEIGHT - 13;
      bird.velocity = 0;
      if (!shield) {
        endGame();
        return;
      } else {
        setShield(false);
        createParticles(60, bird.y, "#4ade80", 15);
        bird.velocity = -5;
      }
    }

    // ── Pipe Logic ────────────────────────────────────────────────────────

    const pipesToRemove: number[] = [];
    pipeRef.current.forEach((pipe, index) => {
      pipe.x -= currentSpeed;

      if (!pipe.scored && pipe.x + PIPE_WIDTH < 60) {
        pipe.scored = true;
        consecutivePassesRef.current++;
        
        const points = doublePoints ? 20 : 10;
        const totalPoints = points * multiplier;
        scoreRef.current += totalPoints;
        setScore(scoreRef.current);
        
        handleCombo();
        createParticles(60, bird.y, "#fbbf24", 15, "burst");

        if (scoreRef.current >= 50) unlockAchievement("score_50");
        if (scoreRef.current >= 100) unlockAchievement("score_100");
        
        if (scoreRef.current > highScore) {
          setHighScore(scoreRef.current);
        }
      }

      if (!pipe.passed) {
        const birdLeft = 60 - 13;
        const birdRight = 60 + 13;
        const pipeLeft = pipe.x;
        const pipeRight = pipe.x + PIPE_WIDTH;
        
        if (birdRight > pipeLeft && birdLeft < pipeRight) {
          if (bird.y - 13 < pipe.gapY || bird.y + 13 > pipe.gapY + dc.pipeGap) {
            if (!shield) {
              pipe.passed = true;
              endGame();
              return;
            } else {
              setShield(false);
              createParticles(60, bird.y, "#4ade80", 15, "burst");
              bird.velocity = -6;
            }
          }
        }
      }

      if (pipe.x + PIPE_WIDTH < 0) {
        pipesToRemove.push(index);
      }
    });

    pipeRef.current = pipeRef.current.filter((_, index) => !pipesToRemove.includes(index));

    // ── Spawn Pipes ───────────────────────────────────────────────────────

    const lastPipe = pipeRef.current[pipeRef.current.length - 1];
    if (!lastPipe || lastPipe.x < GAME_WIDTH - dc.pipeSpacing) {
      const minGap = Math.max(dc.pipeGap - 30, 100);
      const maxGap = dc.pipeGap;
      const gapSize = minGap + (maxGap - minGap) * (1 - Math.min(scoreRef.current / 200, 0.3));
      const gapY = Math.random() * (GAME_HEIGHT - gapSize - 80) + 40;
      
      pipeRef.current.push({
        x: GAME_WIDTH,
        gapY,
        scored: false,
        passed: false,
      });

      if (Math.random() < 0.15 && consecutivePassesRef.current > 3) {
        const types: Array<"shield" | "slow" | "magnet" | "double"> = [
          "shield", "slow", "magnet", "double"
        ];
        const randomType = types[Math.floor(Math.random() * types.length)];
        setPowerUps((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random()}`,
            x: GAME_WIDTH + PIPE_WIDTH,
            y: gapY + gapSize / 2 + (Math.random() - 0.5) * 60,
            type: randomType,
            collected: false,
            bobPhase: Math.random() * Math.PI * 2,
          },
        ]);
      }
    }

    // ── Update Power-ups ──────────────────────────────────────────────────

    setPowerUps((prevPowerUps) =>
      prevPowerUps.map((pu) => {
        if (!pu.collected) {
          pu.x -= currentSpeed;
          
          const dx = 60 - (pu.x + PIPE_WIDTH / 2);
          const dy = bird.y - pu.y;
          if (Math.hypot(dx, dy) < 25) {
            createParticles(pu.x + PIPE_WIDTH / 2, pu.y, "#a78bfa", 15, "sparkle");
            
            switch (pu.type) {
              case "shield":
                setShield(true);
                setTimeout(() => setShield(false), 5000);
                break;
              case "slow":
                setSlowMode(true);
                setTimeout(() => setSlowMode(false), 3000);
                break;
              case "magnet":
                scoreRef.current += 30;
                setScore(scoreRef.current);
                createParticles(60, bird.y, "#f472b6", 20, "burst");
                break;
              case "double":
                setDoublePoints(true);
                setTimeout(() => setDoublePoints(false), 4000);
                break;
            }
            
            return { ...pu, collected: true };
          }
        }
        return pu;
      })
    );

    setPowerUps((prev) => prev.filter((pu) => !pu.collected || pu.x > -50));

    if (gameStarted && !gameOver) {
      createTrail(60, bird.y);
    }

    // ── Draw ──────────────────────────────────────────────────────────────

    ctx.save();
    if (screenShake > 0.5) {
      const shake = screenShake * 0.5;
      ctx.translate(
        (Math.random() - 0.5) * shake * 2,
        (Math.random() - 0.5) * shake * 2
      );
    }

    drawBackground(ctx, time);
    drawPipes(ctx, time);
    drawPowerUps(ctx, time);
    
    ctx.shadowBlur = 0;
    particlesRef.current = particlesRef.current.filter((p) => p.life > 0);
    particlesRef.current.forEach((p) => {
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      
      if (p.type === "sparkle") {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        const size = p.size * (p.life / p.maxLife);
        ctx.fillRect(p.x - size/2, p.y - size/2, size, size);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
        ctx.fill();
      }
      
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      p.life -= 0.02;
    });
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    drawBird(ctx, time);
    drawHUD(ctx);

    difficultyTimerRef.current += 1;
    if (difficultyTimerRef.current % 60 === 0 && speedRef.current < dc.maxSpeed) {
      speedRef.current = Math.min(speedRef.current + 0.02, dc.maxSpeed);
    }

    // ── Draw Overlays ────────────────────────────────────────────────────

    if (!gameStarted && !showDifficultySelect) {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      
      ctx.font = "bold 32px 'Courier New', monospace";
      ctx.fillStyle = "#fbbf24";
      ctx.textAlign = "center";
      ctx.shadowColor = "#fbbf24";
      ctx.shadowBlur = 20;
      ctx.fillText("🐦 FLAPPY", GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60);
      
      ctx.shadowBlur = 0;
      ctx.font = "18px 'Courier New', monospace";
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.fillText("Click or Space to Fly", GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20);
      
      ctx.font = "14px 'Courier New', monospace";
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillText("🏆 Collect power-ups for bonuses", GAME_WIDTH / 2, GAME_HEIGHT / 2 + 70);
    }

    ctx.restore();

    // ── Loop ──────────────────────────────────────────────────────────────

    if (!gameOver) {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
  }, [
    gameStarted, gameOver, shield, slowMode, doublePoints, multiplier,
    createParticles, createTrail, handleCombo, unlockAchievement,
    drawBackground, drawPipes, drawPowerUps, drawBird, drawHUD,
    highScore, screenShake, endGame, showDifficultySelect
  ]);

  // ─── Input Handlers ──────────────────────────────────────────────────────

  const handleJump = useCallback(() => {
    if (gamePhase === "results") {
      // Don't allow interaction during results
      return;
    }

    const dc = DIFFICULTY_CONFIGS[difficulty];

    if (!gameStarted) {
      setGameStarted(true);
      setShowDifficultySelect(false);
      birdRef.current.velocity = dc.jumpStrength;
      scoreRef.current = 0;
      setScore(0);
      comboRef.current = 0;
      setCombo(0);
      setMultiplier(1);
      consecutivePassesRef.current = 0;
      bestComboRef.current = 0;
      diffConfigRef.current = dc;
      speedRef.current = dc.baseSpeed;
      difficultyTimerRef.current = 0;
      pipeRef.current = [];
      setPowerUps([]);
      setShield(false);
      setSlowMode(false);
      setDoublePoints(false);
      createParticles(60, birdRef.current.y, "#fbbf24", 20, "burst");
      
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    } else if (!gameOver) {
      birdRef.current.velocity = dc.jumpStrength * (slowMode ? 0.8 : 1);
      createParticles(60, birdRef.current.y, "#38bdf8", 8, "sparkle");
    } else {
      resetGame();
      setGameStarted(true);
      setShowDifficultySelect(false);
      birdRef.current.velocity = dc.jumpStrength;
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
  }, [gameStarted, gameOver, slowMode, createParticles, gameLoop, resetGame, gamePhase, difficulty]);

  // ─── Effects ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        handleJump();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [handleJump]);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center gap-4 sm:gap-6 w-full max-w-[500px] mx-auto px-2 sm:px-0">
      <div className="relative w-full">
        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          onClick={handleJump}
          onTouchStart={(e) => { e.preventDefault(); handleJump(); }}
          className="rounded-2xl shadow-2xl cursor-pointer border border-cyan-400/30 hover:border-cyan-400/60 transition-all w-full h-auto"
          style={{ background: "#0f0f1e", maxWidth: "100%", touchAction: "manipulation" }}
        />
        
        {/* Difficulty Selector */}
        {showDifficultySelect && !gameStarted && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 sm:gap-5 px-4 sm:px-6"
            style={{ background: "rgba(10,6,25,0.95)" }}
          >
            <div className="text-4xl sm:text-5xl">🐦</div>
            <p className="font-mono-arc text-base sm:text-lg font-bold text-amber-400 uppercase tracking-wider text-center" style={{ textShadow: "0 0 20px rgba(251,191,36,0.4)" }}>
              Flappy Bird
            </p>
            <p className="font-mono-arc text-[8px] sm:text-[9px] text-gray-500 uppercase tracking-[0.2em]">Select difficulty</p>
            <div className="flex gap-2 sm:gap-3 w-full px-2 justify-center">
              {(["easy", "medium", "hard"] as Difficulty[]).map((d) => {
                const config = DIFFICULTY_CONFIGS[d];
                const selected = difficulty === d;
                return (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`flex-1 sm:flex-none px-3 sm:px-5 py-3 sm:py-3 rounded-lg font-mono-arc text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all ${
                      selected
                        ? "scale-105 sm:scale-110"
                        : "opacity-50 hover:opacity-80"
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
                      {d === "easy" ? "Relaxed" : d === "medium" ? "Balanced" : "Intense"}
                    </p>
                  </button>
                );
              })}
            </div>
            <button
              onClick={handleJump}
              className="font-mono-arc text-sm sm:text-xs font-bold uppercase tracking-widest w-[80%] sm:w-auto px-8 py-4 sm:py-3 rounded-lg transition-all hover:opacity-90 active:scale-95 mt-4"
              style={{
                background: "linear-gradient(135deg,#7c3aed,#a78bfa)",
                color: "#fff",
                boxShadow: "0 0 24px rgba(167,139,250,0.3)",
              }}
            >
              Start Game →
            </button>
            <p className="font-mono-arc text-[8px] text-gray-600 mt-1">
              or tap the screen
            </p>
          </div>
        )}
        
        {/* XP Claim Screen Overlay */}
        {gamePhase === "results" && (
          <div className="absolute inset-0">
            <XPClaimScreen
              score={finalScore}
              xpEarned={xpEarned}
              onClaim={() => {
                resetGame();
                onGameComplete(finalScore);
              }}
            />
          </div>
        )}
        
        {/* Achievement Pop-up */}
        {showAchievement && gamePhase === "playing" && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 animate-pulse z-10">
            <div
              className="px-6 py-3 rounded-xl border border-green-400/50 backdrop-blur-md"
              style={{ 
                background: "rgba(16, 185, 129, 0.15)",
                boxShadow: "0 0 40px rgba(16, 185, 129, 0.2)"
              }}
            >
              <p className="font-mono-arc text-xs text-green-400 font-bold tracking-wider">
                🏆 ACHIEVEMENT UNLOCKED
              </p>
              <p className="font-mono-arc text-sm text-green-300 font-semibold">
                {achievements.find((a) => a.id === showAchievement)?.name}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="text-center w-full px-2">
        <div className="flex gap-3 sm:gap-6 justify-center items-center mb-4">
          <div className="min-w-0">
            <p className="font-mono-arc text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">Score</p>
            <p className="font-mono-arc text-xl sm:text-2xl font-bold text-cyan-400">{score}</p>
          </div>
          <div className="w-px h-8 bg-gray-700 flex-shrink-0"/>
          <div className="min-w-0">
            <p className="font-mono-arc text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">Combo</p>
            <p className="font-mono-arc text-xl sm:text-2xl font-bold text-yellow-400">{combo}x</p>
          </div>
          <div className="w-px h-8 bg-gray-700 flex-shrink-0"/>
          <div className="min-w-0">
            <p className="font-mono-arc text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider">Multiplier</p>
            <p className="font-mono-arc text-xl sm:text-2xl font-bold text-orange-400">x{multiplier}</p>
          </div>
        </div>
        
        {/* Achievement Display */}
        <div className="flex gap-1.5 justify-center flex-wrap mb-3 max-w-full">
          {achievements.map((ach) => (
            <div
              key={ach.id}
              className={`px-1.5 sm:px-2 py-1 rounded text-[8px] sm:text-[10px] font-mono-arc transition-all whitespace-nowrap ${
                ach.unlocked
                  ? "bg-green-500/20 text-green-400 border border-green-400/50 scale-100"
                  : "bg-gray-500/10 text-gray-500 border border-gray-500/30 scale-95 opacity-50"
              }`}
            >
              {ach.unlocked ? "✓" : "○"} {ach.name}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}