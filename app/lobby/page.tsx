"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import {
  fetchGames,
  fetchLeaderboard,
  fetchLiveMatch,
  fetchChatHistory,
  fetchUserStats,
  fetchPlayerCount,
  sendChatMessage,
  subscribeLobbyChat,
  subscribeLiveMatches,
  upsertUserProfile,
  shortenWallet,
  type Game,
  type LeaderboardEntry,
  type LiveMatch,
  type ChatMessage,
  type UserStats,
} from "../../lib/supabase";

// ─── Types ─────────────────────────────────────────────────────────────────────

type GameType = "all" | "arcade" | "multi" | "trivia";

// ─── useMiniPay ────────────────────────────────────────────────────────────────

function useMiniPay() {
  const [isMiniPay, setIsMiniPay] = useState(false);
  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();

  useEffect(() => {
    if ((window as any).ethereum?.isMiniPay) setIsMiniPay(true);
  }, []);

  useEffect(() => {
    if (isMiniPay && !authenticated) login();
  }, [isMiniPay, authenticated, login]);

  const wallet = isMiniPay
    ? wallets.find((w) => w.walletClientType !== "privy")
    : undefined;
  const address = wallet?.address ?? null;

  return {
    isMiniPay,
    address,
    shortAddress: address ? shortenWallet(address) : null,
    wallet: wallet ?? null,
  };
}

// ─── Liquid Background ─────────────────────────────────────────────────────────

function LiquidBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const blobs = [
      { x: 0.15, y: 0.12, r: 0.38, vx: 0.00018,  vy: 0.00012,  cr: [120, 80, 255]  as const, a: 0.18 },
      { x: 0.78, y: 0.08, r: 0.30, vx:-0.00014,  vy: 0.00016,  cr: [56, 189, 248]  as const, a: 0.15 },
      { x: 0.50, y: 0.55, r: 0.42, vx: 0.00010,  vy:-0.00010,  cr: [167, 100, 255] as const, a: 0.12 },
      { x: 0.88, y: 0.70, r: 0.28, vx:-0.00020,  vy:-0.00008,  cr: [244, 114, 182] as const, a: 0.13 },
      { x: 0.10, y: 0.80, r: 0.32, vx: 0.00016,  vy:-0.00014,  cr: [56, 189, 248]  as const, a: 0.10 },
      { x: 0.62, y: 0.25, r: 0.22, vx:-0.00012,  vy: 0.00020,  cr: [74, 222, 128]  as const, a: 0.09 },
    ];

    let t = 0, raf: number;
    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = document.documentElement.scrollHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#03040a";
      ctx.fillRect(0, 0, W, H);

      blobs.forEach((b, i) => {
        const phase = t * 0.0004 + i * 1.1;
        const bx = (b.x + Math.sin(phase * 0.7) * 0.04) * W;
        const by = (b.y + Math.cos(phase * 0.9) * 0.04) * H;
        const br = b.r * Math.max(W, H);
        const [r, g, bl] = b.cr;
        const grad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        grad.addColorStop(0,   `rgba(${r},${g},${bl},${b.a})`);
        grad.addColorStop(0.4, `rgba(${r},${g},${bl},${b.a * 0.5})`);
        grad.addColorStop(1,   `rgba(${r},${g},${bl},0)`);
        ctx.beginPath();
        for (let s = 0; s <= 7; s++) {
          const angle = (s / 7) * Math.PI * 2;
          const noise = 1 + 0.18 * Math.sin(angle * 3 + phase) + 0.09 * Math.cos(angle * 5 - phase * 1.3);
          const px = bx + Math.cos(angle) * br * noise;
          const py = by + Math.sin(angle) * br * noise;
          s === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
        b.x += b.vx; b.y += b.vy;
        if (b.x < -0.1 || b.x > 1.1) b.vx *= -1;
        if (b.y < -0.1 || b.y > 1.1) b.vy *= -1;
      });

      ctx.fillStyle = "rgba(3,4,10,0.45)";
      ctx.fillRect(0, 0, W, H);
      const vg = ctx.createRadialGradient(W*0.5, H*0.3, H*0.1, W*0.5, H*0.3, H*0.9);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.7)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
      t++;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  return (
    <canvas ref={canvasRef} className="fixed inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }} />
  );
}

// ─── LiveMatchBanner ──────────────────────────────────────────────────────────

