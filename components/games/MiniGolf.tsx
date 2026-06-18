"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { GameProps } from "../../app/game/[gameId]/page";

// Game constants - scaled for mobile
const BASE_WIDTH = 600;
const BASE_HEIGHT = 400;
const BALL_RADIUS = 6;
const HOLE_RADIUS = 8;
const FRICTION = 0.98;
const MAX_POWER = 25;

// Golf course hole definitions
type Obstacle = "wall" | "water" | "spike";

interface Hole {
  id: number;
  ballStartX: number;
  ballStartY: number;
  holeX: number;
  holeY: number;
  obstacles: Array<{
    type: Obstacle;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  par: number;
  difficulty: "easy" | "medium" | "hard";
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isMoving: boolean;
}

interface Achievement {
  id: string;
  name: string;
  unlocked: boolean;
}

// Define 9 holes with increasing difficulty
const HOLES: Hole[] = [
  {
    id: 1,
    ballStartX: 80,
    ballStartY: 200,
    holeX: 520,
    holeY: 200,
    obstacles: [],
    par: 1,
    difficulty: "easy",
  },
  {
    id: 2,
    ballStartX: 80,
    ballStartY: 200,
    holeX: 520,
    holeY: 100,
    obstacles: [{ type: "wall", x: 300, y: 150, width: 20, height: 100 }],
    par: 2,
    difficulty: "easy",
  },
  {
    id: 3,
    ballStartX: 80,
    ballStartY: 200,
    holeX: 520,
    holeY: 200,
    obstacles: [{ type: "water", x: 250, y: 100, width: 150, height: 200 }],
    par: 2,
    difficulty: "medium",
  },
  {
    id: 4,
    ballStartX: 80,
    ballStartY: 200,
    holeX: 520,
    holeY: 50,
    obstacles: [
      { type: "wall", x: 200, y: 100, width: 20, height: 150 },
      { type: "wall", x: 350, y: 200, width: 20, height: 150 },
    ],
    par: 3,
    difficulty: "medium",
  },
  {
    id: 5,
    ballStartX: 80,
    ballStartY: 200,
    holeX: 520,
    holeY: 200,
    obstacles: [
      { type: "water", x: 150, y: 0, width: 30, height: 200 },
      { type: "spike", x: 300, y: 150, width: 60, height: 60 },
      { type: "water", x: 450, y: 100, width: 30, height: 250 },
    ],
    par: 3,
    difficulty: "hard",
  },
  {
    id: 6,
    ballStartX: 80,
    ballStartY: 200,
    holeX: 520,
    holeY: 200,
    obstacles: [
      { type: "wall", x: 150, y: 0, width: 250, height: 150 },
      { type: "wall", x: 200, y: 250, width: 250, height: 150 },
    ],
    par: 3,
    difficulty: "hard",
  },
  {
    id: 7,
    ballStartX: 80,
    ballStartY: 100,
    holeX: 520,
    holeY: 300,
    obstacles: [
      { type: "water", x: 200, y: 150, width: 200, height: 100 },
    ],
    par: 3,
    difficulty: "hard",
  },
  {
    id: 8,
    ballStartX: 80,
    ballStartY: 200,
    holeX: 520,
    holeY: 200,
    obstacles: [
      { type: "spike", x: 150, y: 150, width: 40, height: 100 },
      { type: "spike", x: 300, y: 100, width: 40, height: 100 },
      { type: "spike", x: 450, y: 150, width: 40, height: 100 },
    ],
    par: 4,
    difficulty: "hard",
  },
  {
    id: 9,
    ballStartX: 80,
    ballStartY: 200,
    holeX: 520,
    holeY: 200,
    obstacles: [
      { type: "water", x: 0, y: 0, width: 100, height: 400 },
      { type: "spike", x: 200, y: 100, width: 100, height: 50 },
      { type: "wall", x: 300, y: 200, width: 20, height: 200 },
      { type: "water", x: 500, y: 0, width: 100, height: 400 },
    ],
    par: 4,
    difficulty: "hard",
  },
];

export default function DoodleMinGolfGame({
  gameConfig,
  onGameComplete,
  onGameFail,
}: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameLoopRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<
    Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      color: string;
    }>
  >([]);

