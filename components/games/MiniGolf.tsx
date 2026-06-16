"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { GameProps } from "../../app/game/[gameId]/page";

// Game constants
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;
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
  const [achievements, setAchievements] = useState<Achievement[]>([
    { id: "hole_in_one", name: "Ace!", unlocked: false },
    { id: "birdie_streak", name: "Birdie Streak", unlocked: false },
    { id: "perfect_9", name: "Perfect 9", unlocked: false },
    { id: "speedrunner", name: "Speedrunner", unlocked: false },
  ]);
  const [showAchievement, setShowAchievement] = useState<string | null>(null);
  const [slowMode, setSlowMode] = useState(false);

  const ballRef = useRef<Ball>({
    x: HOLES[0].ballStartX,
    y: HOLES[0].ballStartY,
    vx: 0,
    vy: 0,
    isMoving: false,
  });

  const holeData = HOLES[currentHole];
  const totalHoles = HOLES.length;
  const holesCompleted = currentHole;

  const createParticles = useCallback((x: number, y: number, color: string) => {
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * 3,
        vy: Math.sin(angle) * 3,
        life: 1,
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

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    // Background with gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    bgGrad.addColorStop(0, "#0a1f3f");
    bgGrad.addColorStop(0.5, "#1a3f5f");
    bgGrad.addColorStop(1, "#0f2a4f");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Grid background
    ctx.strokeStyle = "rgba(34, 197, 94, 0.05)";
    ctx.lineWidth = 1;
    for (let i = 0; i < CANVAS_WIDTH; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, CANVAS_HEIGHT);
      ctx.stroke();
    }
    for (let i = 0; i < CANVAS_HEIGHT; i += 40) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(CANVAS_WIDTH, i);
      ctx.stroke();
    }

    const ball = ballRef.current;

    // Draw obstacles
    holeData.obstacles.forEach((obs) => {
      const colors = {
        wall: { fill: "#7c3aed", glow: "rgba(124, 58, 237, 0.6)" },
        water: { fill: "#0ea5e9", glow: "rgba(14, 165, 233, 0.6)" },
        spike: { fill: "#ef4444", glow: "rgba(239, 68, 68, 0.6)" },
      };

      ctx.fillStyle = colors[obs.type].fill;
      ctx.shadowColor = colors[obs.type].glow;
      ctx.shadowBlur = 15;
      ctx.fillRect(obs.x, obs.y, obs.width, obs.height);

      // Draw pattern on obstacles
      if (obs.type === "spike") {
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
        for (let i = obs.x; i < obs.x + obs.width; i += 10) {
          ctx.beginPath();
          ctx.moveTo(i, obs.y);
          ctx.lineTo(i + 5, obs.y + obs.height);
          ctx.lineTo(i - 5, obs.y + obs.height);
          ctx.closePath();
          ctx.fill();
        }
      }
    });

    // Draw hole
    ctx.shadowColor = "rgba(34, 197, 94, 0.8)";
    ctx.shadowBlur = 20;
    ctx.fillStyle = "#22c55e";
    ctx.beginPath();
    ctx.arc(holeData.holeX, holeData.holeY, HOLE_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Hole inner glow
    ctx.fillStyle = "#16a34a";
    ctx.beginPath();
    ctx.arc(holeData.holeX, holeData.holeY, HOLE_RADIUS - 2, 0, Math.PI * 2);
    ctx.fill();

    // Draw ball with glow
    ctx.shadowColor = slowMode ? "#38bdf8" : "#fbbf24";
    ctx.shadowBlur = 20;
    const ballGrad = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, BALL_RADIUS);
    ballGrad.addColorStop(0, slowMode ? "#38bdf8" : "#fbbf24");
    ballGrad.addColorStop(1, slowMode ? "#0284c7" : "#d97706");
    ctx.fillStyle = ballGrad;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Ball outline
    ctx.strokeStyle = slowMode ? "rgba(56, 189, 248, 0.8)" : "rgba(251, 191, 36, 0.8)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw aiming line if aiming
    if (showAim && !ball.isMoving) {
      ctx.strokeStyle = "rgba(147, 197, 253, 0.6)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(ball.x, ball.y);
      const distance = 200;
      ctx.lineTo(
        ball.x + Math.cos(angle) * distance,
        ball.y + Math.sin(angle) * distance
      );
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw power indicator
      ctx.fillStyle = `rgba(${Math.floor((power / MAX_POWER) * 255)}, ${Math.floor(
        ((MAX_POWER - power) / MAX_POWER) * 255
      )}, 100, 0.8)`;
      ctx.fillRect(ball.x - 30, ball.y - 50, (power / MAX_POWER) * 60, 5);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
      ctx.lineWidth = 1;
      ctx.strokeRect(ball.x - 30, ball.y - 50, 60, 5);
    }

    // Draw particles
    particlesRef.current = particlesRef.current.filter((p) => p.life > 0);
    particlesRef.current.forEach((p) => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.2;
      p.life -= 0.02;
    });
    ctx.globalAlpha = 1;

    // Draw HUD
    ctx.shadowColor = "transparent";
    ctx.font = "bold 14px 'Courier New', monospace";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.textAlign = "left";
    ctx.fillText(`HOLE ${currentHole + 1}/${totalHoles}`, 20, 30);
    ctx.fillText(`PAR ${holeData.par}`, 20, 50);
    ctx.fillText(`STROKES: ${strokes}`, 20, 70);

    // Score indicator
    const scoreVsPar = strokes - holeData.par;
    let scoreColor = "#4ade80"; // Green = birdie or better
    if (scoreVsPar === 0) scoreColor = "#f59e0b"; // Yellow = par
    if (scoreVsPar > 0) scoreColor = "#ef4444"; // Red = bogey

    ctx.font = "bold 16px 'Courier New', monospace";
    ctx.fillStyle = scoreColor;
    ctx.textAlign = "right";
    ctx.fillText(scoreVsPar === 0 ? "PAR" : scoreVsPar < 0 ? `${scoreVsPar}` : `+${scoreVsPar}`, CANVAS_WIDTH - 20, 30);

    // Total score
    ctx.fillStyle = "rgba(147, 197, 253, 0.9)";
    ctx.fillText(`TOTAL: ${totalScore}`, CANVAS_WIDTH - 20, 50);

    // Combo
    if (combo > 0) {
      ctx.fillStyle = "#fbbf24";
      ctx.font = "bold 14px 'Courier New', monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${combo}x COMBO 🔥`, CANVAS_WIDTH / 2, 30);
    }

    // Slow mode indicator
    if (slowMode) {
      ctx.fillStyle = "rgba(56, 189, 248, 0.9)";
      ctx.font = "bold 12px 'Courier New', monospace";
      ctx.textAlign = "center";
      ctx.fillText("⏱ SLOW MODE", CANVAS_WIDTH / 2, 60);
    }

    // Instructions
    if (!gameStarted) {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "20px 'Courier New', monospace";
      ctx.textAlign = "center";
      ctx.fillText("CLICK TO AIM & SET POWER", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);
      ctx.fillText("RELEASE TO SHOOT", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);
    }

    // Game complete screen
    if (currentHole === totalHoles && !ball.isMoving && strokes > 0) {
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.font = "bold 32px 'Courier New', monospace";
      ctx.fillStyle = "#4ade80";
      ctx.textAlign = "center";
      ctx.fillText("COURSE COMPLETE!", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 60);

      ctx.font = "bold 24px 'Courier New', monospace";
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`SCORE: ${totalScore}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);

      ctx.font = "16px 'Courier New', monospace";
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillText("CLICK TO PLAY AGAIN", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60);
    }
  }, [currentHole, holeData, strokes, totalScore, combo, slowMode, showAim, angle, power, gameStarted]);

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const ball = ballRef.current;

    // Apply friction
    if (Math.hypot(ball.vx, ball.vy) < 0.1) {
      ball.vx = 0;
      ball.vy = 0;
      ball.isMoving = false;
    } else {
      const frictionMod = slowMode ? 0.95 : FRICTION;
      ball.vx *= frictionMod;
      ball.vy *= frictionMod;

      // Apply gravity-like effect
      ball.vy += 0.1;

      // Update position
      ball.x += ball.vx;
      ball.y += ball.vy;
    }

    // Wall collision
    if (ball.x - BALL_RADIUS < 0 || ball.x + BALL_RADIUS > CANVAS_WIDTH) {
      ball.vx = -ball.vx * 0.8;
      ball.x = Math.max(BALL_RADIUS, Math.min(CANVAS_WIDTH - BALL_RADIUS, ball.x));
    }
    if (ball.y - BALL_RADIUS < 0 || ball.y + BALL_RADIUS > CANVAS_HEIGHT) {
      ball.vy = -ball.vy * 0.8;
      ball.y = Math.max(BALL_RADIUS, Math.min(CANVAS_HEIGHT - BALL_RADIUS, ball.y));
    }

    // Check obstacle collisions
    holeData.obstacles.forEach((obs) => {
      if (
        ball.x + BALL_RADIUS > obs.x &&
        ball.x - BALL_RADIUS < obs.x + obs.width &&
        ball.y + BALL_RADIUS > obs.y &&
        ball.y - BALL_RADIUS < obs.y + obs.height
      ) {
        if (obs.type === "water") {
          // Reset ball to start on water
          ball.x = holeData.ballStartX;
          ball.y = holeData.ballStartY;
          ball.vx = 0;
          ball.vy = 0;
          setStrokes((prev) => prev + 1);
          createParticles(holeData.ballStartX, holeData.ballStartY, "#0ea5e9");
        } else if (obs.type === "spike") {
          // Reset ball on spike
          ball.x = holeData.ballStartX;
          ball.y = holeData.ballStartY;
          ball.vx = 0;
          ball.vy = 0;
          setStrokes((prev) => prev + 1);
          createParticles(holeData.ballStartX, holeData.ballStartY, "#ef4444");
        } else if (obs.type === "wall") {
          // Bounce off wall
          const ballCenterX = ball.x;
          const ballCenterY = ball.y;

          const closestX = Math.max(obs.x, Math.min(ballCenterX, obs.x + obs.width));
          const closestY = Math.max(obs.y, Math.min(ballCenterY, obs.y + obs.height));

          const distX = ballCenterX - closestX;
          const distY = ballCenterY - closestY;
          const dist = Math.hypot(distX, distY);

          if (dist < BALL_RADIUS) {
            const angle = Math.atan2(distY, distX);
            ball.x = closestX + Math.cos(angle) * BALL_RADIUS;
            ball.y = closestY + Math.sin(angle) * BALL_RADIUS;

            const dotProduct = ball.vx * Math.cos(angle) + ball.vy * Math.sin(angle);
            ball.vx = (Math.cos(angle) * dotProduct - Math.sin(angle) * (ball.vx * Math.sin(angle) - ball.vy * Math.cos(angle))) * 0.8;
            ball.vy = (Math.sin(angle) * dotProduct + Math.cos(angle) * (ball.vx * Math.sin(angle) - ball.vy * Math.cos(angle))) * 0.8;
          }
        }
      }
    });

    // Check if ball is in hole
    const distToHole = Math.hypot(ball.x - holeData.holeX, ball.y - holeData.holeY);
    if (distToHole < HOLE_RADIUS + BALL_RADIUS && !ball.isMoving) {
      createParticles(holeData.holeX, holeData.holeY, "#22c55e");

      // Calculate score
      let holeScore = Math.max(0, 10 - (strokes - holeData.par) * 3);
      if (strokes === 1) {
        holeScore = 50; // Hole in one bonus!
        unlockAchievement("hole_in_one");
      } else if (strokes === holeData.par - 1) {
        holeScore = 30; // Birdie bonus
        setCombo((prev) => prev + 1);
      } else if (strokes === holeData.par) {
        holeScore = 20; // Par
        setCombo(0);
      } else {
        setCombo(0);
      }

      setTotalScore((prev) => prev + holeScore);

      // Move to next hole or complete game
      if (currentHole < totalHoles - 1) {
        setCurrentHole((prev) => prev + 1);
        setStrokes(0);
        ballRef.current = {
          x: HOLES[currentHole + 1].ballStartX,
          y: HOLES[currentHole + 1].ballStartY,
          vx: 0,
          vy: 0,
          isMoving: false,
        };
      } else {
        // Game complete
        if (totalScore >= 200) {
          unlockAchievement("perfect_9");
        }
        onGameComplete(totalScore);
      }
    }

    draw(ctx);
    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [draw, holeData, currentHole, strokes, totalScore, combo, slowMode, createParticles, unlockAchievement, onGameComplete]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || ballRef.current.isMoving) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (!gameStarted) {
      setGameStarted(true);
      setShowAim(true);
      return;
    }

    const dx = x - ballRef.current.x;
    const dy = y - ballRef.current.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 60) {
      // Clicked near ball - set aiming
      setShowAim(true);
      setAngle(Math.atan2(dy, dx));
      setPower(Math.min(MAX_POWER, Math.max(0, dist / 3)));
    } else if (showAim) {
      // Shoot the ball
      ballRef.current.vx = Math.cos(angle) * power;
      ballRef.current.vy = Math.sin(angle) * power;
      ballRef.current.isMoving = true;
      setShowAim(false);
      setStrokes((prev) => prev + 1);
      createParticles(ballRef.current.x, ballRef.current.y, "#fbbf24");
      setPower(0);
    }
  }, [gameStarted, showAim, angle, power, createParticles]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!showAim || ballRef.current.isMoving) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const dx = x - ballRef.current.x;
    const dy = y - ballRef.current.y;

    setAngle(Math.atan2(dy, dx));
    setPower(Math.min(MAX_POWER, Math.hypot(dx, dy) / 3));
  }, [showAim]);

  useEffect(() => {
    if (gameStarted) {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
      return () => cancelAnimationFrame(gameLoopRef.current);
    }
  }, [gameStarted, gameLoop]);

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
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onClick={handleCanvasClick}
          onMouseMove={handleMouseMove}
          className="rounded-2xl shadow-2xl cursor-pointer border border-green-400/30 hover:border-green-400/60 transition-all"
          style={{ background: "#0f0f1e" }}
        />

        {/* Achievement Pop-up */}
        {showAchievement && (
          <div className="absolute top-4 left-4 animate-pulse">
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

      <div className="text-center">
        <p className="font-mono-arc text-sm text-gray-400 uppercase tracking-wider mb-3">
          Score: <span className="text-cyan-400 text-2xl font-bold">{totalScore}</span>
        </p>
        <p className="text-xs text-gray-500 mb-3">
          Hole {currentHole + 1}/{totalHoles} | Strokes: {strokes} | Par: {holeData.par}
        </p>

        {/* Achievement Display */}
        <div className="flex gap-2 justify-center flex-wrap">
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

        {currentHole === totalHoles && (
          <button
            onClick={() => {
              setCurrentHole(0);
              setTotalScore(0);
              setStrokes(0);
              setCombo(0);
              ballRef.current = {
                x: HOLES[0].ballStartX,
                y: HOLES[0].ballStartY,
                vx: 0,
                vy: 0,
                isMoving: false,
              };
            }}
            className="font-mono-arc text-xs font-bold uppercase tracking-wider px-6 py-2 rounded-lg mt-3 transition-all bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-black"
          >
            Play Again ↻
          </button>
        )}
      </div>
    </div>
  );
}