function LiveMatchBanner({ match, onJoin }: { match: LiveMatch; onJoin: (id: string) => void }) {
  return (
    <div
      className="flex items-center justify-between gap-4 px-5 py-4 mb-6 overflow-hidden"
      style={{ background: "rgba(167,139,250,0.04)", border: "0.5px solid rgba(167,139,250,0.18)", borderRadius: "12px" }}
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className="relative flex-shrink-0">
          <div className="w-2 h-2 rounded-full bg-red-500" style={{ animation: "live-ping 1.5s infinite" }} />
          <style>{`@keyframes live-ping{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
        </div>
        <div className="min-w-0">
          <p className="font-mono-arc text-[9px] text-red-400 uppercase tracking-[0.18em] mb-0.5">Live</p>
          <p className="font-mono-arc text-sm font-bold text-gray-100 truncate">
            {match.gameTitle} · Round {match.round}
          </p>
          <p className="font-mono-arc text-[10px] text-gray-600 mt-0.5">
            {match.playerCount} players · +{match.pool} pool
          </p>
        </div>
      </div>
      <button
        onClick={() => onJoin(match.gameId)}
        className="font-mono-arc text-[10px] font-bold uppercase tracking-wider px-5 py-2.5 flex-shrink-0 transition-all hover:opacity-90"
        style={{ background: "#a78bfa", color: "#000", borderRadius: "6px" }}
      >
        Join match →
      </button>
    </div>
  );
}

// ─── GameCard ──────────────────────────────────────────────────────────────────

function GameCard({ game, onPlay }: { game: Game; onPlay: (gameId: string) => void }) {
  const TAG_STYLES: Record<Game["type"], string> = {
    arcade: "bg-violet-500/15 text-violet-300 border border-violet-500/30",
    multi:  "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
    trivia: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
  };
  const TAG_LABELS: Record<Game["type"], string> = {
    arcade: "Arcade", multi: "Multiplayer", trivia: "Trivia",
  };

  return (
    <div
      className="group flex flex-col cursor-pointer overflow-hidden transition-all duration-300 hover:-translate-y-0.5"
      style={{ background: "rgba(255,255,255,0.02)", border: "0.5px solid rgba(255,255,255,0.07)", borderRadius: "10px" }}
      onClick={() => onPlay(game.gameId)}
    >
      <div className="h-16 flex items-center justify-center text-2xl flex-shrink-0" style={{ background: game.thumbBg }}>
        <span role="img" aria-label={game.title}>{game.icon}</span>
      </div>
      <div className="p-3 flex flex-col gap-2 flex-grow">
        <p className="font-mono-arc text-[10px] font-bold text-gray-100 uppercase tracking-wider">{game.title}</p>
        <div className="flex items-center justify-between gap-1">
          <span className={`font-mono-arc text-[9px] px-1.5 py-0.5 rounded-sm uppercase tracking-wider ${TAG_STYLES[game.type]}`}>
            {TAG_LABELS[game.type]}
          </span>
          <span className="font-mono-arc text-[9px] text-amber-400">{game.reward}</span>
        </div>
        <p className="font-mono-arc text-[9px] text-gray-600 mt-auto">{game.players}</p>
        <button
          className="font-mono-arc text-[9px] w-full py-1.5 mt-1 rounded transition-all uppercase tracking-wider hover:opacity-90"
          style={{ background: "rgba(167,139,250,0.08)", border: "0.5px solid rgba(167,139,250,0.2)", color: "#a78bfa" }}
        >
          Play now →
        </button>
      </div>
    </div>
  );
}

// ─── StatBar ───────────────────────────────────────────────────────────────────

function StatBar({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <p className="font-mono-arc text-[9px] text-gray-600 uppercase tracking-wider">{label}</p>
        <p className="font-mono-arc text-sm font-bold" style={{ color }}>{value}</p>
      </div>
      <div className="h-px bg-white/[0.05]">
        <div className="h-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ─── LeaderboardRow ────────────────────────────────────────────────────────────

function LeaderboardRow({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const RANK_COLORS = ["#fbbf24", "#94a3b8", "#c4704f", "#64748b", "#64748b"];
  return (
    <div className="flex items-center gap-2 py-2 border-b border-white/[0.04] last:border-0">
      <span className="font-mono-arc text-[10px] font-bold w-5 flex-shrink-0" style={{ color: RANK_COLORS[rank] }}>
        {String(rank + 1).padStart(2, "0")}
      </span>
      <div
        className="w-6 h-6 rounded flex items-center justify-center font-mono-arc text-[9px] font-bold flex-shrink-0"
        style={{ background: entry.avatarColor, color: entry.avatarText }}
      >
        {entry.initials}
      </div>
      <span className="font-mono-arc text-[10px] text-gray-300 flex-1 truncate">{entry.name}</span>
      <span className="font-mono-arc text-[9px] text-violet-400 flex-shrink-0">{entry.xp}</span>
    </div>
  );
}

// ─── LobbyChat ────────────────────────────────────────────────────────────────

function LobbyChat({
  messages,
  onSend,
  shortAddress,
}: {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  shortAddress: string | null;
}) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const t = draft.trim();
    if (!t || !shortAddress) return;
    onSend(t);
    setDraft("");
  };

  return (
    <div>
      <div className="overflow-y-auto mb-2 pr-1" style={{ maxHeight: "140px" }}>
        {messages.map((m, i) => (
          <div key={m.id ?? i} className="mb-1.5">
            {m.isSystem ? (
              <p className="font-mono-arc text-[8px] text-gray-700 uppercase tracking-wider text-center">{m.message}</p>
            ) : (
              <>
                <span className="font-mono-arc text-[9px] text-violet-400">{m.username}: </span>
                <span className="font-mono-arc text-[9px] text-gray-500">{m.message}</span>
              </>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder={shortAddress ? "Say something…" : "Connect wallet to chat"}
          disabled={!shortAddress}
          className="flex-1 font-mono-arc text-[10px] px-2.5 py-1.5 rounded"
          style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.08)", color: "#9ca3af", outline: "none" }}
        />
        <button
          onClick={handleSend}
          disabled={!shortAddress || !draft.trim()}
          className="px-2.5 py-1.5 rounded font-mono-arc text-[10px] text-violet-400 transition-all disabled:opacity-30"
          style={{ background: "rgba(167,139,250,0.1)", border: "0.5px solid rgba(167,139,250,0.2)" }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}

// ─── SidebarCard ──────────────────────────────────────────────────────────────

function SidebarCard({ title, accentColor = "#a78bfa", children }: {
  title: string; accentColor?: string; children: React.ReactNode;
}) {
  return (
    <div
      className="relative overflow-hidden"
      style={{ background: "rgba(255,255,255,0.02)", border: "0.5px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "12px 14px" }}
    >
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg,transparent,${accentColor}40,transparent)` }} />
      <p className="font-mono-arc text-[9px] uppercase tracking-[0.18em] mb-3 flex items-center gap-2" style={{ color: accentColor }}>
        {title}
        <span className="flex-1 h-px inline-block" style={{ background: `${accentColor}18` }} />
      </p>
      {children}
    </div>
  );
}

