"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useRouter } from "next/navigation"; // For Next.js 13+
import { ethers } from "ethers";

// ─── Types ────────────────────────────────────────────────────────────────────

type GameType = "all" | "arcade" | "multi" | "trivia";
type ConnectStep = "idle" | "connecting" | "success";

interface Game {
  id: string;
  title: string;
  type: Exclude<GameType, "all">;
  icon: string;
  reward: string;
  players: string;
  thumbBg: string;
}

interface LeaderboardEntry {
  name: string;
  initials: string;
  xp: string;
  coins: string;
  avatarColor: string;
  avatarText: string;
}

interface HudStat {
  label: string;
  val: string;
  color: string;
  pct: number;
}

// ─── Network Configuration ────────────────────────────────────────────────────

const NETWORK_CONFIG = {
  isMainnet: true,
  chainId: 1,
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || "https://eth-mainnet.g.alchemy.com/v2/demo",
  blockExplorer: "https://etherscan.io",
  displayName: "ETHEREUM MAINNET",
  usdmTokenAddress: process.env.NEXT_PUBLIC_USDM_TOKEN_ADDRESS || "0x...",
  gameContractAddress: process.env.NEXT_PUBLIC_GAME_CONTRACT_ADDRESS || "0x...",
  backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL || "https://api.minigame.com",
};

// ─── API Services ─────────────────────────────────────────────────────────────

async function fetchUSDmPrice(): Promise<string> {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=true-usd&vs_currencies=usd"
    );
    const data = await response.json();
    return data["true-usd"]?.usd?.toFixed(4) || "$1.00";
  } catch (error) {
    console.warn("Failed to fetch USDm price:", error);
    return "$1.00";
  }
}

async function fetchBlockNumber(): Promise<string> {
  try {
    const provider = new ethers.JsonRpcProvider(NETWORK_CONFIG.rpcUrl);
    const blockNumber = await provider.getBlockNumber();
    return `#${blockNumber.toLocaleString()}`;
  } catch (error) {
    console.warn("Failed to fetch block number:", error);
    return "#N/A";
  }
}

async function fetchGames(): Promise<Game[]> {
  try {
    const response = await fetch(`${NETWORK_CONFIG.backendUrl}/api/games`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) throw new Error("Failed to fetch games");
    
    const games = await response.json();
    return games.map((game: any) => ({
      id: game.id,
      title: game.title,
      type: game.type,
      icon: game.icon,
      reward: game.reward,
      players: game.activePlayers?.toString() || "0 playing",
      thumbBg: game.thumbBg || "linear-gradient(135deg,#100c2e,#1e1557)",
    }));
  } catch (error) {
    console.warn("Failed to fetch games:", error);
    return [];
  }
}

async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const response = await fetch(
      `${NETWORK_CONFIG.backendUrl}/api/leaderboard?limit=5&period=weekly`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) throw new Error("Failed to fetch leaderboard");

    const entries = await response.json();
    return entries.map((entry: any) => ({
      name: entry.username,
      initials: entry.username.charAt(0).toUpperCase(),
      xp: `${entry.xp.toLocaleString()} XP`,
      coins: `${entry.earnings.toLocaleString()} USDm`,
      avatarColor: entry.avatarColor,
      avatarText: entry.avatarTextColor,
    }));
  } catch (error) {
    console.warn("Failed to fetch leaderboard:", error);
    return [];
  }
}

async function fetchUserStats(walletAddress: string): Promise<{
  xp: string;
  earnings: string;
  winRate: string;
}> {
  try {
    const response = await fetch(
      `${NETWORK_CONFIG.backendUrl}/api/users/${walletAddress}/stats`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) throw new Error("Failed to fetch user stats");

    const stats = await response.json();
    return {
      xp: stats.xp.toLocaleString(),
      earnings: `${stats.earnings.toLocaleString()} USDm`,
      winRate: `${Math.round(stats.wins / (stats.wins + stats.losses) * 100)}%`,
    };
  } catch (error) {
    console.warn("Failed to fetch user stats:", error);
    return { xp: "—", earnings: "— USDm", winRate: "—" };
  }
}

