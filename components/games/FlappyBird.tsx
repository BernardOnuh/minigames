"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { GameProps } from "../../app/game/[gameId]/page";

const GRAVITY = 0.5;
const JUMP_STRENGTH = -10;
const PIPE_WIDTH = 80;
const PIPE_GAP = 140;
const PIPE_SPACING = 280;
const GAME_WIDTH = 500;
const GAME_HEIGHT = 700;

type Bird = {
  y: number;
  velocity: number;
  rotation: number;
};

type Pipe = {
  x: number;
  gapY: number;
  scored: boolean;
};

type PowerUp = {
  id: string;
  x: number;
  y: number;
  type: "shield" | "slow" | "magnet";
  collected: boolean;
};

type Achievement = {
  id: string;
  name: string;
  unlocked: boolean;
  progress: number;
};

export default function FlappyBirdGameEnhanced({
  gameConfig,
  onGameComplete,
  onGameFail,
}: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameLoopRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);

  const [score, setScore] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [combo, setCombo] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [shield, setShield] = useState(false);
  const [slowMode, setSlowMode] = useState(false);
  const [achievements, setAchievements] = useState<Achievement[]>([
    { id: "first_pipe", name: "First Flight", unlocked: false, progress: 0 },
    { id: "combo_5", name: "On a Roll", unlocked: false, progress: 0 },
    { id: "combo_10", name: "Unstoppable", unlocked: false, progress: 0 },
    { id: "score_100", name: "Century Club", unlocked: false, progress: 0 },
  ]);
  const [powerUps, setPowerUps] = useState<PowerUp[]>([]);
  const [showAchievement, setShowAchievement] = useState<string | null>(null);

  const birdRef = useRef<Bird>({
    y: GAME_HEIGHT / 2,
    velocity: 0,
    rotation: 0,
  });

  const pipeRef = useRef<Pipe[]>([]);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const consecutivePassesRef = useRef(0);

  // Particle system
  type Particle = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    color: string;
  };

  const createParticles = useCallback((x: number, y: number, color: string, count: number = 8) => {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * 3,
        vy: Math.sin(angle) * 3,
        life: 1,
        maxLife: 1,
        color,
      });
    }
  }, []);

  const unlockAchievement = useCallback(
    (achievementId: string) => {
      setAchievements((prev) =>
        prev.map((ach) =>
          ach.id === achievementId && !ach.unlocked
            ? { ...ach, unlocked: true }
            : ach
        )
      );
      setShowAchievement(achievementId);
      setTimeout(() => setShowAchievement(null), 3000);
    },
    []
  );

  const handleCombo = useCallback(() => {
    comboRef.current += 1;
    const newCombo = comboRef.current;
    setCombo(newCombo);

    // Update multiplier based on combo
    const newMultiplier = Math.floor(newCombo / 5) + 1;
    setMultiplier(newMultiplier);

    // Unlock achievements
    if (newCombo === 1) {
      unlockAchievement("first_pipe");
    }
    if (newCombo === 5) {
      unlockAchievement("combo_5");
    }
    if (newCombo === 10) {
      unlockAchievement("combo_10");
    }
  }, [unlockAchievement]);

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    // Modern gradient background with grid
    const bgGrad = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    bgGrad.addColorStop(0, "#0a0e27");
    bgGrad.addColorStop(0.5, "#1a1f3a");
    bgGrad.addColorStop(1, "#0f1428");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Animated grid background
    ctx.strokeStyle = "rgba(56, 189, 248, 0.05)";
    ctx.lineWidth = 1;
    for (let i = 0; i < GAME_WIDTH; i += 50) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, GAME_HEIGHT);
      ctx.stroke();
    }
    for (let i = 0; i < GAME_HEIGHT; i += 50) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(GAME_WIDTH, i);
      ctx.stroke();
    }

    // Draw ambient glow circles
    ctx.fillStyle = "rgba(120, 119, 198, 0.04)";
    ctx.beginPath();
    ctx.arc(GAME_WIDTH / 2, GAME_HEIGHT / 2, 200, 0, Math.PI * 2);
    ctx.fill();

    // Draw bird with neon glow
    const bird = birdRef.current;
    ctx.save();
    ctx.translate(60, bird.y);
    ctx.rotate((bird.rotation * Math.PI) / 180);

    // Neon glow effect
    if (!gameOver) {
      ctx.shadowColor = shield ? "#4ade80" : "#fbbf24";
      ctx.shadowBlur = 20;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    // Bird body with gradient
    const birdGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 15);
    birdGrad.addColorStop(0, shield ? "#4ade80" : "#fbbf24");
    birdGrad.addColorStop(1, shield ? "#22c55e" : "#f59e0b");
    ctx.fillStyle = birdGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 15, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Outer glow ring
    ctx.strokeStyle = shield ? "rgba(74,222,128,0.6)" : "rgba(251,191,36,0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Bird eye
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(8, -3, 4, 0, Math.PI * 2);
    ctx.fill();

    // Eye shine
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(10, -4, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Draw power-ups
    powerUps.forEach((pu) => {
      if (!pu.collected) {
        const colors = {
          shield: "#4ade80",
          slow: "#38bdf8",
          magnet: "#a78bfa",
        };
        ctx.fillStyle = colors[pu.type];
        ctx.shadowColor = colors[pu.type];
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(pu.x + PIPE_WIDTH / 2, pu.y, 8, 0, Math.PI * 2);
        ctx.fill();

        // Rotating square around it
        ctx.strokeStyle = colors[pu.type];
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.5;
        const time = Date.now() / 1000;
        const rotation = (time * 2) % (Math.PI * 2);
        ctx.save();
        ctx.translate(pu.x + PIPE_WIDTH / 2, pu.y);
        ctx.rotate(rotation);
        ctx.strokeRect(-12, -12, 24, 24);
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    });

    // Draw particles
    particlesRef.current = particlesRef.current.filter((p) => p.life > 0);
    particlesRef.current.forEach((p) => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.2;
      p.life -= 0.02;
    });
    ctx.globalAlpha = 1;

    // Draw modern pipes with neon glow
    ctx.globalAlpha = 0.95;
    pipeRef.current.forEach((pipe) => {
      const pipeGrad = ctx.createLinearGradient(pipe.x, 0, pipe.x + PIPE_WIDTH, 0);
      pipeGrad.addColorStop(0, "#10b981");
      pipeGrad.addColorStop(0.5, "#34d399");
      pipeGrad.addColorStop(1, "#10b981");

      ctx.fillStyle = pipeGrad;
      ctx.shadowColor = "rgba(16, 185, 129, 0.5)";
      ctx.shadowBlur = 15;

      // Top pipe
      ctx.beginPath();
      ctx.moveTo(pipe.x + 8, 0);
      ctx.lineTo(pipe.x + PIPE_WIDTH - 8, 0);
      ctx.quadraticCurveTo(pipe.x + PIPE_WIDTH, 0, pipe.x + PIPE_WIDTH, 8);
      ctx.lineTo(pipe.x + PIPE_WIDTH, pipe.gapY);
      ctx.quadraticCurveTo(
        pipe.x + PIPE_WIDTH,
        pipe.gapY - 8,
        pipe.x + PIPE_WIDTH - 8,
        pipe.gapY
      );
      ctx.lineTo(pipe.x + 8, pipe.gapY);
      ctx.quadraticCurveTo(pipe.x, pipe.gapY, pipe.x, pipe.gapY - 8);
      ctx.lineTo(pipe.x, 8);
      ctx.quadraticCurveTo(pipe.x, 0, pipe.x + 8, 0);
      ctx.fill();

      // Bottom pipe
      ctx.beginPath();
      ctx.moveTo(pipe.x + 8, pipe.gapY + PIPE_GAP);
      ctx.lineTo(pipe.x + PIPE_WIDTH - 8, pipe.gapY + PIPE_GAP);
      ctx.quadraticCurveTo(
        pipe.x + PIPE_WIDTH,
        pipe.gapY + PIPE_GAP,
        pipe.x + PIPE_WIDTH,
        pipe.gapY + PIPE_GAP + 8
      );
      ctx.lineTo(pipe.x + PIPE_WIDTH, GAME_HEIGHT);
      ctx.lineTo(pipe.x, GAME_HEIGHT);
      ctx.lineTo(pipe.x, pipe.gapY + PIPE_GAP + 8);
      ctx.quadraticCurveTo(
        pipe.x,
        pipe.gapY + PIPE_GAP,
        pipe.x + 8,
        pipe.gapY + PIPE_GAP
      );
      ctx.fill();
    });

    ctx.globalAlpha = 1;

    // Draw HUD
    ctx.font = "bold 14px 'Courier New', monospace";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.textAlign = "left";
    ctx.fillText(`SCORE: ${scoreRef.current}`, 20, 40);
    ctx.fillText(`COMBO: ${comboRef.current}`, 20, 65);
    ctx.fillText(`MULT: x${multiplier}`, 20, 90);

    // Draw multiplier indicator with color
    if (multiplier > 1) {
      ctx.fillStyle = multiplier > 2 ? "#ef4444" : "#f59e0b";
      ctx.font = "bold 20px 'Courier New', monospace";
      ctx.textAlign = "right";
      ctx.fillText(`x${multiplier}`, GAME_WIDTH - 20, 40);
    }

    // Draw slow mode indicator
    if (slowMode) {
      ctx.fillStyle = "rgba(56, 189, 248, 0.8)";
      ctx.font = "bold 12px 'Courier New', monospace";
      ctx.textAlign = "center";
      ctx.fillText("⏱ SLOW MODE", GAME_WIDTH / 2, 25);
    }

    // Instructions
    if (!gameStarted) {
      ctx.font = "20px 'Courier New', monospace";
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.textAlign = "center";
      ctx.fillText("CLICK OR SPACE", GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20);
      ctx.fillText("TO FLY", GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20);
    }

    // Game over screen
    if (gameOver) {
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      ctx.font = "bold 56px 'Courier New', monospace";
      ctx.fillStyle = "#ef4444";
      ctx.textAlign = "center";
      ctx.fillText("CRASHED", GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80);

      ctx.font = "bold 32px 'Courier New', monospace";
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`${scoreRef.current} PTS`, GAME_WIDTH / 2, GAME_HEIGHT / 2);
      
      ctx.font = "bold 20px 'Courier New', monospace";
      ctx.fillStyle = "#4ade80";
      ctx.fillText(`${comboRef.current} COMBO`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50);

      ctx.font = "16px 'Courier New', monospace";
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillText("CLICK TO RETRY", GAME_WIDTH / 2, GAME_HEIGHT / 2 + 100);
    }
  }, [gameStarted, gameOver]);

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bird = birdRef.current;

    // Apply slow mode
    const gravityMod = slowMode ? GRAVITY * 0.5 : GRAVITY;
    bird.velocity += gravityMod;
    bird.y += bird.velocity;
    bird.rotation = Math.min(bird.velocity * 5, 90);

    // Boundary check
    if (bird.y - 12 < 0 || bird.y + 12 > GAME_HEIGHT) {
      if (!shield) {
        setGameOver(true);
        onGameFail();
        return;
      } else {
        setShield(false);
        createParticles(60, bird.y, "#4ade80", 15);
      }
    }

    // Pipe logic
    const pipeSpeed = slowMode ? 2.5 : 5;
    pipeRef.current.forEach((pipe) => {
      pipe.x -= pipeSpeed;

      if (!pipe.scored && pipe.x + PIPE_WIDTH < 60) {
        pipe.scored = true;
        consecutivePassesRef.current += 1;
        
        // Score increases with combo
        const pointsEarned = 10 * multiplier;
        scoreRef.current += pointsEarned;
        setScore(scoreRef.current);
        
        handleCombo();
        createParticles(60, bird.y, "#fbbf24", 10);

        if (scoreRef.current >= 100 && !achievements[3].unlocked) {
          unlockAchievement("score_100");
        }
      }

      // Check collision
      if (
        60 + 12 > pipe.x &&
        60 - 12 < pipe.x + PIPE_WIDTH &&
        (bird.y - 12 < pipe.gapY || bird.y + 12 > pipe.gapY + PIPE_GAP)
      ) {
        if (!shield) {
          setGameOver(true);
          onGameFail();
          return;
        } else {
          setShield(false);
          createParticles(60, bird.y, "#4ade80", 15);
        }
      }
    });

    // Check power-up collisions
    setPowerUps((prevPowerUps) =>
      prevPowerUps.map((pu) => {
        if (
          !pu.collected &&
          Math.hypot(60 - (pu.x + PIPE_WIDTH / 2), bird.y - pu.y) < 20
        ) {
          createParticles(pu.x + PIPE_WIDTH / 2, pu.y, "#a78bfa", 12);
          
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
              scoreRef.current += 50;
              setScore(scoreRef.current);
              break;
          }
          
          return { ...pu, collected: true };
        }
        return pu;
      })
    );

    pipeRef.current = pipeRef.current.filter((p) => p.x > -PIPE_WIDTH);

    // Spawn new pipes with occasional power-ups
    if (
      pipeRef.current.length === 0 ||
      pipeRef.current[pipeRef.current.length - 1].x < GAME_WIDTH - PIPE_SPACING
    ) {
      const gapY = Math.random() * (GAME_HEIGHT - PIPE_GAP - 120) + 60;
      const newPipe: Pipe = {
        x: GAME_WIDTH,
        gapY,
        scored: false,
      };
      pipeRef.current.push(newPipe);

      // Random power-up spawn (20% chance)
      if (Math.random() < 0.2 && consecutivePassesRef.current > 2) {
        const types: Array<"shield" | "slow" | "magnet"> = [
          "shield",
          "slow",
          "magnet",
        ];
        const randomType = types[Math.floor(Math.random() * types.length)];
        setPowerUps((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random()}`,
            x: GAME_WIDTH,
            y: gapY + PIPE_GAP / 2,
            type: randomType,
            collected: false,
          },
        ]);
      }
    }

    draw(ctx);
    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [draw, onGameFail, multiplier, slowMode, shield, createParticles, handleCombo, unlockAchievement, achievements]);

  const handleJump = useCallback(() => {
    if (!gameStarted) {
      setGameStarted(true);
      birdRef.current.velocity = JUMP_STRENGTH;
      scoreRef.current = 0;
      setScore(0);
      comboRef.current = 0;
      setCombo(0);
      setMultiplier(1);
      consecutivePassesRef.current = 0;
      pipeRef.current = [];
      setPowerUps([]);
      setShield(false);
      setSlowMode(false);
    } else if (!gameOver) {
      birdRef.current.velocity = JUMP_STRENGTH;
      createParticles(60, birdRef.current.y, "#38bdf8", 6);
    } else {
      setGameOver(false);
      birdRef.current.y = GAME_HEIGHT / 2;
      birdRef.current.velocity = 0;
      birdRef.current.rotation = 0;
      scoreRef.current = 0;
      setScore(0);
      comboRef.current = 0;
      setCombo(0);
      setMultiplier(1);
      consecutivePassesRef.current = 0;
      pipeRef.current = [];
      setPowerUps([]);
      setShield(false);
      setSlowMode(false);
      setGameStarted(true);
    }
  }, [gameStarted, gameOver, createParticles]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        handleJump();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [handleJump]);

  useEffect(() => {
    if (gameStarted && !gameOver) {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
      return () => cancelAnimationFrame(gameLoopRef.current);
    }
  }, [gameStarted, gameOver, gameLoop]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    draw(ctx);
  }, [draw]);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          onClick={handleJump}
          className="rounded-2xl shadow-2xl cursor-pointer border border-cyan-400/30 hover:border-cyan-400/60 transition-all"
          style={{ background: "#0f0f1e" }}
        />
        
        {/* Achievement Pop-up */}
        {showAchievement && (
          <div className="absolute top-4 left-4 animate-pulse">
            <div
              className="px-4 py-3 rounded-lg border border-green-400/50 backdrop-blur-sm"
              style={{ background: "rgba(16, 185, 129, 0.1)" }}
            >
              <p className="font-mono-arc text-xs text-green-400 font-bold">
                🏆 ACHIEVEMENT UNLOCKED
              </p>
              <p className="font-mono-arc text-[11px] text-green-300">
                {
                  achievements.find((a) => a.id === showAchievement)
                    ?.name
                }
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="text-center">
        <p className="font-mono-arc text-sm text-gray-400 uppercase tracking-wider mb-3">
          Score: <span className="text-cyan-400 text-2xl font-bold">{score}</span>
        </p>
        <p className="text-xs text-gray-500 mb-3">
          Combo: {combo} | Multiplier: x{multiplier}
        </p>
        
        {/* Achievement Display */}
        <div className="flex gap-2 justify-center flex-wrap mb-3">
          {achievements.map((ach) => (
            <div
              key={ach.id}
              className={`px-2 py-1 rounded text-[10px] font-mono-arc ${
                ach.unlocked
                  ? "bg-green-500/20 text-green-400 border border-green-400/50"
                  : "bg-gray-500/10 text-gray-500 border border-gray-500/30"
              }`}
            >
              {ach.unlocked ? "✓" : "○"} {ach.name}
            </div>
          ))}
        </div>

        {gameOver && (
          <button
            onClick={handleJump}
            className="font-mono-arc text-xs font-bold uppercase tracking-wider px-6 py-2 rounded-lg transition-all bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-black"
          >
            Play Again ↻
          </button>
        )}
      </div>
    </div>
  );
}