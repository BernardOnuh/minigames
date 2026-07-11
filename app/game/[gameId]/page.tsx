"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import {
  fetchGameConfig,
  startGameSession,
  completeGameResult,
  failGameResult,
  upsertUserProfile,
  type GameConfig,
  type GameResult,
} from "../../../lib/gameSupabase";
import { shortenWallet } from "../../../lib/supabase";

import FlappyBirdGame from "../../../components/games/FlappyBird";
import SnakeGame from "../../../components/games/Snake";
import TriviaGame from "../../../components/games/Trivia";
import MiniGolfGame from "../../../components/games/MiniGolf";
import FruitBlitzGame from "../../../components/games/FruitBlitz";


type GamePageProps = {
  params: Promise<{ gameId: string }>;
};

const GAME_COMPONENTS: Record<string, React.ComponentType<GameProps>> = {
  flappy_bird: FlappyBirdGame,
  snake: SnakeGame,
  trivia: TriviaGame,
  mini_golf: MiniGolfGame,
  fruit_blitz: FruitBlitzGame,
};

export type GameProps = {
  gameConfig: GameConfig;
  onGameComplete: (score: number, metadata?: Record<string, any>) => void;
  onGameFail: () => void;
  shortAddress: string | null;
};

export default function GamePage({ params }: GamePageProps) {
  const { gameId } = use(params); // ← unwrap Promise in client component
  const router = useRouter();
  const { authenticated, user } = usePrivy();
  const { wallets } = useWallets();

  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);
  const [gameSession, setGameSession] = useState<GameResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeAddress = wallets[0]?.address ?? user?.wallet?.address ?? null;
  const shortAddress = activeAddress ? shortenWallet(activeAddress) : null;

  // Redirect if not authenticated
  useEffect(() => {
    if (!authenticated || !activeAddress) {
      router.replace("/");
    }
  }, [authenticated, activeAddress, router]);

  // Load game config
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const config = await fetchGameConfig(gameId);

        if (!config) {
          setError("Game not found");
          return;
        }

        setGameConfig(config);

        if (activeAddress) {
          await upsertUserProfile(activeAddress, shortAddress || undefined);

          const session = await startGameSession(
            activeAddress,
            config.game_id
          );
          if (session) {
            setGameSession(session);
          }
        }
      } catch (err) {
        setError("Failed to load game");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [gameId, activeAddress, shortAddress]);

  const handleGameComplete = useCallback(
    async (score: number, metadata?: Record<string, any>) => {
      if (!gameSession || !activeAddress || !gameConfig) return;

      const duration = Math.floor(
        (Date.now() - new Date(gameSession.created_at).getTime()) / 1000
      );

      const result = await completeGameResult(
        gameSession.id!,
        score,
        duration,
        gameConfig.base_xp
      );

      if (result) {
        router.push(
          `/game/${gameId}/results?score=${score}&xp=${result.xp_earned}&duration=${duration}`
        );
      }
    },
    [gameSession, activeAddress, gameConfig, gameId, router]
  );

  const handleGameFail = useCallback(async () => {
    if (!gameSession) return;

    await failGameResult(gameSession.id!);

    router.push(`/game/${gameId}/results?status=failed`);
  }, [gameSession, gameId, router]);

  const handleQuit = useCallback(() => {
    router.push("/lobby");
  }, [router]);

  if (loading) {
    return (
      <main className="relative min-h-screen w-full flex items-center justify-center bg-black">
        <p className="font-mono-arc text-xs text-gray-600 uppercase tracking-widest animate-pulse">
          Loading game…
        </p>
      </main>
    );
  }

  if (error || !gameConfig) {
    return (
      <main className="relative min-h-screen w-full flex flex-col items-center justify-center gap-4 bg-black px-4">
        <p className="font-mono-arc text-sm text-red-400 uppercase tracking-wider">
          {error || "Game not found"}
        </p>
        <button
          onClick={handleQuit}
          className="font-mono-arc text-xs text-violet-400 hover:text-violet-300 uppercase tracking-wider transition-colors"
        >
          Back to lobby →
        </button>
      </main>
    );
  }

  const GameComponent = GAME_COMPONENTS[gameId];

  if (!GameComponent) {
    return (
      <main className="relative min-h-screen w-full flex flex-col items-center justify-center gap-4 bg-black px-4">
        <p className="font-mono-arc text-sm text-red-400 uppercase tracking-wider">
          Game not implemented yet
        </p>
        <button
          onClick={handleQuit}
          className="font-mono-arc text-xs text-violet-400 hover:text-violet-300 uppercase tracking-wider transition-colors"
        >
          Back to lobby →
        </button>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen w-full bg-black overflow-hidden">
      {/* Header */}
      <div
        className="absolute top-0 left-0 right-0 z-50 border-b border-white/[0.07] px-4 sm:px-6 py-3"
        style={{ background: "rgba(3,4,10,0.9)", backdropFilter: "blur(12px)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-mono-arc text-sm font-bold text-gray-100 uppercase tracking-wider">
              {gameConfig.game_title}
            </h1>
            <p className="font-mono-arc text-[9px] text-gray-600 mt-0.5">
              {shortAddress}
            </p>
          </div>
          <button
            onClick={handleQuit}
            className="font-mono-arc text-[9px] text-gray-500 hover:text-gray-300 uppercase tracking-wider transition-colors px-3 py-1.5 rounded"
            style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.08)" }}
          >
            Quit ✕
          </button>
        </div>
      </div>

      {/* Game Container */}
      <div className="pt-16 min-h-screen flex items-center justify-center">
        <GameComponent
          gameConfig={gameConfig}
          onGameComplete={handleGameComplete}
          onGameFail={handleGameFail}
          shortAddress={shortAddress}
        />
      </div>
    </main>
  );
}