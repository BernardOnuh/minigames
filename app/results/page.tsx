"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { GameProps } from "../../app/game/[gameId]/page";

const GRID_WIDTH = 20;
const GRID_HEIGHT = 20;
const CELL_SIZE = 24;
const INITIAL_SPEED = 100;

type Coordinate = { x: number; y: number };
type PowerUpType = "speed" | "freeze" | "shield" | "double";

interface PowerUp {
  pos: Coordinate;
  type: PowerUpType;
  active: boolean;
  spawnTime: number;
}

interface Achievement {
  id: string;
  name: string;
  unlocked: boolean;
}

type Particle = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
};

export default function SnakeGameEnhanced({
  gameConfig,
  onGameComplete,
  onGameFail,
}: GameProps) {
  const [snake, setSnake] = useState<Coordinate[]>([{ x: 10, y: 10 }]);
  const [food, setFood] = useState<Coordinate>({ x: 15, y: 15 });
  const [direction, setDirection] = useState<Coordinate>({ x: 1, y: 0 });
  const [nextDirection, setNextDirection] = useState<Coordinate>({ x: 1, y: 0 });
  const [score, setScore] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [speed, setSpeed] = useState(INITIAL_SPEED);
  const [foodEaten, setFoodEaten] = useState(0);
  const [combo, setCombo] = useState(0);
  const [powerUps, setPowerUps] = useState<PowerUp[]>([]);
  const [activePowerUp, setActivePowerUp] = useState<PowerUpType | null>(null);
  const [shield, setShield] = useState(false);
  const [pointMultiplier, setPointMultiplier] = useState(1);
  const [achievements, setAchievements] = useState<Achievement[]>([
    { id: "first_bite", name: "First Bite", unlocked: false },
    { id: "triple_threat", name: "Triple Threat", unlocked: false },
    { id: "speedy", name: "Speedy", unlocked: false },
    { id: "immortal", name: "Immortal", unlocked: false },
    { id: "score_500", name: "High Roller", unlocked: false },
  ]);
  const [showAchievement, setShowAchievement] = useState<string | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);

  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const comboTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const generateFood = useCallback(() => {
    return {
      x: Math.floor(Math.random() * GRID_WIDTH),
      y: Math.floor(Math.random() * GRID_HEIGHT),
    };
  }, []);

  const addParticles = useCallback((x: number, y: number, color: string) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6;
      newParticles.push({
        id: `${Date.now()}-${i}`,
        x: x * CELL_SIZE + CELL_SIZE / 2,
        y: y * CELL_SIZE + CELL_SIZE / 2,
        vx: Math.cos(angle) * 2,
        vy: Math.sin(angle) * 2,
        life: 1,
        color,
      });
    }
    setParticles((prev) => [...prev, ...newParticles]);
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

  const handleStart = useCallback(() => {
    if (!gameStarted && !gameOver) {
      setGameStarted(true);
    } else if (gameOver) {
      setSnake([{ x: 10, y: 10 }]);
      setFood(generateFood());
      setDirection({ x: 1, y: 0 });
      setNextDirection({ x: 1, y: 0 });
      setScore(0);
      setSpeed(INITIAL_SPEED);
      setGameOver(false);
      setGameStarted(true);
      setFoodEaten(0);
      setCombo(0);
      setPowerUps([]);
      setActivePowerUp(null);
      setShield(false);
      setPointMultiplier(1);
      setParticles([]);
    }
  }, [gameStarted, gameOver, generateFood]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        handleStart();
        return;
      }
      const key = e.key;
      if (key === "ArrowUp" && direction.y === 0) setNextDirection({ x: 0, y: -1 });
      if (key === "ArrowDown" && direction.y === 0) setNextDirection({ x: 0, y: 1 });
      if (key === "ArrowLeft" && direction.x === 0) setNextDirection({ x: -1, y: 0 });
      if (key === "ArrowRight" && direction.x === 0) setNextDirection({ x: 1, y: 0 });
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [direction, handleStart]);

  useEffect(() => {
    if (!gameStarted || gameOver) return;

    gameLoopRef.current = setInterval(() => {
      setSnake((prevSnake) => {
        setDirection(nextDirection);
        const head = prevSnake[0];
        const newHead = {
          x: (head.x + nextDirection.x + GRID_WIDTH) % GRID_WIDTH,
          y: (head.y + nextDirection.y + GRID_HEIGHT) % GRID_HEIGHT,
        };

        if (prevSnake.some((seg) => seg.x === newHead.x && seg.y === newHead.y)) {
          if (!shield) {
            setGameOver(true);
            onGameFail();
            return prevSnake;
          } else {
            setShield(false);
            addParticles(newHead.x, newHead.y, "#4ade80");
            return prevSnake;
          }
        }

        const newSnake = [newHead, ...prevSnake];

        if (newHead.x === food.x && newHead.y === food.y) {
          const basePoints = 10 * pointMultiplier;
          let earnedPoints = basePoints;

          setCombo((prev) => prev + 1);
          if (combo > 0) {
            earnedPoints += Math.floor(basePoints * (combo * 0.1));
          }

          setScore((prev) => prev + earnedPoints);
          setFoodEaten((prev) => prev + 1);
          addParticles(food.x, food.y, "#fbbf24");

          if (foodEaten === 0) unlockAchievement("first_bite");
          if (foodEaten === 2) unlockAchievement("triple_threat");
          if (score + earnedPoints >= 500) unlockAchievement("score_500");

          setSpeed((prev) => Math.max(50, prev - 2));

          if (Math.random() < 0.15) {
            const types: PowerUpType[] = ["speed", "freeze", "shield", "double"];
            const randomType = types[Math.floor(Math.random() * types.length)];
            setPowerUps((prev) => [
              ...prev,
              {
                pos: generateFood(),
                type: randomType,
                active: true,
                spawnTime: Date.now(),
              },
            ]);
          }

          if (comboTimeoutRef.current) clearTimeout(comboTimeoutRef.current);
          comboTimeoutRef.current = setTimeout(() => setCombo(0), 3000);

          setFood(generateFood());
        } else {
          newSnake.pop();
        }

        return newSnake;
      });
    }, speed);

    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [
    gameStarted,
    gameOver,
    speed,
    food,
    nextDirection,
    score,
    generateFood,
    onGameFail,
    addParticles,
    shield,
    combo,
    pointMultiplier,
    foodEaten,
    unlockAchievement,
  ]);

  // Handle power-up collision
  useEffect(() => {
    if (!gameStarted || gameOver) return;

    snake.forEach((segment, idx) => {
      if (idx === 0) {
        setPowerUps((prevPowerUps) => {
          const updated = prevPowerUps.map((pu) => {
            if (pu.active && segment.x === pu.pos.x && segment.y === pu.pos.y) {
              addParticles(pu.pos.x, pu.pos.y, "#a78bfa");
              switch (pu.type) {
                case "speed":
                  setSpeed((prev) => Math.max(40, prev - 15));
                  break;
                case "freeze":
                  setSpeed((prev) => prev + 30);
                  setActivePowerUp("freeze");
                  setTimeout(() => setActivePowerUp(null), 2000);
                  break;
                case "shield":
                  setShield(true);
                  setTimeout(() => setShield(false), 3000);
                  break;
                case "double":
                  setPointMultiplier(2);
                  setTimeout(() => setPointMultiplier(1), 4000);
                  setActivePowerUp("double");
                  break;
              }
              return { ...pu, active: false };
            }
            return pu;
          });

          if (updated.some((pu) => !pu.active)) {
            if (speed < 60) unlockAchievement("speedy");
          }

          return updated;
        });
      }
    });
  }, [gameStarted, gameOver, snake, addParticles, speed, unlockAchievement]);

  // Update particles
  useEffect(() => {
    const interval = setInterval(() => {
      setParticles((prev) =>
        prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.1,
            life: p.life - 0.02,
          }))
          .filter((p) => p.life > 0)
      );
    }, 30);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center gap-6">
      <div
        className="relative rounded-2xl shadow-2xl overflow-hidden border border-green-400/30 hover:border-green-400/60 transition-all"
        style={{
          width: GRID_WIDTH * CELL_SIZE + 4,
          height: GRID_HEIGHT * CELL_SIZE + 4,
          background: "linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%)",
        }}
      >
        {/* Grid */}
        <svg
          width={GRID_WIDTH * CELL_SIZE}
          height={GRID_HEIGHT * CELL_SIZE}
          className="absolute inset-0"
        >
          {[...Array(GRID_WIDTH + 1)].map((_, i) => (
            <line
              key={`v-${i}`}
              x1={i * CELL_SIZE} y1={0}
              x2={i * CELL_SIZE} y2={GRID_HEIGHT * CELL_SIZE}
              stroke="rgba(34,197,94,0.05)" strokeWidth="1"
            />
          ))}
          {[...Array(GRID_HEIGHT + 1)].map((_, i) => (
            <line
              key={`h-${i}`}
              x1={0} y1={i * CELL_SIZE}
              x2={GRID_WIDTH * CELL_SIZE} y2={i * CELL_SIZE}
              stroke="rgba(34,197,94,0.05)" strokeWidth="1"
            />
          ))}
        </svg>

        {/* Particles */}
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: p.x, top: p.y,
              width: "6px", height: "6px",
              background: p.color,
              opacity: p.life,
              boxShadow: `0 0 8px ${p.color}`,
            }}
          />
        ))}

        {/* Snake */}
        {snake.map((segment, idx) => (
          <div
            key={idx}
            className="absolute rounded-sm transition-all"
            style={{
              left: segment.x * CELL_SIZE + 2,
              top: segment.y * CELL_SIZE + 2,
              width: CELL_SIZE - 4,
              height: CELL_SIZE - 4,
              background:
                idx === 0
                  ? "linear-gradient(135deg,#10b981,#34d399)"
                  : "linear-gradient(135deg,#059669,#10b981)",
              boxShadow:
                idx === 0
                  ? "0 0 12px rgba(16,185,129,0.8),inset 0 0 6px rgba(255,255,255,0.2)"
                  : "0 0 6px rgba(16,185,129,0.3)",
              border: shield && idx === 0 ? "2px solid #4ade80" : "none",
            }}
          />
        ))}

        {/* Food */}
        <div
          className="absolute rounded-full animate-pulse"
          style={{
            left: food.x * CELL_SIZE + 4,
            top: food.y * CELL_SIZE + 4,
            width: CELL_SIZE - 8,
            height: CELL_SIZE - 8,
            background: "linear-gradient(135deg,#f59e0b,#fbbf24)",
            boxShadow: "0 0 12px rgba(251,191,36,0.8),inset 0 0 6px rgba(255,255,255,0.3)",
          }}
        />

        {/* Power-ups */}
        {powerUps.map((pu) => {
          if (!pu.active) return null;
          const colors: Record<PowerUpType, string> = {
            speed: "#3b82f6", freeze: "#06b6d4", shield: "#4ade80", double: "#a78bfa",
          };
          const icons: Record<PowerUpType, string> = {
            speed: "⚡", freeze: "❄️", shield: "🛡️", double: "2️⃣",
          };
          return (
            <div
              key={`${pu.pos.x}-${pu.pos.y}`}
              className="absolute rounded-sm flex items-center justify-center animate-pulse"
              style={{
                left: pu.pos.x * CELL_SIZE + 2,
                top: pu.pos.y * CELL_SIZE + 2,
                width: CELL_SIZE - 4,
                height: CELL_SIZE - 4,
                background: `${colors[pu.type]}20`,
                border: `2px solid ${colors[pu.type]}`,
                boxShadow: `0 0 10px ${colors[pu.type]}`,
                fontSize: "12px",
              }}
            >
              {icons[pu.type]}
            </div>
          );
        })}

        {/* Game Over */}
        {gameOver && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm">
            <p className="text-3xl font-bold text-red-400 mb-2">GAME OVER</p>
            <p className="text-xl text-green-400 mb-2">Score: {score}</p>
            <p className="text-lg text-yellow-400 mb-6">Length: {snake.length}</p>
            <button
              onClick={handleStart}
              className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-black font-bold rounded-lg hover:from-green-400 hover:to-emerald-400 transition-all"
            >
              PLAY AGAIN
            </button>
          </div>
        )}

        {/* Start Screen */}
        {!gameStarted && !gameOver && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center backdrop-blur-sm">
            <p className="text-3xl font-bold text-green-400 mb-2">SNAKE</p>
            <p className="text-gray-300 mb-6 text-center">
              Use arrow keys to move
              <br />
              Eat food to grow
            </p>
            <button
              onClick={handleStart}
              className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-black font-bold rounded-lg hover:from-green-400 hover:to-emerald-400 transition-all"
            >
              START GAME
            </button>
          </div>
        )}

        {/* Achievement Pop-up */}
        {showAchievement && (
          <div className="absolute top-4 left-4 animate-pulse">
            <div
              className="px-4 py-3 rounded-lg border border-green-400/50 backdrop-blur-sm"
              style={{ background: "rgba(16,185,129,0.1)" }}
            >
              <p className="font-mono-arc text-xs text-green-400 font-bold">🏆 ACHIEVEMENT</p>
              <p className="font-mono-arc text-[11px] text-green-300">
                {achievements.find((a) => a.id === showAchievement)?.name}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="text-center">
        <p className="font-mono-arc text-sm text-gray-400 uppercase tracking-wider mb-2">
          Score: <span className="text-green-400 text-2xl font-bold">{score}</span>
        </p>
        <p className="text-xs text-gray-500 mb-3">
          Length: {snake.length} | Combo: {combo}x | Multiplier: x{pointMultiplier}
        </p>
        {activePowerUp && (
          <p className="text-xs text-purple-400 mb-3">
            {activePowerUp === "freeze" && "❄️ Freeze Mode Active"}
            {activePowerUp === "double" && "2️⃣ Double Points Active"}
          </p>
        )}
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
      </div>
    </div>
  );
}