// ─── Main Lobby Page ───────────────────────────────────────────────────────────

export default function LobbyPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<GameType>("all");

  const [games, setGames] = useState<Game[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [liveMatch, setLiveMatch] = useState<LiveMatch | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [playerCount, setPlayerCount] = useState("—");
  const [loading, setLoading] = useState(true);

  const { ready, authenticated, user, logout } = usePrivy();
  const { wallets } = useWallets();
  const { isMiniPay, address: miniPayAddress, shortAddress: miniPayShort } = useMiniPay();

  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
  const externalWallet = wallets.find((w) => w.walletClientType !== "privy");

  const activeAddress =
    isMiniPay
      ? miniPayAddress
      : embeddedWallet?.address ?? externalWallet?.address ?? user?.wallet?.address ?? null;

  const shortAddress = activeAddress ? shortenWallet(activeAddress) : null;

  useEffect(() => {
    if (ready && !authenticated && !isMiniPay) router.replace("/");
  }, [ready, authenticated, isMiniPay, router]);

  useEffect(() => {
    if (activeAddress) upsertUserProfile(activeAddress);
  }, [activeAddress]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [gData, lbData, live, chat, players] = await Promise.all([
        fetchGames(),
        fetchLeaderboard(),
        fetchLiveMatch(),
        fetchChatHistory(),
        fetchPlayerCount(),
      ]);

      setGames(gData);
      setLeaderboard(lbData);
      setLiveMatch(live);
      setChatMessages([
        ...chat,
        { id: -1, wallet: "", username: "", message: "You joined the lobby", createdAt: new Date().toISOString(), isSystem: true },
      ]);
      setPlayerCount(players);

      if (activeAddress) {
        setUserStats(await fetchUserStats(activeAddress));
      }

      setLoading(false);
    };

    load();
  }, [activeAddress]);

  useEffect(() => {
    const unsub = subscribeLobbyChat((msg) => {
      setChatMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = subscribeLiveMatches(async () => {
      const live = await fetchLiveMatch();
      setLiveMatch(live);
      const players = await fetchPlayerCount();
      setPlayerCount(players);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      setLeaderboard(await fetchLeaderboard());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Use game_id slug for routing, not UUID
  const handlePlay = useCallback(
    (gameId: string) => router.push(`/game/${gameId}`),
    [router]
  );
  const handleJoinLive = useCallback(
    (gameId: string) => router.push(`/game/${gameId}?live=1`),
    [router]
  );

  const handleSendChat = useCallback(
    async (text: string) => {
      if (!activeAddress) return;
      const optimistic: ChatMessage = {
        id: Date.now(),
        wallet: activeAddress,
        username: shortAddress ?? activeAddress,
        message: text,
        createdAt: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, optimistic]);
      await sendChatMessage(activeAddress, text, shortAddress ?? undefined);
    },
    [activeAddress, shortAddress]
  );

  const filteredGames = filter === "all" ? games : games.filter((g) => g.type === filter);

  if (!ready) {
    return (
      <main className="relative min-h-screen w-full flex items-center justify-center">
        <LiquidBackground />
        <p className="font-mono-arc text-xs text-gray-600 relative z-10 uppercase tracking-widest animate-pulse">
          Entering lobby…
        </p>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen w-full text-gray-100">
      <LiquidBackground />

      <div className="relative z-10">
        {/* ── Nav ── */}
        <nav
          className="w-full sticky top-0 z-40 border-b border-white/[0.07]"
          style={{ background: "rgba(3,4,10,0.85)", backdropFilter: "blur(12px)" }}
        >
          <div className="flex items-center justify-between px-4 sm:px-6 py-3.5">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/")}
                className="font-mono-arc text-sm font-bold tracking-widest uppercase"
              >
                mini<span className="text-violet-400">game</span>
              </button>
              <span className="hidden sm:inline font-mono-arc text-[9px] text-violet-400 border border-violet-500/25 px-2 py-0.5 rounded-sm uppercase tracking-wider">
                Lobby
              </span>
            </div>

            <div className="flex items-center gap-3">
              {(authenticated || isMiniPay) && shortAddress && (
                <div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                  style={{
                    background: isMiniPay ? "rgba(56,189,248,0.08)" : "rgba(167,139,250,0.08)",
                    border: `0.5px solid ${isMiniPay ? "rgba(56,189,248,0.25)" : "rgba(167,139,250,0.25)"}`,
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#4ade80", boxShadow: "0 0 5px #4ade80" }} />
                  <span className={`font-mono-arc text-[10px] tracking-wider hidden sm:inline ${isMiniPay ? "text-cyan-300" : "text-violet-300"}`}>
                    {isMiniPay ? (miniPayShort ?? shortAddress) : shortAddress}
                  </span>
                </div>
              )}
              {!isMiniPay && authenticated && (
                <button
                  onClick={logout}
                  className="font-mono-arc text-[9px] text-gray-600 hover:text-gray-400 uppercase tracking-wider transition-colors"
                >
                  Disconnect
                </button>
              )}
            </div>
          </div>
        </nav>

        {/* ── Ticker ── */}
        <div
          className="flex items-center gap-5 px-4 sm:px-6 py-2 border-b border-white/[0.04] overflow-x-auto"
          style={{ background: "rgba(0,0,0,0.3)", backdropFilter: "blur(8px)" }}
        >
          <span className="font-mono-arc text-[10px] text-gray-500 flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" style={{ boxShadow: "0 0 5px #4ade80" }} />
            NET: <span className="text-violet-400">LIVE</span>
          </span>
          <span className="font-mono-arc text-[10px] text-gray-500 whitespace-nowrap">
            ONLINE: <span className="text-violet-400">{playerCount}</span>
          </span>
          <span className="font-mono-arc text-[10px] text-gray-500 whitespace-nowrap">
            GAMES: <span className="text-violet-400">{games.length}</span>
          </span>
          <span className="font-mono-arc text-[10px] text-gray-600 ml-auto whitespace-nowrap tracking-widest">
            ALL SYSTEMS NOMINAL
          </span>
        </div>

        {/* ── Main layout ── */}
        <div className="flex flex-col lg:flex-row min-h-[calc(100vh-80px)]">

          {/* ── Game browser ── */}
          <div className="flex-1 px-4 sm:px-6 py-6 min-w-0">

            {liveMatch && (
              <LiveMatchBanner match={liveMatch} onJoin={handleJoinLive} />
            )}

            <div className="flex items-center gap-3 mb-4">
              <span className="font-mono-arc text-[9px] text-gray-500 uppercase tracking-[0.2em] whitespace-nowrap">
                All games
              </span>
              <div className="flex-1 h-px bg-white/[0.05]" />
              <span className="font-mono-arc text-[9px] text-violet-400 border border-violet-500/25 px-2 py-0.5 rounded-sm whitespace-nowrap">
                {games.length} active
              </span>
            </div>

            <div className="flex gap-2 mb-5">
              {(["all", "arcade", "multi", "trivia"] as GameType[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`font-mono-arc text-[9px] px-3 py-1.5 rounded-sm uppercase tracking-wider transition-all ${
                    filter === f ? "bg-violet-500 text-black font-bold" : "text-gray-500 hover:text-gray-200"
                  }`}
                  style={filter !== f ? { background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.08)" } : {}}
                >
                  {f === "all" ? "All Games" : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-44 rounded-lg animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
                ))}
              </div>
            ) : filteredGames.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredGames.map((game) => (
                  <GameCard key={game.id} game={game} onPlay={handlePlay} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <p className="font-mono-arc text-[10px] text-gray-600 uppercase tracking-widest">
                  No games in this category
                </p>
                <button
                  onClick={() => setFilter("all")}
                  className="font-mono-arc text-[9px] text-violet-400 hover:text-violet-300 uppercase tracking-wider transition-colors"
                >
                  Show all →
                </button>
              </div>
            )}
          </div>

          {/* ── Sidebar ── */}
          <div className="w-full lg:w-[220px] flex-shrink-0 px-4 sm:px-6 lg:px-4 py-6 flex flex-col gap-4 border-t lg:border-t-0 lg:border-l border-white/[0.05]">

            <SidebarCard title="Your stats" accentColor="#a78bfa">
              {userStats ? (
                <>
                  <StatBar label="XP" value={userStats.xp} pct={userStats.xpPct} color="#a78bfa" />
                  <StatBar label="USDm balance" value={userStats.earnings} pct={userStats.earningsPct} color="#38bdf8" />
                  <StatBar label="Win rate" value={userStats.winRate} pct={userStats.winPct} color="#4ade80" />
                </>
              ) : (
                <div className="space-y-3">
                  {["XP", "USDm balance", "Win rate"].map((l) => (
                    <div key={l}>
                      <p className="font-mono-arc text-[9px] text-gray-700 uppercase tracking-wider mb-1">{l}</p>
                      <p className="font-mono-arc text-sm font-bold text-gray-700">—</p>
                      <div className="h-px bg-white/[0.03] mt-2" />
                    </div>
                  ))}
                </div>
              )}
            </SidebarCard>

            <SidebarCard title="Top players" accentColor="#f472b6">
              {loading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-7 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
                  ))}
                </div>
              ) : leaderboard.length > 0 ? (
                leaderboard.map((entry, i) => (
                  <LeaderboardRow key={entry.name} entry={entry} rank={i} />
                ))
              ) : (
                <p className="font-mono-arc text-[9px] text-gray-700 text-center py-2">No data yet</p>
              )}
            </SidebarCard>

            <SidebarCard title="Lobby chat · live" accentColor="#38bdf8">
              <LobbyChat
                messages={chatMessages}
                onSend={handleSendChat}
                shortAddress={shortAddress}
              />
            </SidebarCard>

            <div className="flex flex-col gap-2">
              {[
                { label: "Match history", icon: "⏱", path: "/history" },
                { label: "Withdraw USDm", icon: "⬡", path: "/wallet" },
                { label: "Settings", icon: "⚙", path: "/settings" },
              ].map(({ label, icon, path }) => (
                <button
                  key={label}
                  onClick={() => router.push(path)}
                  className="flex items-center gap-2 px-3 py-2 font-mono-arc text-[9px] text-gray-500 hover:text-gray-200 uppercase tracking-wider transition-all rounded"
                  style={{ background: "rgba(255,255,255,0.02)", border: "0.5px solid rgba(255,255,255,0.05)" }}
                >
                  <span>{icon}</span>
                  {label}
                </button>
              ))}
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}