  const [currentHole, setCurrentHole] = useState(0);
  const [strokes, setStrokes] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [power, setPower] = useState(0);
  const [angle, setAngle] = useState(0);
  const [isAiming, setIsAiming] = useState(false);
  const [showAim, setShowAim] = useState(false);
  const [combo, setCombo] = useState(0);
  const [canvasSize, setCanvasSize] = useState({ width: BASE_WIDTH, height: BASE_HEIGHT });
  const [scale, setScale] = useState(1);
  const [achievements, setAchievements] = useState<Achievement[]>([
    { id: "hole_in_one", name: "Ace!", unlocked: false },
    { id: "birdie_streak", name: "Birdie Streak", unlocked: false },
    { id: "perfect_9", name: "Perfect 9", unlocked: false },
    { id: "speedrunner", name: "Speedrunner", unlocked: false },
  ]);
  const [showAchievement, setShowAchievement] = useState<string | null>(null);
  const [slowMode, setSlowMode] = useState(false);
  const [gameComplete, setGameComplete] = useState(false);

  const ballRef = useRef<Ball>({
    x: HOLES[0].ballStartX,
    y: HOLES[0].ballStartY,
    vx: 0,
    vy: 0,
    isMoving: false,
  });

  const holeData = HOLES[currentHole];
  const totalHoles = HOLES.length;

  // ─── Responsive Canvas ─────────────────────────────────────────────────────

  useEffect(() => {
    const updateSize = () => {
      const container = containerRef.current;
      if (!container) return;

      const containerWidth = container.clientWidth;
      const maxWidth = Math.min(containerWidth, 600);
      const aspectRatio = BASE_HEIGHT / BASE_WIDTH;
      const width = Math.min(maxWidth, window.innerWidth - 32);
      const height = width * aspectRatio;

      // Calculate scale for coordinate transformations
      const newScale = width / BASE_WIDTH;
      setScale(newScale);
      setCanvasSize({ width, height });
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // ─── Particle System ──────────────────────────────────────────────────────

  const createParticles = useCallback((x: number, y: number, color: string) => {
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * (2 + Math.random() * 2),
        vy: Math.sin(angle) * (2 + Math.random() * 2),
        life: 0.8 + Math.random() * 0.4,
        color,
      });
    }
  }, []);

  const unlockAchievement = useCallback((id: string) => {
    setAchievements((prev) =>
      prev.map((ach) =>
        ach.id === id && !ach.unlocked ? { ...ach, unlocked: true } : ach
      )
    );
    setShowAchievement(id);
    setTimeout(() => setShowAchievement(null), 3000);
  }, []);

  // ─── Drawing ──────────────────────────────────────────────────────────────

