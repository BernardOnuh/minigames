"use client";

import { use, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function GameResultsPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  const score = searchParams.get("score");
  const xp = searchParams.get("xp");
  const duration = searchParams.get("duration");
  const status = searchParams.get("status");

  const handleBackToLobby = useCallback(() => {
    router.push("/lobby");
  }, [router]);

  const handlePlayAgain = useCallback(() => {
    router.push(`/game/${gameId}`);
  }, [router, gameId]);

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center bg-black">
      <div className="flex flex-col items-center gap-8 px-6 max-w-sm w-full">
        {status === "failed" ? (
          <>
            <div style={{ fontSize: 64 }}>💀</div>
            <p className="font-mono-arc text-2xl font-bold text-red-400 uppercase tracking-wider">Game Over</p>
            <p className="font-mono-arc text-[10px] text-gray-500 uppercase tracking-[0.2em] text-center">
              Better luck next time!
            </p>
          </>
        ) : (
          <>
            <div style={{ fontSize: 64 }}>🏆</div>
            <p className="font-mono-arc text-2xl font-bold text-amber-400 uppercase tracking-wider">Results</p>
            
            <div className="flex gap-8 items-center justify-center">
              <div className="text-center">
                <p className="font-mono-arc text-[9px] text-gray-500 uppercase tracking-[0.2em] mb-1">Score</p>
                <p className="font-mono-arc text-4xl font-bold text-white">{Number(score).toLocaleString()}</p>
              </div>
              <div className="w-px h-12 bg-white/10" />
              <div className="text-center">
                <p className="font-mono-arc text-[9px] text-gray-500 uppercase tracking-[0.2em] mb-1">XP Earned</p>
                <p className="font-mono-arc text-4xl font-bold text-violet-400">+{xp}</p>
              </div>
            </div>

            {duration && (
              <p className="font-mono-arc text-[10px] text-gray-600">
                Duration: {Number(duration)}s
              </p>
            )}
          </>
        )}

        <div className="flex gap-3 mt-4">
          <button
            onClick={handlePlayAgain}
            className="font-mono-arc text-xs font-bold uppercase tracking-widest px-6 py-3 rounded-lg transition-all hover:opacity-90 active:scale-95"
            style={{
              background: "linear-gradient(135deg,#7c3aed,#a78bfa)",
              color: "#fff",
              boxShadow: "0 0 24px rgba(167,139,250,0.3)",
            }}
          >
            Play Again
          </button>
          <button
            onClick={handleBackToLobby}
            className="font-mono-arc text-[10px] uppercase tracking-widest px-5 py-3 rounded-lg transition-all hover:opacity-80"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "0.5px solid rgba(255,255,255,0.12)",
              color: "#9ca3af",
            }}
          >
            Back to Lobby
          </button>
        </div>
      </div>
    </main>
  );
}