"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { GameProps } from "../../app/game/[gameId]/page";

// ─── Constants ────────────────────────────────────────────────────────────────

const GRAVITY = 0.35; // Reduced from 0.5 for slower fall
const JUMP_STRENGTH = -8.5; // Adjusted for better feel
const PIPE_WIDTH = 70; // Slightly narrower
const PIPE_GAP = 160; // Increased for more forgiving gameplay
const PIPE_SPACING = 320; // More space between pipes
const BASE_SPEED = 3.5; // Slower base speed
const MAX_SPEED = 6.5; // Maximum speed cap
const GAME_WIDTH = 500;
const GAME_HEIGHT = 700;

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
  const speedRef = useRef(BASE_SPEED);
  const difficultyTimerRef = useRef(0);

  const [score, setScore] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [combo, setCombo] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [shield, setShield] = useState(false);
  const [slowMode, setSlowMode] = useState(false);
  const [doublePoints, setDoublePoints] = useState(false);
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

    // Update multiplier based on combo
    const newMultiplier = Math.min(Math.floor(newCombo / 4) + 1, 5);
    setMultiplier(newMultiplier);

    // Visual feedback for combo
    if (newCombo > 0 && newCombo % 3 === 0) {
      createParticles(60, birdRef.current.y, "#fbbf24", 8, "sparkle");
    }

    // Unlock achievements
    if (newCombo === 1) unlockAchievement("first_pipe");
    if (newCombo === 5) unlockAchievement("combo_5");
    if (newCombo === 10) unlockAchievement("combo_10");
    if (newCombo === 15) unlockAchievement("combo_15");
    
    // Perfect run achievement (10 consecutive without hitting anything)
    if (consecutivePassesRef.current >= 10) {
      unlockAchievement("no_hit_10");
    }
  }, [unlockAchievement, createParticles]);

  // ─── Drawing Functions ────────────────────────────────────────────────────

  const drawBackground = useCallback((ctx: CanvasRenderingContext2D, time: number) => {
    // Animated gradient background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    const hue = 220 + Math.sin(time * 0.0001) * 10;
    bgGrad.addColorStop(0, `hsl(${hue}, 70%, 8%)`);
    bgGrad.addColorStop(0.5, `hsl(${hue + 20}, 60%, 15%)`);
    bgGrad.addColorStop(1, `hsl(${hue - 20}, 70%, 8%)`);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Animated stars
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

    // Animated grid
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

    // Wing flap animation
    const wingAngle = gameStarted && !gameOver 
      ? Math.sin(time * 0.01 + bird.flapAnimation) * 0.3
      : 0;

    // Glow
    const glowColor = shield ? "#4ade80" : "#fbbf24";
    const glowSize = shield ? 30 : 25;
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, glowSize);
    glow.addColorStop(0, `${glowColor}40`);
    glow.addColorStop(1, `${glowColor}00`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, glowSize, 0, Math.PI * 2);
    ctx.fill();

    // Bird body
    const birdGrad = ctx.createRadialGradient(-5, -5, 0, 0, 0, 16);
    birdGrad.addColorStop(0, shield ? "#86efac" : "#fcd34d");
    birdGrad.addColorStop(0.7, shield ? "#22c55e" : "#f59e0b");
    birdGrad.addColorStop(1, shield ? "#15803d" : "#d97706");
    ctx.fillStyle = birdGrad;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wing
    ctx.shadowBlur = 0;
    ctx.fillStyle = shield ? "#4ade80" : "#fbbf24";
    ctx.beginPath();
    ctx.ellipse(-5, -2 + wingAngle * 8, 12, 6, -0.3 + wingAngle, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(8, -3, 4.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Eye shine
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(10, -4.5, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(7, -2, 1, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = "#f97316";
    ctx.beginPath();
    ctx.moveTo(15, 2);
    ctx.lineTo(20, 3);
    ctx.lineTo(15, 6);
    ctx.fill();

    ctx.restore();

    // Shield effect
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
    pipeRef.current.forEach((pipe, index) => {
      const grad = ctx.createLinearGradient(pipe.x, 0, pipe.x + PIPE_WIDTH, 0);
      const alpha = 0.8 + Math.sin(time * 0.001 + index) * 0.1;
      grad.addColorStop(0, `rgba(16, 185, 129, ${alpha})`);
      grad.addColorStop(0.5, `rgba(52, 211, 153, ${alpha})`);
      grad.addColorStop(1, `rgba(16, 185, 129, ${alpha})`);

      ctx.fillStyle = grad;
      ctx.shadowColor = "rgba(16, 185, 129, 0.3)";
      ctx.shadowBlur = 15;

      // Top pipe with rounded corners
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

      // Bottom pipe
      ctx.beginPath();
      ctx.moveTo(pipe.x + radius, pipe.gapY + PIPE_GAP - radius);
      ctx.lineTo(pipe.x + PIPE_WIDTH - radius, pipe.gapY + PIPE_GAP - radius);
      ctx.quadraticCurveTo(pipe.x + PIPE_WIDTH, pipe.gapY + PIPE_GAP - radius, pipe.x + PIPE_WIDTH, pipe.gapY + PIPE_GAP);
      ctx.lineTo(pipe.x + PIPE_WIDTH, GAME_HEIGHT);
      ctx.lineTo(pipe.x, GAME_HEIGHT);
      ctx.lineTo(pipe.x, pipe.gapY + PIPE_GAP);
      ctx.quadraticCurveTo(pipe.x, pipe.gapY + PIPE_GAP - radius, pipe.x + radius, pipe.gapY + PIPE_GAP - radius);
      ctx.fill();

      // Pipe glow effect
      ctx.shadowBlur = 0;
      ctx.fillStyle = `rgba(16, 185, 129, ${0.05 + Math.sin(time * 0.002 + index) * 0.02})`;
      ctx.fillRect(pipe.x + 5, 0, 4, pipe.gapY);
      ctx.fillRect(pipe.x + 5, pipe.gapY + PIPE_GAP, 4, GAME_HEIGHT - pipe.gapY - PIPE_GAP);
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
      
      // Glow
      ctx.shadowColor = color.main;
      ctx.shadowBlur = 25;
      
      // Outer ring
      ctx.strokeStyle = color.glow;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5 + Math.sin(time * 0.004 + pu.bobPhase) * 0.2;
      ctx.beginPath();
      ctx.arc(pu.x + PIPE_WIDTH / 2, pu.y + bob, 14, 0, Math.PI * 2);
      ctx.stroke();
      
      // Inner circle
      ctx.fillStyle = color.main;
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(pu.x + PIPE_WIDTH / 2, pu.y + bob, 10, 0, Math.PI * 2);
      ctx.fill();
      
      // Icon
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
    const score = scoreRef.current;
    
    // Score with gradient
    ctx.font = "bold 18px 'Courier New', monospace";
    ctx.textAlign = "left";
    
    // Score background
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.roundRect(10, 10, 150, 90, 8);
    ctx.fill();
    
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillText(`🏆 ${score}`, 20, 38);
    
    ctx.font = "14px 'Courier New', monospace";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(`🔥 ${comboRef.current}x`, 20, 62);
    ctx.fillText(`⭐ x${multiplier}`, 20, 86);
    
    // Multiplier indicator
    if (multiplier > 1) {
      const colors = ["#f59e0b", "#f97316", "#ef4444", "#ec4899"];
      const colorIndex = Math.min(multiplier - 2, colors.length - 1);
      ctx.fillStyle = colors[colorIndex];
      ctx.font = "bold 24px 'Courier New', monospace";
      ctx.textAlign = "right";
      ctx.fillText(`x${multiplier}`, GAME_WIDTH - 20, 40);
    }
    
    // Active power-ups
    let powerY = 110;
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
  }, [shield, slowMode, doublePoints, multiplier]);

  // ─── Main Game Loop ──────────────────────────────────────────────────────

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const time = performance.now();
    frameCountRef.current++;

    // ── Update ──────────────────────────────────────────────────────────────

    const bird = birdRef.current;
    const currentSpeed = slowMode ? speedRef.current * 0.4 : speedRef.current;
    
    // Physics
    const gravity = slowMode ? GRAVITY * 0.4 : GRAVITY;
    bird.velocity += gravity;
    bird.y += bird.velocity;
    bird.rotation = Math.min(Math.max(bird.velocity * 4, -30), 60);
    bird.flapAnimation += 0.2;

    // Screen shake decay
    if (screenShake > 0) {
      setScreenShake(prev => Math.max(0, prev * 0.9));
    }

    // ── Collision ──────────────────────────────────────────────────────────

    // Ground and ceiling
    if (bird.y - 13 < 0) {
      bird.y = 13;
      bird.velocity = 0;
      if (!shield) {
        setGameOver(true);
        onGameFail();
        setScreenShake(8);
        createParticles(60, bird.y, "#ef4444", 20);
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
        setGameOver(true);
        onGameFail();
        setScreenShake(8);
        createParticles(60, bird.y, "#ef4444", 20);
        return;
      } else {
        setShield(false);
        createParticles(60, bird.y, "#4ade80", 15);
        bird.velocity = -5;
      }
    }

    // ── Pipe Logic ────────────────────────────────────────────────────────

    // Move pipes and check collisions
    const pipesToRemove: number[] = [];
    pipeRef.current.forEach((pipe, index) => {
      pipe.x -= currentSpeed;

      // Score
      if (!pipe.scored && pipe.x + PIPE_WIDTH < 60) {
        pipe.scored = true;
        consecutivePassesRef.current++;
        
        const points = doublePoints ? 20 : 10;
        const totalPoints = points * multiplier;
        scoreRef.current += totalPoints;
        setScore(scoreRef.current);
        
        handleCombo();
        createParticles(60, bird.y, "#fbbf24", 15, "burst");

        // Score achievements
        if (scoreRef.current >= 50) unlockAchievement("score_50");
        if (scoreRef.current >= 100) unlockAchievement("score_100");
        
        // Update high score
        if (scoreRef.current > highScore) {
          setHighScore(scoreRef.current);
        }
      }

      // Collision
      if (!pipe.passed) {
        const birdLeft = 60 - 13;
        const birdRight = 60 + 13;
        const pipeLeft = pipe.x;
        const pipeRight = pipe.x + PIPE_WIDTH;
        
        if (birdRight > pipeLeft && birdLeft < pipeRight) {
          if (bird.y - 13 < pipe.gapY || bird.y + 13 > pipe.gapY + PIPE_GAP) {
            if (!shield) {
              pipe.passed = true;
              setGameOver(true);
              onGameFail();
              setScreenShake(10);
              createParticles(60, bird.y, "#ef4444", 25, "burst");
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

    // Remove off-screen pipes
    pipeRef.current = pipeRef.current.filter((_, index) => !pipesToRemove.includes(index));

    // ── Spawn Pipes ───────────────────────────────────────────────────────

    const lastPipe = pipeRef.current[pipeRef.current.length - 1];
    if (!lastPipe || lastPipe.x < GAME_WIDTH - PIPE_SPACING) {
      const minGap = 150;
      const maxGap = PIPE_GAP;
      const gapSize = minGap + (maxGap - minGap) * (1 - Math.min(scoreRef.current / 200, 0.3));
      const gapY = Math.random() * (GAME_HEIGHT - gapSize - 80) + 40;
      
      pipeRef.current.push({
        x: GAME_WIDTH,
        gapY,
        scored: false,
        passed: false,
      });

      // Power-up spawn (15% chance)
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
          
          // Check collection
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

    // Clean up collected power-ups
    setPowerUps((prev) => prev.filter((pu) => !pu.collected || pu.x > -50));

    // ── Trail particles ───────────────────────────────────────────────────

    if (gameStarted && !gameOver) {
      createTrail(60, bird.y);
    }

    // ── Draw ──────────────────────────────────────────────────────────────

    // Screen shake
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
    
    // Draw particles
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

    // ── Speed Management ─────────────────────────────────────────────────

    // Gradually increase speed up to max
    difficultyTimerRef.current += 1;
    if (difficultyTimerRef.current % 60 === 0 && speedRef.current < MAX_SPEED) {
      speedRef.current = Math.min(speedRef.current + 0.02, MAX_SPEED);
    }

    // ── Draw Overlays ────────────────────────────────────────────────────

    // Instructions
    if (!gameStarted) {
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

    // Game Over
    if (gameOver) {
      ctx.fillStyle = "rgba(0,0,0,0.8)";
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      
      ctx.shadowColor = "#ef4444";
      ctx.shadowBlur = 30;
      ctx.font = "bold 56px 'Courier New', monospace";
      ctx.fillStyle = "#ef4444";
      ctx.textAlign = "center";
      ctx.fillText("💥 GAME OVER", GAME_WIDTH / 2, GAME_HEIGHT / 2 - 100);
      
      ctx.shadowBlur = 0;
      ctx.font = "bold 32px 'Courier New', monospace";
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`${scoreRef.current} PTS`, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20);
      
      ctx.font = "20px 'Courier New', monospace";
      ctx.fillStyle = "#4ade80";
      ctx.fillText(`🔥 Best Combo: ${bestComboRef.current}x`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40);
      
      ctx.font = "16px 'Courier New', monospace";
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillText(`🏆 High Score: ${highScore}`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 90);
      
      ctx.font = "14px 'Courier New', monospace";
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillText("Click to Retry", GAME_WIDTH / 2, GAME_HEIGHT / 2 + 140);
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
    onGameFail, highScore, screenShake
  ]);

  // ─── Input Handlers ──────────────────────────────────────────────────────

  const handleJump = useCallback(() => {
    if (!gameStarted) {
      // Start game
      setGameStarted(true);
      birdRef.current.velocity = JUMP_STRENGTH;
      scoreRef.current = 0;
      setScore(0);
      comboRef.current = 0;
      setCombo(0);
      setMultiplier(1);
      consecutivePassesRef.current = 0;
      bestComboRef.current = 0;
      speedRef.current = BASE_SPEED;
      difficultyTimerRef.current = 0;
      pipeRef.current = [];
      setPowerUps([]);
      setShield(false);
      setSlowMode(false);
      setDoublePoints(false);
      createParticles(60, birdRef.current.y, "#fbbf24", 20, "burst");
      
      // Start loop
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    } else if (!gameOver) {
      birdRef.current.velocity = JUMP_STRENGTH * (slowMode ? 0.8 : 1);
      createParticles(60, birdRef.current.y, "#38bdf8", 8, "sparkle");
    } else {
      // Reset game
      setGameOver(false);
      birdRef.current.y = GAME_HEIGHT / 2;
      birdRef.current.velocity = 0;
      birdRef.current.rotation = 0;
      birdRef.current.flapAnimation = 0;
      scoreRef.current = 0;
      setScore(0);
      comboRef.current = 0;
      setCombo(0);
      setMultiplier(1);
      consecutivePassesRef.current = 0;
      speedRef.current = BASE_SPEED;
      difficultyTimerRef.current = 0;
      pipeRef.current = [];
      setPowerUps([]);
      setShield(false);
      setSlowMode(false);
      setDoublePoints(false);
      setScreenShake(0);
      setGameStarted(true);
      
      // Restart loop
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
  }, [gameStarted, gameOver, slowMode, createParticles, gameLoop]);

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

  // Initial draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const time = performance.now();
    drawBackground(ctx, time);
    drawBird(ctx, time);
    drawHUD(ctx);
    
    // Draw title overlay
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.font = "bold 36px 'Courier New', monospace";
    ctx.fillStyle = "#fbbf24";
    ctx.textAlign = "center";
    ctx.shadowColor = "#fbbf24";
    ctx.shadowBlur = 20;
    ctx.fillText("🐦 FLAPPY", GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30);
    ctx.shadowBlur = 0;
    ctx.font = "18px 'Courier New', monospace";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText("Click or Space to Start", GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40);
  }, [drawBackground, drawBird, drawHUD]);

  // ─── Render ──────────────────────────────────────────────────────────────

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

      <div className="text-center">
        <div className="flex gap-6 justify-center items-center mb-4">
          <div>
            <p className="font-mono-arc text-xs text-gray-500 uppercase tracking-wider">Score</p>
            <p className="font-mono-arc text-2xl font-bold text-cyan-400">{score}</p>
          </div>
          <div className="w-px h-8 bg-gray-700"/>
          <div>
            <p className="font-mono-arc text-xs text-gray-500 uppercase tracking-wider">Combo</p>
            <p className="font-mono-arc text-2xl font-bold text-yellow-400">{combo}x</p>
          </div>
          <div className="w-px h-8 bg-gray-700"/>
          <div>
            <p className="font-mono-arc text-xs text-gray-500 uppercase tracking-wider">Multiplier</p>
            <p className="font-mono-arc text-2xl font-bold text-orange-400">x{multiplier}</p>
          </div>
        </div>
        
        {/* Achievement Display */}
        <div className="flex gap-2 justify-center flex-wrap mb-3">
          {achievements.map((ach) => (
            <div
              key={ach.id}
              className={`px-2 py-1 rounded text-[10px] font-mono-arc transition-all ${
                ach.unlocked
                  ? "bg-green-500/20 text-green-400 border border-green-400/50 scale-100"
                  : "bg-gray-500/10 text-gray-500 border border-gray-500/30 scale-95 opacity-50"
              }`}
            >
              {ach.unlocked ? "✓" : "○"} {ach.name}
            </div>
          ))}
        </div>

        {gameOver && (
          <button
            onClick={handleJump}
            className="font-mono-arc text-xs font-bold uppercase tracking-wider px-6 py-2.5 rounded-lg transition-all bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-black shadow-lg shadow-cyan-500/25"
          >
            Play Again ↻
          </button>
        )}
      </div>
    </div>
  );
}