  const draw = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Clear with background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#0a1f3f");
    bgGrad.addColorStop(0.5, "#1a3f5f");
    bgGrad.addColorStop(1, "#0f2a4f");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Grid background
    ctx.strokeStyle = "rgba(34, 197, 94, 0.05)";
    ctx.lineWidth = 1;
    const gridSize = 40 * scale;
    for (let i = 0; i < width; i += gridSize) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
    }
    for (let i = 0; i < height; i += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
      ctx.stroke();
    }

    const ball = ballRef.current;

    // Draw obstacles with scaled coordinates
    holeData.obstacles.forEach((obs) => {
      const colors = {
        wall: { fill: "#7c3aed", glow: "rgba(124, 58, 237, 0.6)" },
        water: { fill: "#0ea5e9", glow: "rgba(14, 165, 233, 0.6)" },
        spike: { fill: "#ef4444", glow: "rgba(239, 68, 68, 0.6)" },
      };

      const x = obs.x * scale;
      const y = obs.y * scale;
      const w = obs.width * scale;
      const h = obs.height * scale;

      ctx.fillStyle = colors[obs.type].fill;
      ctx.shadowColor = colors[obs.type].glow;
      ctx.shadowBlur = 15 * scale;
      ctx.fillRect(x, y, w, h);

      // Draw pattern on obstacles
      if (obs.type === "spike") {
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
        const spikeSize = 10 * scale;
        for (let i = x; i < x + w; i += spikeSize) {
          ctx.beginPath();
          ctx.moveTo(i, y);
          ctx.lineTo(i + spikeSize / 2, y + h);
          ctx.lineTo(i - spikeSize / 2, y + h);
          ctx.closePath();
          ctx.fill();
        }
      }
    });

    // Draw hole
    const holeX = holeData.holeX * scale;
    const holeY = holeData.holeY * scale;
    const holeRadius = HOLE_RADIUS * scale;
    
    ctx.shadowColor = "rgba(34, 197, 94, 0.8)";
    ctx.shadowBlur = 20 * scale;
    ctx.fillStyle = "#22c55e";
    ctx.beginPath();
    ctx.arc(holeX, holeY, holeRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#16a34a";
    ctx.beginPath();
    ctx.arc(holeX, holeY, holeRadius - 2 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Draw ball
    const ballX = ball.x * scale;
    const ballY = ball.y * scale;
    const ballRadius = BALL_RADIUS * scale;
    
    ctx.shadowColor = slowMode ? "#38bdf8" : "#fbbf24";
    ctx.shadowBlur = 20 * scale;
    const ballGrad = ctx.createRadialGradient(
      ballX - ballRadius * 0.3, ballY - ballRadius * 0.3, 0,
      ballX, ballY, ballRadius
    );
    ballGrad.addColorStop(0, slowMode ? "#38bdf8" : "#fbbf24");
    ballGrad.addColorStop(1, slowMode ? "#0284c7" : "#d97706");
    ctx.fillStyle = ballGrad;
    ctx.beginPath();
    ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = slowMode ? "rgba(56, 189, 248, 0.8)" : "rgba(251, 191, 36, 0.8)";
    ctx.lineWidth = 2 * scale;
    ctx.stroke();

    // Draw aiming line
    if (showAim && !ball.isMoving) {
      ctx.strokeStyle = "rgba(147, 197, 253, 0.6)";
      ctx.lineWidth = 2 * scale;
      ctx.setLineDash([5 * scale, 5 * scale]);
      ctx.beginPath();
      ctx.moveTo(ballX, ballY);
      const distance = 200 * scale;
      ctx.lineTo(
        ballX + Math.cos(angle) * distance,
        ballY + Math.sin(angle) * distance
      );
      ctx.stroke();
      ctx.setLineDash([]);

      // Power indicator
      const powerWidth = 60 * scale;
      ctx.fillStyle = `rgba(${Math.floor((power / MAX_POWER) * 255)}, ${Math.floor(
        ((MAX_POWER - power) / MAX_POWER) * 255
      )}, 100, 0.8)`;
      ctx.fillRect(ballX - powerWidth / 2, ballY - 50 * scale, (power / MAX_POWER) * powerWidth, 5 * scale);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
      ctx.lineWidth = 1 * scale;
      ctx.strokeRect(ballX - powerWidth / 2, ballY - 50 * scale, powerWidth, 5 * scale);
    }

    // Draw particles
    ctx.shadowBlur = 0;
    particlesRef.current = particlesRef.current.filter((p) => p.life > 0);
    particlesRef.current.forEach((p) => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      ctx.arc(p.x * scale, p.y * scale, 3 * scale * p.life, 0, Math.PI * 2);
      ctx.fill();
      p.x += p.vx * 0.5;
      p.y += p.vy * 0.5;
      p.vy += 0.1;
      p.life -= 0.02;
    });
    ctx.globalAlpha = 1;

    // HUD
    ctx.shadowColor = "transparent";
    const fontSize = Math.max(10, 14 * Math.min(1, scale * 1.2));
    ctx.font = `bold ${fontSize}px 'Courier New', monospace`;
    
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    const margin = 15 * scale;
    let lineHeight = fontSize * 1.3;
    let yPos = 20 * scale;
    
    ctx.fillText(`HOLE ${currentHole + 1}/${totalHoles}`, margin, yPos);
    yPos += lineHeight;
    ctx.fillText(`PAR ${holeData.par}`, margin, yPos);
    yPos += lineHeight;
    ctx.fillText(`STROKES: ${strokes}`, margin, yPos);

    // Score indicator
    const scoreVsPar = strokes - holeData.par;
    let scoreColor = "#4ade80";
    if (scoreVsPar === 0) scoreColor = "#f59e0b";
    if (scoreVsPar > 0) scoreColor = "#ef4444";

    ctx.textAlign = "right";
    ctx.fillStyle = scoreColor;
    const rightMargin = width - 20 * scale;
    ctx.fillText(scoreVsPar === 0 ? "PAR" : scoreVsPar < 0 ? `${scoreVsPar}` : `+${scoreVsPar}`, rightMargin, 30 * scale);

    ctx.fillStyle = "rgba(147, 197, 253, 0.9)";
    ctx.fillText(`TOTAL: ${totalScore}`, rightMargin, 50 * scale);

    // Combo
    if (combo > 0) {
      ctx.textAlign = "center";
      ctx.fillStyle = "#fbbf24";
      ctx.font = `bold ${fontSize * 1.1}px 'Courier New', monospace`;
      ctx.fillText(`${combo}x COMBO 🔥`, width / 2, 30 * scale);
    }

    // Slow mode
    if (slowMode) {
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(56, 189, 248, 0.9)";
      ctx.font = `bold ${fontSize * 0.9}px 'Courier New', monospace`;
      ctx.fillText("⏱ SLOW MODE", width / 2, 60 * scale);
    }

    // Instructions
    if (!gameStarted) {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      const instructionFontSize = Math.max(14, 20 * Math.min(1, scale * 1.2));
      ctx.font = `${instructionFontSize}px 'Courier New', monospace`;
      ctx.textAlign = "center";
      ctx.fillText("TAP TO AIM & SET POWER", width / 2, height / 2 - 40 * scale);
      ctx.fillText("RELEASE TO SHOOT", width / 2, height / 2 + 20 * scale);
    }

    // Game complete
    if (gameComplete) {
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.fillRect(0, 0, width, height);

      const titleSize = Math.max(24, 32 * Math.min(1, scale * 1.2));
      ctx.font = `bold ${titleSize}px 'Courier New', monospace`;
      ctx.fillStyle = "#4ade80";
      ctx.textAlign = "center";
      ctx.fillText("COURSE COMPLETE!", width / 2, height / 2 - 80 * scale);

      const scoreSize = Math.max(18, 24 * Math.min(1, scale * 1.2));
      ctx.font = `bold ${scoreSize}px 'Courier New', monospace`;
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`SCORE: ${totalScore}`, width / 2, height / 2);

      const smallSize = Math.max(12, 16 * Math.min(1, scale * 1.2));
      ctx.font = `${smallSize}px 'Courier New', monospace`;
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillText("TAP TO PLAY AGAIN", width / 2, height / 2 + 60 * scale);
    }
  }, [currentHole, holeData, strokes, totalScore, combo, slowMode, showAim, angle, power, gameStarted, gameComplete, scale]);

  // ─── Game Loop ────────────────────────────────────────────────────────────

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const ball = ballRef.current;

    // Apply friction with slow mode
    if (Math.hypot(ball.vx, ball.vy) < 0.1) {
      ball.vx = 0;
      ball.vy = 0;
      ball.isMoving = false;
    } else {
      const frictionMod = slowMode ? 0.95 : FRICTION;
      ball.vx *= frictionMod;
      ball.vy *= frictionMod;

      // Gravity-like effect
      ball.vy += 0.1;

      // Update position (in game coordinates)
      ball.x += ball.vx;
      ball.y += ball.vy;
    }

    // Wall collision (in game coordinates)
    if (ball.x - BALL_RADIUS < 0 || ball.x + BALL_RADIUS > BASE_WIDTH) {
      ball.vx = -ball.vx * 0.8;
      ball.x = Math.max(BALL_RADIUS, Math.min(BASE_WIDTH - BALL_RADIUS, ball.x));
    }
    if (ball.y - BALL_RADIUS < 0 || ball.y + BALL_RADIUS > BASE_HEIGHT) {
      ball.vy = -ball.vy * 0.8;
      ball.y = Math.max(BALL_RADIUS, Math.min(BASE_HEIGHT - BALL_RADIUS, ball.y));
    }

    // Obstacle collisions
    holeData.obstacles.forEach((obs) => {
      if (
        ball.x + BALL_RADIUS > obs.x &&
        ball.x - BALL_RADIUS < obs.x + obs.width &&
        ball.y + BALL_RADIUS > obs.y &&
        ball.y - BALL_RADIUS < obs.y + obs.height
      ) {
        if (obs.type === "water" || obs.type === "spike") {
          // Reset ball to start
          ball.x = holeData.ballStartX;
          ball.y = holeData.ballStartY;
          ball.vx = 0;
          ball.vy = 0;
          setStrokes((prev) => prev + 1);
          createParticles(holeData.ballStartX, holeData.ballStartY, 
            obs.type === "water" ? "#0ea5e9" : "#ef4444"
          );
        } else if (obs.type === "wall") {
          // Simple wall bounce
          const overlapX = Math.min(ball.x + BALL_RADIUS - obs.x, obs.x + obs.width - (ball.x - BALL_RADIUS));
          const overlapY = Math.min(ball.y + BALL_RADIUS - obs.y, obs.y + obs.height - (ball.y - BALL_RADIUS));
          
          if (overlapX < overlapY) {
            ball.vx = -ball.vx * 0.8;
            ball.x += (ball.x > obs.x + obs.width / 2) ? overlapX : -overlapX;
          } else {
            ball.vy = -ball.vy * 0.8;
            ball.y += (ball.y > obs.y + obs.height / 2) ? overlapY : -overlapY;
          }
        }
      }
    });

    // Check if ball is in hole
    const distToHole = Math.hypot(ball.x - holeData.holeX, ball.y - holeData.holeY);
    if (distToHole < HOLE_RADIUS + BALL_RADIUS && !ball.isMoving && !gameComplete) {
      createParticles(holeData.holeX, holeData.holeY, "#22c55e");

      let holeScore = Math.max(0, 10 - (strokes - holeData.par) * 3);
      if (strokes === 1) {
        holeScore = 50;
        unlockAchievement("hole_in_one");
      } else if (strokes === holeData.par - 1) {
        holeScore = 30;
        setCombo((prev) => prev + 1);
      } else if (strokes === holeData.par) {
        holeScore = 20;
        setCombo(0);
      } else {
        setCombo(0);
      }

      setTotalScore((prev) => prev + holeScore);

      if (currentHole < totalHoles - 1) {
        const nextHole = currentHole + 1;
        setCurrentHole(nextHole);
        setStrokes(0);
        ballRef.current = {
          x: HOLES[nextHole].ballStartX,
          y: HOLES[nextHole].ballStartY,
          vx: 0,
          vy: 0,
          isMoving: false,
        };
      } else {
        setGameComplete(true);
        if (totalScore + holeScore >= 200) {
          unlockAchievement("perfect_9");
        }
        onGameComplete(totalScore + holeScore);
        return;
      }
    }

    draw(ctx, width, height);
    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [draw, holeData, currentHole, strokes, totalScore, combo, slowMode, gameComplete, createParticles, unlockAchievement, onGameComplete]);

  // ─── Input Handlers ──────────────────────────────────────────────────────

  const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Convert to game coordinates
    const x = ((clientX - rect.left) / rect.width) * BASE_WIDTH;
    const y = ((clientY - rect.top) / rect.height) * BASE_HEIGHT;

    return { x, y };
  }, []);

  const handleCanvasInteraction = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    if (gameComplete) {
      // Reset game
      setGameComplete(false);
      setCurrentHole(0);
      setTotalScore(0);
      setStrokes(0);
      setCombo(0);
      setGameStarted(false);
      setShowAim(false);
      ballRef.current = {
        x: HOLES[0].ballStartX,
        y: HOLES[0].ballStartY,
        vx: 0,
        vy: 0,
        isMoving: false,
      };
      return;
    }

    if (ballRef.current.isMoving) return;

    const { x, y } = getCanvasCoords(e);
    const ball = ballRef.current;

    if (!gameStarted) {
      setGameStarted(true);
      setShowAim(true);
      setIsAiming(true);
      const dx = x - ball.x;
      const dy = y - ball.y;
      setAngle(Math.atan2(dy, dx));
      setPower(Math.min(MAX_POWER, Math.max(0, Math.hypot(dx, dy) / 3)));
      return;
    }

    const dx = x - ball.x;
    const dy = y - ball.y;
    const dist = Math.hypot(dx, dy);

    if (!showAim || dist < 30) {
      setShowAim(true);
      setIsAiming(true);
      setAngle(Math.atan2(dy, dx));
      setPower(Math.min(MAX_POWER, Math.max(0, dist / 3)));
    } else {
      // Shoot
      ball.vx = Math.cos(angle) * power;
      ball.vy = Math.sin(angle) * power;
      ball.isMoving = true;
      setShowAim(false);
      setIsAiming(false);
      setStrokes((prev) => prev + 1);
      createParticles(ball.x, ball.y, "#fbbf24");
      setPower(0);
    }
  }, [gameStarted, showAim, angle, power, gameComplete, createParticles, getCanvasCoords]);

  const handlePointerMove = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!showAim || ballRef.current.isMoving || gameComplete) return;

    const { x, y } = getCanvasCoords(e);
    const ball = ballRef.current;
    const dx = x - ball.x;
    const dy = y - ball.y;

    setAngle(Math.atan2(dy, dx));
    setPower(Math.min(MAX_POWER, Math.max(0, Math.hypot(dx, dy) / 3)));
  }, [showAim, gameComplete, getCanvasCoords]);

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (gameStarted && !gameComplete) {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
      gameLoopRef.current = requestAnimationFrame(gameLoop);
      return () => {
        if (gameLoopRef.current) {
          cancelAnimationFrame(gameLoopRef.current);
        }
      };
    }
  }, [gameStarted, gameComplete, gameLoop]);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div ref={containerRef} className="flex flex-col items-center gap-4 w-full max-w-[600px] mx-auto px-2">
      <div className="relative w-full">
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          onClick={handleCanvasInteraction}
          onTouchStart={handleCanvasInteraction}
          onTouchMove={handlePointerMove}
          onMouseMove={handlePointerMove}
          className="w-full rounded-2xl shadow-2xl touch-none cursor-pointer border border-green-400/30 hover:border-green-400/60 transition-all"
          style={{ 
            background: "#0f0f1e",
            maxWidth: '100%',
            height: 'auto',
            aspectRatio: `${BASE_WIDTH}/${BASE_HEIGHT}`
          }}
        />

        {/* Achievement Pop-up */}
        {showAchievement && (
          <div className="absolute top-4 left-4 animate-pulse pointer-events-none">
            <div
              className="px-4 py-3 rounded-lg border border-green-400/50 backdrop-blur-sm"
              style={{ background: "rgba(34, 197, 94, 0.1)" }}
            >
              <p className="font-mono-arc text-xs text-green-400 font-bold">
                🏆 ACHIEVEMENT UNLOCKED
              </p>
              <p className="font-mono-arc text-[11px] text-green-300">
                {achievements.find((a) => a.id === showAchievement)?.name}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="text-center w-full">
        <div className="flex justify-center gap-6 mb-2">
          <div>
            <p className="font-mono-arc text-xs text-gray-500 uppercase tracking-wider">Score</p>
            <p className="font-mono-arc text-xl font-bold text-cyan-400">{totalScore}</p>
          </div>
          <div className="w-px h-10 bg-gray-700"/>
          <div>
            <p className="font-mono-arc text-xs text-gray-500 uppercase tracking-wider">Hole</p>
            <p className="font-mono-arc text-xl font-bold text-white">{currentHole + 1}/{totalHoles}</p>
          </div>
          <div className="w-px h-10 bg-gray-700"/>
          <div>
            <p className="font-mono-arc text-xs text-gray-500 uppercase tracking-wider">Strokes</p>
            <p className="font-mono-arc text-xl font-bold text-yellow-400">{strokes}</p>
          </div>
        </div>

        {/* Achievements */}
        <div className="flex gap-1 justify-center flex-wrap mb-2">
          {achievements.map((ach) => (
            <div
              key={ach.id}
              className={`px-1.5 py-0.5 rounded text-[8px] font-mono-arc transition-all ${
                ach.unlocked
                  ? "bg-green-500/20 text-green-400 border border-green-400/50"
                  : "bg-gray-500/10 text-gray-500 border border-gray-500/30"
              }`}
            >
              {ach.unlocked ? "✓" : "○"}
            </div>
          ))}
        </div>

        {gameComplete && (
          <button
            onClick={() => {
              setGameComplete(false);
              setCurrentHole(0);
              setTotalScore(0);
              setStrokes(0);
              setCombo(0);
              setGameStarted(false);
              setShowAim(false);
              ballRef.current = {
                x: HOLES[0].ballStartX,
                y: HOLES[0].ballStartY,
                vx: 0,
                vy: 0,
                isMoving: false,
              };
            }}
            className="font-mono-arc text-xs font-bold uppercase tracking-wider px-6 py-2 rounded-lg transition-all bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-black shadow-lg shadow-green-500/25"
          >
            Play Again ↻
          </button>
        )}
      </div>
    </div>
  );
}