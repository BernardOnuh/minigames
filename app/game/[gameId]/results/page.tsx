"use client";

import { use, useCallback, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchGameLeaderboard } from "../../../../lib/supabase";

type ScoreEntry = {
  wallet: string;
  username: string;
  score: number;
  created_at: string;
};

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

  const [topScores, setTopScores] = useState<ScoreEntry[]>([]);
  const [scoresLoading, setScoresLoading] = useState(true);

  useEffect(() => {
    fetchGameLeaderboard(gameId, 5)
      .then(setTopScores)
      .catch(() => setTopScores([]))
      .finally(() => setScoresLoading(false));
  }, [gameId]);

  const handleBackToLobby = useCallback(() => {
    router.push("/lobby");
  }, [router]);

  const handlePlayAgain = useCallback(() => {
    router.push(`/game/${gameId}`);
  }, [router, gameId]);

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center bg-black px-4">
      <div className="flex flex-col items-center gap-8 max-w-sm w-full">
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
                <p className="font-mono-arc text-[9px] text-gray-500 uppercase tracking-[0.2em] mb-1">Points</p>
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

        {/* Top scores mini-leaderboard */}
        {!scoresLoading && topScores.length > 0 && score && (
          <div className="w-full" style={{ maxWidth: 320 }}>
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: "rgba(7,9,26,0.5)", border: "0.5px solid rgba(255,255,255,0.06)" }}
            >
              <div
                className="px-4 py-2 border-b border-white/[0.06] flex items-center gap-2"
                style={{ background: "rgba(255,255,255,0.02)" }}
              >
                <span className="font-mono-arc text-[9px] text-amber-400 uppercase tracking-[0.2em]">Top scores</span>
                <span className="flex-1 h-px bg-white/[0.04]" />
                <button
                  onClick={() => router.push(`/leaderboard`)}
                  className="font-mono-arc text-[8px] text-gray-600 hover:text-gray-400 uppercase tracking-wider transition-colors"
                >
                  Full board →
                </button>
              </div>
              {topScores.map((entry, i) => {
                const myScore = entry.wallet.toLowerCase() === "placeholder";
                return (
                  <div
                    key={`${entry.wallet}-${i}`}
                    className={`flex items-center gap-2 px-4 py-2 border-b border-white/[0.03] last:border-0 ${myScore ? "bg-violet-500/5" : ""}`}
                  >
                    <span className="font-mono-arc text-[10px] font-bold w-4 flex-shrink-0" style={{ color: i === 0 ? "#fbbf24" : i === 1 ? "#94a3b8" : i === 2 ? "#c4704f" : "#64748b" }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="font-mono-arc text-[10px] text-gray-300 flex-1 truncate">{entry.username}</span>
                    <span className="font-mono-arc text-[10px] text-amber-400 flex-shrink-0">{entry.score.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-2">
          <button
            onClick={handlePlayAgain}
            className="font-mono-arc text-xs font-bold uppercase tracking-widest px-6 py-3 rounded-lg transition-all hover:opacity-90 active:scale-95"
            style={{
              background: "linear-gradient(135deg,#7c3aed,#a78bfa)",
              color: "#fff",
              boxShadow: "0 0 24px rgba(167,139,250,0.3)",
            }}
          >
            Replay
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
            Leave
          </button>
        </div>
      </div>
    </main>
  );
}