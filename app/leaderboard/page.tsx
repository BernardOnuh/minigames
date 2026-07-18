"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  fetchLeaderboard,
  fetchGameLeaderboard,
  fetchGames,
  shortenWallet,
  type LeaderboardEntry,
  type Game,
} from "../../lib/supabase";

const RANK_COLORS = ["#fbbf24", "#c0c8d8", "#cd7f50", "#6b7a8f", "#6b7a8f"];

function LeaderboardRow({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] px-3 -mx-3 transition-colors">
      <span className="font-mono-arc text-sm w-6 flex-shrink-0 font-bold text-center" style={{ color: RANK_COLORS[Math.min(rank, 4)] }}>
        {rank === 0 ? "🥇" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : String(rank + 1).padStart(2, "0")}
      </span>
      <div
        className="w-8 h-8 rounded-sm flex items-center justify-center font-mono-arc text-xs font-bold flex-shrink-0"
        style={{ background: entry.avatarColor, color: entry.avatarText }}
      >
        {entry.initials}
      </div>
      <span className="font-mono-arc text-xs text-gray-200 flex-1 truncate">{entry.name}</span>
      <span className="font-mono-arc text-[11px] text-violet-400 flex-shrink-0 text-right">{entry.xp}</span>
    </div>
  );
}

type Tab = "global" | "flappy_bird" | "snake" | "trivia" | "mini_golf" | "fruit_blitz";

const GAME_ICONS: Record<Exclude<Tab, "global">, string> = {
  flappy_bird: "🐦",
  snake: "🐍",
  trivia: "🧠",
  mini_golf: "🏌️",
  fruit_blitz: "🍉",
};

export default function LeaderboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("global");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [gameScores, setGameScores] = useState<{ wallet: string; username: string; score: number; created_at: string }[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGames().then(setGames).catch(() => {});
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (tab === "global") {
          const data = await fetchLeaderboard(50);
          setLeaderboard(data);
        } else {
          const data = await fetchGameLeaderboard(tab, 50);
          setGameScores(data);
        }
      } catch {
        setLeaderboard([]);
        setGameScores([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tab]);

  const handleBack = useCallback(() => router.back(), [router]);

  return (
    <main className="relative min-h-screen w-full text-gray-100">
      {/* Background */}
      <div className="fixed inset-0" style={{ background: "#03040a" }} />
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 20% 50%, rgba(120,80,255,0.08), transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(56,189,248,0.05), transparent 50%)",
        }}
      />

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Nav */}
        <nav className="flex items-center justify-between mb-6 sm:mb-8">
          <button
            onClick={handleBack}
            className="font-mono-arc text-[10px] text-gray-500 hover:text-gray-300 uppercase tracking-wider transition-colors flex items-center gap-1.5"
          >
            ← Back
          </button>
          <span className="font-mono-arc text-sm font-bold tracking-widest uppercase">
            mini<span className="text-violet-400">game</span>
          </span>
          <div className="w-16" />
        </nav>

        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <p className="font-mono-arc text-[9px] text-violet-400 uppercase tracking-[0.2em] mb-2">Leaderboard</p>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            <span className="text-violet-400">Rankings</span>
          </h1>
          <p className="font-mono-arc text-[9px] text-gray-600 mt-1">Top players — weekly standings</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1">
          <TabButton label="🌐 Global" active={tab === "global"} onClick={() => setTab("global")} />
          {(Object.keys(GAME_ICONS) as Exclude<Tab, "global">[]).map((key) => (
            <TabButton
              key={key}
              label={`${GAME_ICONS[key]} ${games.find((g) => g.gameId === key)?.title ?? key}`}
              active={tab === key}
              onClick={() => setTab(key)}
            />
          ))}
        </div>

        {/* Content */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "rgba(7,9,26,0.6)", border: "0.5px solid rgba(255,255,255,0.08)" }}
        >
          {/* Column headers */}
          <div
            className="flex items-center gap-3 px-3 py-2.5 border-b border-white/[0.06]"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <span className="w-6 flex-shrink-0" />
            <span className="w-8 flex-shrink-0" />
            <span className="font-mono-arc text-[9px] text-gray-600 uppercase tracking-wider flex-1">Gamer</span>
            <span className="font-mono-arc text-[9px] text-gray-600 uppercase tracking-wider flex-shrink-0 text-right w-20">
              {tab === "global" ? "XP" : "Score"}
            </span>
          </div>

          {loading ? (
            <div className="p-4 space-y-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-10 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
              ))}
            </div>
          ) : tab === "global" ? (
            leaderboard.length > 0 ? (
              <div className="divide-y divide-white/[0.03]">
                {leaderboard.map((entry, i) => (
                  <LeaderboardRow key={`${entry.name}-${i}`} entry={entry} rank={i} />
                ))}
              </div>
            ) : (
              <EmptyState message="No leaderboard data yet" />
            )
          ) : (
            gameScores.length > 0 ? (
              <div className="divide-y divide-white/[0.03]">
                {gameScores.map((entry, i) => (
                  <div
                    key={`${entry.wallet}-${i}`}
                    className="flex items-center gap-3 py-3 px-3 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
                  >
                    <span
                      className="font-mono-arc text-sm w-6 flex-shrink-0 font-bold text-center"
                      style={{ color: RANK_COLORS[Math.min(i, 4)] }}
                    >
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : String(i + 1).padStart(2, "0")}
                    </span>
                    <div
                      className="w-8 h-8 rounded-sm flex items-center justify-center font-mono-arc text-xs font-bold flex-shrink-0"
                      style={{ background: "#a78bfa", color: "#000" }}
                    >
                      {entry.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-mono-arc text-xs text-gray-200 flex-1 truncate">{entry.username}</span>
                    <span className="font-mono-arc text-[11px] text-amber-400 flex-shrink-0 text-right w-20">
                      {entry.score.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="No scores for this game yet" />
            )
          )}
        </div>

        <div className="text-center mt-6">
          <button
            onClick={() => router.push("/lobby")}
            className="font-mono-arc text-[10px] text-violet-400 hover:text-violet-300 uppercase tracking-wider transition-colors"
          >
            ← Back to lobby
          </button>
        </div>
      </div>
    </main>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`font-mono-arc text-[9px] px-3 py-1.5 rounded-sm uppercase tracking-wider whitespace-nowrap transition-all flex-shrink-0 ${
        active
          ? "bg-violet-500 text-black font-bold"
          : "text-gray-500 hover:text-gray-200"
      }`}
      style={!active ? { background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.08)" } : {}}
    >
      {label}
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-2">
      <span className="text-2xl">🏆</span>
      <p className="font-mono-arc text-[10px] text-gray-600 uppercase tracking-widest">{message}</p>
    </div>
  );
}