async function fetchPlayerCount(): Promise<string> {
  try {
    const response = await fetch(`${NETWORK_CONFIG.backendUrl}/api/stats/players`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) throw new Error("Failed to fetch player count");

    const data = await response.json();
    return data.active.toLocaleString();
  } catch (error) {
    console.warn("Failed to fetch player count:", error);
    return "—";
  }
}

async function fetchTotalDistributed(): Promise<string> {
  try {
    const response = await fetch(
      `${NETWORK_CONFIG.backendUrl}/api/stats/total-distributed`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) throw new Error("Failed to fetch total distributed");

    const data = await response.json();
    const totalInK = (data.total / 1000).toFixed(0);
    return `${totalInK}K`;
  } catch (error) {
    console.warn("Failed to fetch total distributed:", error);
    return "—";
  }
}

// ─── useMiniPay Hook ──────────────────────────────────────────────────────────

function useMiniPay() {
  const [isMiniPay, setIsMiniPay] = useState(false);
  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();

  useEffect(() => {
    const provider = (window as any).ethereum;
    if (provider?.isMiniPay) {
      setIsMiniPay(true);
    }
  }, []);

  useEffect(() => {
    if (isMiniPay && !authenticated) {
      login();
    }
  }, [isMiniPay, authenticated, login]);

  const miniPayWallet = isMiniPay
    ? wallets.find((w) => w.walletClientType !== "privy")
    : undefined;

  const address = miniPayWallet?.address ?? null;
  const shortAddress = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : null;

  return {
    isMiniPay,
    address,
    shortAddress,
    wallet: miniPayWallet ?? null,
  };
}

// ─── Liquid Background ────────────────────────────────────────────────────────

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

    let t = 0;
    let raf: number;

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
          const noise =
            1 +
            0.18 * Math.sin(angle * 3 + phase) +
            0.09 * Math.cos(angle * 5 - phase * 1.3);
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

      const vg = ctx.createRadialGradient(W * 0.5, H * 0.3, H * 0.1, W * 0.5, H * 0.3, H * 0.9);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.7)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);

      t++;
      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}

// ─── Connect Modal ────────────────────────────────────────────────────────────

function ConnectModal({
  step,
  onClose,
  shortAddress,
}: {
  step: ConnectStep;
  onClose: () => void;
  shortAddress: string | null;
}) {
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      onClick={handleBackdrop}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
    >
      {step === "connecting" && (
        <div
          className="w-full max-w-xs overflow-hidden"
          style={{
            background: "#0c0d14",
            border: "0.5px solid rgba(56,189,248,0.25)",
            borderRadius: "14px",
          }}
        >
          <div style={{ height: "1px", background: "linear-gradient(90deg,transparent,#38bdf8,transparent)" }} />
          <div className="p-6 text-center">
            <div className="relative w-14 h-14 mx-auto mb-5">
              <div
                className="absolute inset-0 rounded-xl flex items-center justify-center text-2xl"
                style={{ background: "rgba(56,189,248,0.08)", border: "0.5px solid rgba(56,189,248,0.2)" }}
              >
                🔗
              </div>
              <div
                className="absolute"
                style={{
                  inset: "-3px",
                  borderRadius: "15px",
                  border: "2px solid transparent",
                  borderTopColor: "#38bdf8",
                  animation: "arc-spin 0.8s linear infinite",
                }}
              />
            </div>
            <p className="font-mono-arc text-sm font-bold text-gray-100 mb-2">Connecting wallet…</p>
            <p className="font-mono-arc text-[11px] text-gray-500 leading-relaxed">
              Privy is opening — check your<br />email or wallet app
            </p>
            <button
              onClick={onClose}
              className="font-mono-arc text-[10px] text-gray-600 uppercase tracking-widest mt-5 hover:text-gray-400 transition-colors"
            >
              Cancel
            </button>
          </div>
          <style>{`@keyframes arc-spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {step === "success" && (
        <div
          className="w-full max-w-xs overflow-hidden"
          style={{
            background: "#0c0d14",
            border: "0.5px solid rgba(74,222,128,0.25)",
            borderRadius: "14px",
          }}
        >
          <div style={{ height: "1px", background: "linear-gradient(90deg,transparent,#4ade80,transparent)" }} />
          <div className="p-6 text-center">
            <div
              className="w-14 h-14 mx-auto mb-5 rounded-xl flex items-center justify-center text-2xl"
              style={{ background: "rgba(74,222,128,0.1)", border: "0.5px solid rgba(74,222,128,0.25)" }}
            >
              ✅
            </div>
            <p className="font-mono-arc text-sm font-bold text-gray-100 mb-1">Wallet connected!</p>
            <p className="font-mono-arc text-[11px] text-gray-500 mb-4 leading-relaxed">
              Your embedded wallet is ready.<br />Start earning USDm tokens.
            </p>
            {shortAddress && (
              <span
                className="font-mono-arc text-[11px] text-green-400 px-3 py-1.5 rounded inline-block mb-5"
                style={{
                  background: "rgba(74,222,128,0.08)",
                  border: "0.5px solid rgba(74,222,128,0.2)",
                  letterSpacing: "0.06em",
                }}
              >
                {shortAddress}
              </span>
            )}
            <button
              onClick={onClose}
              className="font-mono-arc text-[11px] font-bold uppercase tracking-wider w-full py-2.5 rounded-lg transition-all"
              style={{ background: "#a78bfa", color: "#000" }}
            >
              Go to lobby →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Wallet Dropdown ──────────────────────────────────────────────────────────

function WalletDropdown({
  shortAddress,
  walletTypeLabel,
  isMiniPay,
  userStats,
  onLogout,
  onClose,
}: {
  shortAddress: string;
  walletTypeLabel: string | null;
  isMiniPay: boolean;
  userStats: { xp: string; earnings: string; winRate: string } | null;
  onLogout: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-2 w-56 overflow-hidden z-50"
      style={{
        background: "#0c0d14",
        border: `0.5px solid ${isMiniPay ? "rgba(56,189,248,0.25)" : "rgba(167,139,250,0.2)"}`,
        borderRadius: "12px",
      }}
    >
      <div
        style={{
          height: "1px",
          background: isMiniPay
            ? "linear-gradient(90deg,transparent,#38bdf8,transparent)"
            : "linear-gradient(90deg,transparent,#a78bfa,transparent)",
        }}
      />
      <div className="p-4">
        <div
          className="flex items-center gap-2 mb-4 px-2 py-1.5 rounded-lg"
          style={{
            background: isMiniPay ? "rgba(56,189,248,0.06)" : "rgba(167,139,250,0.06)",
            border: `0.5px solid ${isMiniPay ? "rgba(56,189,248,0.15)" : "rgba(167,139,250,0.12)"}`,
          }}
        >
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: "#4ade80", boxShadow: "0 0 5px #4ade80" }}
          />
          <div className="min-w-0">
            <p className={`font-mono-arc text-[11px] truncate ${isMiniPay ? "text-cyan-300" : "text-violet-300"}`}>
              {shortAddress}
            </p>
            <p className="font-mono-arc text-[9px] text-gray-600 uppercase tracking-wider">
              {isMiniPay ? "MAINNET" : walletTypeLabel}
            </p>
          </div>
        </div>

        {userStats && (
          <div className="grid grid-cols-3 gap-1.5 mb-4">
            {[
              { val: userStats.xp, label: "XP",  color: "#a78bfa" },
              { val: userStats.earnings, label: "USDm", color: "#38bdf8" },
              { val: userStats.winRate, label: "Win", color: "#4ade80" },
            ].map(({ val, label, color }) => (
              <div
                key={label}
                className="text-center rounded-lg py-2"
                style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.06)" }}
              >
                <p className="font-mono-arc text-xs font-bold" style={{ color }}>{val}</p>
                <p className="font-mono-arc text-[9px] text-gray-600 uppercase tracking-wider mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        <div style={{ height: "0.5px", background: "rgba(255,255,255,0.06)", marginBottom: "0.5rem" }} />

        <button
          onClick={() => { navigator.clipboard.writeText(shortAddress); onClose(); }}
          className="w-full text-left flex items-center gap-2.5 px-2 py-1.5 rounded-lg font-mono-arc text-[11px] text-gray-400 hover:text-gray-100 hover:bg-white/[0.04] transition-all uppercase tracking-wider"
        >
          <span>📋</span> Copy address
        </button>

        <div style={{ height: "0.5px", background: "rgba(255,255,255,0.06)", margin: "0.5rem 0" }} />

        {!isMiniPay && (
          <button
            onClick={() => { onLogout(); onClose(); }}
            className="w-full text-left flex items-center gap-2.5 px-2 py-1.5 rounded-lg font-mono-arc text-[11px] text-red-400 hover:text-red-300 hover:bg-red-500/[0.06] transition-all uppercase tracking-wider"
          >
            <span>⏏</span> Disconnect
          </button>
        )}
      </div>
    </div>
  );
}

// ─── GameCard ─────────────────────────────────────────────────────────────────

function GameCard({ game }: { game: Game }) {
  const TAG_STYLES: Record<Exclude<GameType, "all">, string> = {
    arcade: "bg-violet-500/10 text-violet-400 border border-violet-500/20",
    multi:  "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    trivia: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  };

  const TAG_LABELS: Record<Exclude<GameType, "all">, string> = {
    arcade: "Arcade",
    multi:  "Multiplayer",
    trivia: "Trivia",
  };

  return (
    <div className="group flex flex-col glass-card cursor-pointer border-white/[0.06] hover:border-violet-500/30 transition-all duration-300 hover:-translate-y-1 overflow-hidden">
      <div
        className="h-16 flex items-center justify-center text-2xl flex-shrink-0"
        style={{ background: game.thumbBg }}
      />
      <div className="p-3 flex flex-col gap-2 flex-grow">
        <p className="font-mono-arc text-xs font-bold text-gray-100 uppercase tracking-wider">
          {game.title}
        </p>
        <div className="flex items-center justify-between gap-1">
          <span className={`font-mono-arc text-[10px] px-1.5 py-0.5 rounded-sm uppercase tracking-wider ${TAG_STYLES[game.type]}`}>
            {TAG_LABELS[game.type]}
          </span>
          <span className="font-mono-arc text-[10px] text-amber-400">{game.reward}</span>
        </div>
        <p className="font-mono-arc text-[10px] text-gray-600 mt-auto">{game.players}</p>
      </div>
    </div>
  );
}

// ─── LeaderboardRow ───────────────────────────────────────────────────────────

function LeaderboardRow({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const RANK_COLORS = ["#fbbf24", "#94a3b8", "#c4704f", "#64748b", "#64748b"];

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03] px-2 -mx-2 transition-colors">
      <span className="font-mono-arc text-xs w-5 flex-shrink-0 font-bold" style={{ color: RANK_COLORS[rank] }}>
        {String(rank + 1).padStart(2, "0")}
      </span>
      <div
        className="w-7 h-7 rounded-sm flex items-center justify-center font-mono-arc text-xs font-bold flex-shrink-0"
        style={{ background: entry.avatarColor, color: entry.avatarText }}
      >
        {entry.initials}
      </div>
      <span className="font-mono-arc text-xs text-gray-200 flex-1 truncate">{entry.name}</span>
      <span className="font-mono-arc text-[11px] text-violet-400 flex-shrink-0">{entry.xp}</span>
      <span className="font-mono-arc text-[11px] text-amber-400 flex-shrink-0 min-w-[72px] text-right">{entry.coins}</span>
    </div>
  );
}

// ─── HudPanel ─────────────────────────────────────────────────────────────────

function HudPanel({
  authenticated,
  walletAddress,
  embeddedWalletAddress,
  isMiniPay,
  miniPayAddress,
  userStats,
  onConnect,
}: {
  authenticated: boolean;
  walletAddress: string | null;
  embeddedWalletAddress: string | null;
  isMiniPay: boolean;
  miniPayAddress: string | null;
  userStats: { xp: string; earnings: string; winRate: string } | null;
  onConnect: () => void;
}) {
  const rawAddress = isMiniPay
    ? miniPayAddress
    : embeddedWalletAddress ?? walletAddress;
  const shortAddress = rawAddress
    ? `${rawAddress.slice(0, 6)}…${rawAddress.slice(-4)}`
    : null;

  const xpValue = userStats?.xp || "—";
  const earningsValue = userStats?.earnings || "— USDm";
  const winRateValue = userStats?.winRate || "—";

  const stats: HudStat[] = authenticated
    ? [
        { label: "Your XP",      val: xpValue,       color: "#a78bfa", pct: 62 },
        { label: "USDm balance", val: earningsValue, color: "#38bdf8", pct: 34 },
        { label: "Win rate",     val: winRateValue,  color: "#4ade80", pct: 63 },
      ]
    : [
        { label: "Your XP",      val: "—", color: "#374151", pct: 0 },
        { label: "USDm balance", val: "—", color: "#374151", pct: 0 },
        { label: "Win rate",     val: "—", color: "#374151", pct: 0 },
      ];

  return (
    <div className="glass-card p-4 border-violet-500/15 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />
      <p className="font-mono-arc text-[9px] text-cyan-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
        Live stats
        <span className="flex-1 h-px bg-cyan-400/15 inline-block" />
      </p>

      {stats.map(({ label, val, color, pct }) => (
        <div key={label} className="mb-3">
          <p className="font-mono-arc text-[9px] text-gray-600 uppercase tracking-wider mb-1">{label}</p>
          <p className="font-mono-arc text-lg font-bold leading-none" style={{ color }}>{val}</p>
          <div className="h-px bg-white/[0.05] mt-2">
            <div className="h-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
          </div>
        </div>
      ))}

      <div className="mt-3 pt-3 border-t border-white/[0.05]">
        <p className="font-mono-arc text-[9px] text-gray-600 uppercase tracking-wider">Wallet</p>
        {authenticated && shortAddress ? (
          <div>
            <p className="font-mono-arc text-[10px] text-violet-400/80 mt-1 break-all">{shortAddress}</p>
            {isMiniPay && (
              <span
                className="font-mono-arc text-[9px] text-cyan-400 mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded"
                style={{ background: "rgba(56,189,248,0.08)", border: "0.5px solid rgba(56,189,248,0.2)" }}
              >
                ⬡ Mainnet
              </span>
            )}
          </div>
        ) : (
          <>
            <p className="font-mono-arc text-[10px] text-gray-700 mt-1 mb-3">Not connected</p>
            <button
              onClick={onConnect}
              className="font-mono-arc text-[10px] w-full py-2 rounded-sm font-bold uppercase tracking-wider transition-all hover:opacity-90"
              style={{ background: "#a78bfa", color: "#000" }}
            >
              Connect wallet
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter(); // Next.js router for navigation
  const [filter, setFilter] = useState<GameType>("all");
  const [connectStep, setConnectStep] = useState<ConnectStep>("idle");
  const [showDropdown, setShowDropdown] = useState(false);

  const [games, setGames] = useState<Game[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [usdmPrice, setUsdmPrice] = useState<string>("$1.00");
  const [blockNumber, setBlockNumber] = useState<string>("#N/A");
  const [playerCount, setPlayerCount] = useState<string>("—");
  const [totalDistributed, setTotalDistributed] = useState<string>("—");
  const [userStats, setUserStats] = useState<{ xp: string; earnings: string; winRate: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();

  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
  const externalWallet = wallets.find((w) => w.walletClientType !== "privy");

  const { isMiniPay, address: miniPayAddress, shortAddress: miniPayShort } = useMiniPay();

  const activeAddress = isMiniPay
    ? miniPayAddress
    : embeddedWallet?.address ?? externalWallet?.address ?? user?.wallet?.address ?? null;

  const shortAddress = activeAddress
    ? `${activeAddress.slice(0, 6)}…${activeAddress.slice(-4)}`
    : null;

  const walletTypeLabel = isMiniPay
    ? "MAINNET"
    : embeddedWallet
    ? "EMBEDDED"
    : externalWallet
    ? "EXTERNAL"
    : null;

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [gamesData, leaderboardData, price, block, players, distributed] = await Promise.all([
          fetchGames(),
          fetchLeaderboard(),
          fetchUSDmPrice(),
          fetchBlockNumber(),
          fetchPlayerCount(),
          fetchTotalDistributed(),
        ]);

        setGames(gamesData);
        setLeaderboard(leaderboardData);
        setUsdmPrice(price);
        setBlockNumber(block);
        setPlayerCount(players);
        setTotalDistributed(distributed);

        if (authenticated && activeAddress) {
          const stats = await fetchUserStats(activeAddress);
          setUserStats(stats);
        } else {
          setUserStats(null);
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [authenticated, activeAddress]);

  useEffect(() => {
    if (authenticated && connectStep === "connecting") {
      setConnectStep("success");
    }
  }, [authenticated, connectStep]);

  const handleConnect = useCallback(async () => {
    if (isMiniPay) return;
    setConnectStep("connecting");
    try {
      await login();
    } catch {
      setConnectStep("idle");
    }
  }, [login, isMiniPay]);

  const handleModalClose = useCallback(() => setConnectStep("idle"), []);

  // ✅ NEW: Navigate to lobby page
  const handleGoToLobby = useCallback(() => {
    router.push("/lobby");
  }, [router]);

  const filteredGames = filter === "all" ? games : games.filter((g) => g.type === filter);
  const showModal = !isMiniPay && (connectStep === "connecting" || connectStep === "success");

  return (
    <main className="relative min-h-screen w-full text-gray-100">
      <LiquidBackground />

      {showModal && (
        <ConnectModal
          step={connectStep}
          onClose={handleModalClose}
          shortAddress={shortAddress}
        />
      )}

      <div className="relative z-10">
        <nav className="w-full glass sticky top-0 z-40 border-b border-white/[0.07]">
          <div className="flex items-center justify-between px-4 sm:px-6 py-3.5">
            <span className="font-mono-arc text-sm font-bold tracking-widest uppercase">
              mini<span className="text-violet-400">game</span>
            </span>

            <div className="flex items-center gap-2 sm:gap-3">
              <button 
                onClick={handleGoToLobby}
                className="hidden sm:inline font-mono-arc text-[10px] px-3 py-2 glass-sm rounded-sm text-gray-400 hover:text-gray-100 uppercase tracking-wider transition-all"
              >
                Leaderboard
              </button>

              {isMiniPay ? (
                <div className="relative">
                  <button
                    onClick={() => setShowDropdown((v) => !v)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full transition-all"
                    style={{
                      background: "rgba(56,189,248,0.08)",
                      border: "0.5px solid rgba(56,189,248,0.25)",
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: "#4ade80", boxShadow: "0 0 5px #4ade80" }}
                    />
                    <span className="font-mono-arc text-[10px] text-cyan-300 tracking-wider hidden sm:inline">
                      {miniPayShort ?? shortAddress ?? "Mainnet"}
                    </span>
                    <span className="font-mono-arc text-[9px] text-cyan-400 tracking-wider">⬡</span>
                    <span className="font-mono-arc text-[10px] text-cyan-400/50">▾</span>
                  </button>

                  {showDropdown && shortAddress && (
                    <WalletDropdown
                      shortAddress={shortAddress}
                      walletTypeLabel={walletTypeLabel}
                      isMiniPay={isMiniPay}
                      userStats={userStats}
                      onLogout={logout}
                      onClose={() => setShowDropdown(false)}
                    />
                  )}
                </div>
              ) : !ready ? (
                <div className="w-24 h-7 rounded-sm bg-white/[0.05] animate-pulse" />
              ) : authenticated ? (
                <div className="relative">
                  <button
                    onClick={() => setShowDropdown((v) => !v)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full transition-all hover:border-violet-400/40"
                    style={{
                      background: "rgba(167,139,250,0.08)",
                      border: "0.5px solid rgba(167,139,250,0.25)",
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: "#4ade80", boxShadow: "0 0 5px #4ade80" }}
                    />
                    {shortAddress && (
                      <span className="font-mono-arc text-[10px] text-violet-300 tracking-wider hidden sm:inline">
                        {shortAddress}
                      </span>
                    )}
                    <span className="font-mono-arc text-[10px] text-violet-400/50">▾</span>
                  </button>

                  {showDropdown && shortAddress && (
                    <WalletDropdown
                      shortAddress={shortAddress}
                      walletTypeLabel={walletTypeLabel}
                      isMiniPay={false}
                      userStats={userStats}
                      onLogout={logout}
                      onClose={() => setShowDropdown(false)}
                    />
                  )}
                </div>
              ) : (
                <button
                  onClick={handleConnect}
                  className="font-mono-arc text-[10px] px-4 py-2 rounded-sm font-bold hover:opacity-90 transition-all uppercase tracking-wider flex items-center gap-1.5"
                  style={{ background: "#a78bfa", color: "#000" }}
                >
                  <span>⬡</span> Connect
                </button>
              )}
            </div>
          </div>
        </nav>

        <div className="flex items-center gap-5 px-4 sm:px-6 py-2 border-b border-white/[0.04] bg-black/30 backdrop-blur-sm overflow-x-auto">
          <span className="font-mono-arc text-[10px] text-gray-500 flex items-center gap-1.5 whitespace-nowrap">
            <span
              className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"
              style={{ boxShadow: "0 0 5px #4ade80" }}
            />
            NETWORK: <span className="text-violet-400">{NETWORK_CONFIG.displayName}</span>
          </span>
          <span className="font-mono-arc text-[10px] text-gray-500 whitespace-nowrap">
            PLAYERS: <span className="text-violet-400">{playerCount}</span>
          </span>
          <span className="font-mono-arc text-[10px] text-gray-500 whitespace-nowrap">
            USDm: <span className="text-violet-400">{usdmPrice}</span>
          </span>
          <span className="font-mono-arc text-[10px] text-gray-500 whitespace-nowrap">
            BLOCK: <span className="text-violet-400">{blockNumber}</span>
          </span>

          {(authenticated || isMiniPay) && walletTypeLabel && (
            <span className="font-mono-arc text-[10px] text-gray-500 whitespace-nowrap hidden sm:inline">
              WALLET: <span className="text-cyan-400">{walletTypeLabel}</span>
            </span>
          )}

          <span className="font-mono-arc text-[10px] text-gray-600 ml-auto whitespace-nowrap tracking-widest">
            SYS_OK ████ 100%
          </span>
        </div>

        <section className="w-full px-4 sm:px-6 py-14 sm:py-20">
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-10 items-start">
            <div>
              <p className="font-mono-arc text-[10px] text-cyan-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
                <span className="w-7 h-px bg-cyan-400/50 inline-block" />
                MINIGAME PROTOCOL v2.4 — MAINNET INITIALIZED              </p>
              <h1 className="text-4xl sm:text-5xl font-black leading-[1.08] tracking-tight mb-5">
                Play mini games.<br />
                <span className="text-violet-400">Earn rewards.</span><br />
                <span className="text-cyan-400">Own your stats.</span>
              </h1>
              <p className="text-sm text-gray-500 leading-relaxed mb-7 max-w-md">
                {isMiniPay
                  ? "You're connected to Ethereum Mainnet. Play mini games and earn USDm tokens on every win."
                  : "Log in with Privy — your wallet is created instantly. Play casual, competitive, or trivia games and earn USDm tokens on every win."}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                {authenticated || isMiniPay ? (
                  <button 
                    onClick={handleGoToLobby}
                    className="font-mono-arc text-xs px-7 py-3 rounded-sm bg-violet-500 text-black font-bold hover:bg-violet-400 transition-all uppercase tracking-wider"
                  >
                    Go to lobby →
                  </button>
                ) : (
                  <button
                    onClick={handleConnect}
                    className="font-mono-arc text-xs px-7 py-3 rounded-sm bg-violet-500 text-black font-bold hover:bg-violet-400 transition-all uppercase tracking-wider"
                  >
                    [ Get started — it&apos;s free ]
                  </button>
                )}
                <button 
                  onClick={handleGoToLobby}
                  className="font-mono-arc text-xs px-7 py-3 rounded-sm glass-sm text-gray-300 hover:text-gray-100 transition-all uppercase tracking-wider"
                >
                  Browse games
                </button>
              </div>
            </div>

            <HudPanel
              authenticated={authenticated}
              walletAddress={user?.wallet?.address ?? null}
              embeddedWalletAddress={embeddedWallet?.address ?? null}
              isMiniPay={isMiniPay}
              miniPayAddress={miniPayAddress}
              userStats={userStats}
              onConnect={handleConnect}
            />
          </div>
        </section>

        <div className="border-y border-white/[0.05] bg-black/20 backdrop-blur-sm">
          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4">
            {[
              { num: playerCount, label: "Players online",     color: "#a78bfa" },
              { num: `${games.length}`, label: "Games available",    color: "#38bdf8" },
              { num: totalDistributed, label: "USDm tokens paid",   color: "#e2e8f0" },
              { num: "Free", label: "To join",            color: "#4ade80" },
            ].map((s, i) => (
              <div
                key={s.label}
                className={`text-center py-8 px-4 ${i < 3 ? "border-r border-white/[0.05]" : ""}`}
              >
                <p className="font-mono-arc text-2xl font-bold mb-1" style={{ color: s.color }}>{s.num}</p>
                <p className="font-mono-arc text-[10px] text-gray-600 uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <section className="w-full px-4 sm:px-6 py-10">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <span className="font-mono-arc text-[10px] text-gray-500 uppercase tracking-[0.2em]">Mini Games</span>
                <span className="flex-1 h-px bg-white/[0.05]" />
                <span className="font-mono-arc text-[9px] text-violet-400 border border-violet-500/25 px-2 py-0.5 rounded-sm">
                  {games.length} active
                </span>
              </div>
              <div className="flex gap-2">
                {(["all", "arcade", "multi", "trivia"] as GameType[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`font-mono-arc text-[9px] px-3 py-1.5 rounded-sm uppercase tracking-wider transition-all ${
                      filter === f
                        ? "bg-violet-500 text-black font-bold"
                        : "glass-sm text-gray-500 hover:text-gray-200"
                    }`}
                  >
                    {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-40 bg-white/[0.05] rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredGames.map((game) => (
                  <GameCard key={game.id} game={game} />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="w-full px-4 sm:px-6 py-8 border-t border-white/[0.05]">
          <div className="max-w-5xl mx-auto">
            <div className="glass-card p-5 sm:p-6 border-pink-500/10 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-pink-500/40 to-transparent" />
              <div className="flex items-center gap-3 mb-5">
                <span className="font-mono-arc text-[10px] text-gray-500 uppercase tracking-[0.2em]">Top players — this cycle</span>
                <span className="flex-1 h-px bg-white/[0.04]" />
                <span className="font-mono-arc text-[9px] text-pink-400 border border-pink-500/25 px-2 py-0.5 rounded-sm">Weekly</span>
              </div>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-8 bg-white/[0.05] rounded animate-pulse" />
                  ))}
                </div>
              ) : leaderboard.length > 0 ? (
                leaderboard.map((entry, i) => (
                  <LeaderboardRow key={entry.name} entry={entry} rank={i} />
                ))
              ) : (
                <p className="text-center text-gray-500 py-4">No leaderboard data available</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}