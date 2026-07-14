"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { ethers } from "ethers";
import { useOnboarding } from "@/hooks/useOnboarding";
import {
  fetchGames,
  fetchLeaderboard,
  fetchUserStats,
  fetchPlayerCount,
  shortenWallet,
  type Game,
  type LeaderboardEntry,
  type UserStats,
} from "../lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

type GameType = "all" | "arcade" | "multi" | "trivia";
type ConnectStep = "idle" | "connecting" | "success";
type OnboardStatus = "pending" | "dripping" | "done" | "error";

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
};

// ─── API Services ─────────────────────────────────────────────────────────────
// Games, leaderboard, player stats, and player count now come from lib/supabase
// (the same source the lobby page uses) instead of the old api.minigame.com
// placeholder backend. Only price/block data — which have nothing to do with
// Supabase — stay as direct fetches here.

async function fetchUSDmPrice(): Promise<string> {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=true-usd&vs_currencies=usd"
    );
    const data = await response.json();
    return data["true-usd"]?.usd?.toFixed(4) || "$1.00";
  } catch {
    return "$1.00";
  }
}

async function fetchBlockNumber(): Promise<string> {
  try {
    const provider = new ethers.JsonRpcProvider(NETWORK_CONFIG.rpcUrl);
    const blockNumber = await provider.getBlockNumber();
    return `#${blockNumber.toLocaleString()}`;
  } catch {
    return "#N/A";
  }
}

// ─── useMiniPay Hook ──────────────────────────────────────────────────────────

function useMiniPay() {
  const [isMiniPay, setIsMiniPay] = useState(false);
  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();

  useEffect(() => {
    const provider = (window as any).ethereum;
    if (provider?.isMiniPay) setIsMiniPay(true);
  }, []);

  useEffect(() => {
    if (isMiniPay && !authenticated) login();
  }, [isMiniPay, authenticated, login]);

  const miniPayWallet = isMiniPay
    ? wallets.find((w) => w.walletClientType !== "privy")
    : undefined;

  const address = miniPayWallet?.address ?? null;
  const shortAddress = address ? shortenWallet(address) : null;

  return { isMiniPay, address, shortAddress, wallet: miniPayWallet ?? null };
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
            1 + 0.18 * Math.sin(angle * 3 + phase) + 0.09 * Math.cos(angle * 5 - phase * 1.3);
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
  onboardStatus,
  dripAmount,
  onEnterLobby,
}: {
  step: ConnectStep;
  onClose: () => void;
  shortAddress: string | null;
  onboardStatus: OnboardStatus;
  dripAmount: string | null;
  onEnterLobby: () => void;
}) {
  const dripping = onboardStatus === "dripping";

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget && !dripping) onClose(); }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
    >
      {/* ── Connecting state */}
      {step === "connecting" && (
        <div
          className="w-full max-w-xs overflow-hidden"
          style={{ background: "#0c0d14", border: "0.5px solid rgba(56,189,248,0.25)", borderRadius: "14px" }}
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
                  inset: "-3px", borderRadius: "15px",
                  border: "2px solid transparent", borderTopColor: "#38bdf8",
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

      {/* ── Success + drip status */}
      {step === "success" && (
        <div
          className="w-full max-w-xs overflow-hidden"
          style={{
            background: "#0c0d14",
            border: `0.5px solid ${onboardStatus === "done" ? "rgba(74,222,128,0.35)" : "rgba(56,189,248,0.25)"}`,
            borderRadius: "14px",
          }}
        >
          <div style={{
            height: "1px",
            background: onboardStatus === "done"
              ? "linear-gradient(90deg,transparent,#4ade80,transparent)"
              : "linear-gradient(90deg,transparent,#38bdf8,transparent)",
          }} />
          <div className="p-6 text-center">
            {/* Icon — spins while dripping, checkmark when done */}
            <div className="relative w-14 h-14 mx-auto mb-5">
              <div
                className="absolute inset-0 rounded-xl flex items-center justify-center text-2xl"
                style={{
                  background: onboardStatus === "done" ? "rgba(74,222,128,0.1)" : "rgba(56,189,248,0.08)",
                  border: `0.5px solid ${onboardStatus === "done" ? "rgba(74,222,128,0.25)" : "rgba(56,189,248,0.2)"}`,
                }}
              >
                {onboardStatus === "done" ? "🎉" : onboardStatus === "error" ? "⚠️" : "⛽"}
              </div>
              {dripping && (
                <div
                  className="absolute"
                  style={{
                    inset: "-3px", borderRadius: "15px",
                    border: "2px solid transparent", borderTopColor: "#38bdf8",
                    animation: "arc-spin 0.8s linear infinite",
                  }}
                />
              )}
            </div>

            <p className="font-mono-arc text-sm font-bold text-gray-100 mb-1">
              {onboardStatus === "done" ? "You're all set!" : "Wallet connected!"}
            </p>

            {shortAddress && (
              <span
                className="font-mono-arc text-[11px] text-green-400 px-3 py-1.5 rounded inline-block mb-4"
                style={{ background: "rgba(74,222,128,0.08)", border: "0.5px solid rgba(74,222,128,0.2)", letterSpacing: "0.06em" }}
              >
                {shortAddress}
              </span>
            )}

            {/* ── Drip status card */}
            <div
              className="rounded-lg px-4 py-3 mb-5 text-left"
              style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.07)" }}
            >
              {dripping && (
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 flex-shrink-0 rounded-full"
                    style={{
                      border: "2px solid transparent",
                      borderTopColor: "#38bdf8",
                      animation: "arc-spin 0.8s linear infinite",
                    }}
                  />
                  <div>
                    <p className="font-mono-arc text-[11px] text-cyan-300 font-bold">
                      Sending welcome CELO…
                    </p>
                    <p className="font-mono-arc text-[10px] text-gray-500 mt-0.5">
                      Registering your wallet on-chain
                    </p>
                  </div>
                </div>
              )}

              {onboardStatus === "done" && (
                <div className="flex items-center gap-3">
                  <span className="text-base flex-shrink-0">⛽</span>
                  <div>
                    <p className="font-mono-arc text-[11px] text-green-400 font-bold">
                      {dripAmount} CELO sent to your wallet!
                    </p>
                    <p className="font-mono-arc text-[10px] text-gray-500 mt-0.5">
                      You&apos;re registered and ready to play
                    </p>
                  </div>
                </div>
              )}

              {onboardStatus === "error" && (
                <div className="flex items-center gap-3">
                  <span className="text-base flex-shrink-0">⚠️</span>
                  <div>
                    <p className="font-mono-arc text-[11px] text-amber-400 font-bold">
                      Drip skipped
                    </p>
                    <p className="font-mono-arc text-[10px] text-gray-500 mt-0.5">
                      You can still play — try again later
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* ── CTA — disabled until drip resolves */}
            <button
              onClick={onEnterLobby}
              disabled={dripping}
              className="font-mono-arc text-[11px] font-bold uppercase tracking-wider w-full py-2.5 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: onboardStatus === "done" ? "#4ade80" : "#a78bfa",
                color: "#000",
              }}
            >
              {dripping ? "Please wait…" : "Play now →"}
            </button>

            <style>{`@keyframes arc-spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Wallet Dropdown ──────────────────────────────────────────────────────────

function WalletDropdown({
  shortAddress, walletTypeLabel, isMiniPay, userStats, onLogout, onClose,
}: {
  shortAddress: string;
  walletTypeLabel: string | null;
  isMiniPay: boolean;
  userStats: UserStats | null;
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
      <div style={{ height: "1px", background: isMiniPay ? "linear-gradient(90deg,transparent,#38bdf8,transparent)" : "linear-gradient(90deg,transparent,#a78bfa,transparent)" }} />
      <div className="p-4">
        <div
          className="flex items-center gap-2 mb-4 px-2 py-1.5 rounded-lg"
          style={{
            background: isMiniPay ? "rgba(56,189,248,0.06)" : "rgba(167,139,250,0.06)",
            border: `0.5px solid ${isMiniPay ? "rgba(56,189,248,0.15)" : "rgba(167,139,250,0.12)"}`,
          }}
        >
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "#4ade80", boxShadow: "0 0 5px #4ade80" }} />
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
              { val: userStats.xp,       label: "XP",   color: "#a78bfa" },
              { val: userStats.earnings, label: "USDm", color: "#38bdf8" },
              { val: userStats.winRate,  label: "Win",  color: "#4ade80" },
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

function GameCard({ game, onPlay }: { game: Game; onPlay: (gameId: string) => void }) {
  const TAG_STYLES: Record<Exclude<GameType, "all">, string> = {
    arcade: "bg-violet-500/10 text-violet-400 border border-violet-500/20",
    multi:  "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    trivia: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  };
  const TAG_LABELS: Record<Exclude<GameType, "all">, string> = {
    arcade: "Arcade", multi: "Multiplayer", trivia: "Trivia",
  };

  return (
    <div
      onClick={() => onPlay(game.gameId)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onPlay(game.gameId); }}
      className="group flex flex-col glass-card cursor-pointer border-white/[0.06] active:scale-[0.98] hover:border-violet-500/30 transition-all duration-200 hover:-translate-y-1 overflow-hidden"
    >
      <div
        className="relative h-14 sm:h-16 flex items-center justify-center flex-shrink-0 overflow-hidden"
        style={{ background: game.thumbBg }}
      >
        {/* soften the flat swatch so it reads as a backdrop, not a color chip */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.16), transparent 60%)" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.25) 100%)" }} />
        <span className="relative text-2xl sm:text-3xl drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]" role="img" aria-label={game.title}>
          {game.icon}
        </span>
      </div>
      <div className="p-2.5 sm:p-3 flex flex-col gap-1.5 sm:gap-2 flex-grow">
        <p className="font-mono-arc text-[11px] sm:text-xs font-bold text-gray-100 uppercase tracking-wider leading-tight">{game.title}</p>
        <div className="flex items-center justify-between gap-1">
          <span className={`font-mono-arc text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-sm uppercase tracking-wider ${TAG_STYLES[game.type]}`}>
            {TAG_LABELS[game.type]}
          </span>
          <span className="font-mono-arc text-[9px] sm:text-[10px] text-amber-400">{game.reward}</span>
        </div>
        <p className="font-mono-arc text-[9px] sm:text-[10px] text-gray-600 mt-auto">{game.players}</p>
      </div>
    </div>
  );
}

// ─── LeaderboardRow ───────────────────────────────────────────────────────────

function LeaderboardRow({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const RANK_COLORS = ["#fbbf24", "#94a3b8", "#c4704f", "#64748b", "#64748b"];
  return (
    <div className="flex items-center gap-2.5 sm:gap-3 py-2 sm:py-2.5 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03] px-2 -mx-2 transition-colors">
      <span className="font-mono-arc text-xs w-5 flex-shrink-0 font-bold" style={{ color: RANK_COLORS[rank] }}>
        {String(rank + 1).padStart(2, "0")}
      </span>
      <div
        className="w-6 h-6 sm:w-7 sm:h-7 rounded-sm flex items-center justify-center font-mono-arc text-[11px] sm:text-xs font-bold flex-shrink-0"
        style={{ background: entry.avatarColor, color: entry.avatarText }}
      >
        {entry.initials}
      </div>
      <span className="font-mono-arc text-[11px] sm:text-xs text-gray-200 flex-1 truncate">{entry.name}</span>
      <span className="font-mono-arc text-[10px] sm:text-[11px] text-violet-400 flex-shrink-0 min-w-[60px] sm:min-w-[72px] text-right">{entry.xp}</span>
    </div>
  );
}

// ─── HudPanel ─────────────────────────────────────────────────────────────────

function HudPanel({
  authenticated, walletAddress, embeddedWalletAddress, isMiniPay, miniPayAddress, userStats, onConnect,
}: {
  authenticated: boolean;
  walletAddress: string | null;
  embeddedWalletAddress: string | null;
  isMiniPay: boolean;
  miniPayAddress: string | null;
  userStats: UserStats | null;
  onConnect: () => void;
}) {
  const rawAddress = isMiniPay ? miniPayAddress : embeddedWalletAddress ?? walletAddress;
  const shortAddress = rawAddress ? `${rawAddress.slice(0, 6)}…${rawAddress.slice(-4)}` : null;

  const stats: HudStat[] = authenticated
    ? [
        { label: "Your XP",      val: userStats?.xp       ?? "0", color: "#a78bfa", pct: userStats?.xpPct       ?? 0 },
        { label: "USDm balance", val: userStats?.earnings  ?? "0 USDm", color: "#38bdf8", pct: userStats?.earningsPct ?? 0 },
        { label: "Win rate",     val: userStats?.winRate   ?? "0%", color: "#4ade80", pct: userStats?.winPct      ?? 0 },
      ]
    : [
        { label: "Your XP",      val: "0", color: "#374151", pct: 0 },
        { label: "USDm balance", val: "0 USDm", color: "#374151", pct: 0 },
        { label: "Win rate",     val: "0%", color: "#374151", pct: 0 },
      ];

  return (
    <div className="glass-card p-3.5 sm:p-4 border-violet-500/15 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />
      <p className="font-mono-arc text-[9px] text-cyan-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
        Stats
        <span className="flex-1 h-px bg-cyan-400/15 inline-block" />
      </p>

      {/* Mobile: compact 3-up row. Desktop: stacked bars. */}
      <div className="grid grid-cols-3 gap-2 sm:hidden mb-1">
        {stats.map(({ label, val, color }) => (
          <div key={label} className="text-center rounded-lg py-2" style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.06)" }}>
            <p className="font-mono-arc text-sm font-bold leading-none" style={{ color }}>{val}</p>
            <p className="font-mono-arc text-[8px] text-gray-600 uppercase tracking-wider mt-1 leading-tight">{label}</p>
          </div>
        ))}
      </div>

      <div className="hidden sm:block">
        {stats.map(({ label, val, color, pct }) => (
          <div key={label} className="mb-3">
            <p className="font-mono-arc text-[9px] text-gray-600 uppercase tracking-wider mb-1">{label}</p>
            <p className="font-mono-arc text-lg font-bold leading-none" style={{ color }}>{val}</p>
            <div className="h-px bg-white/[0.05] mt-2">
              <div className="h-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
            </div>
          </div>
        ))}
      </div>

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
              className="font-mono-arc text-[10px] w-full py-2 rounded-sm font-bold uppercase tracking-wider transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: "#a78bfa", color: "#000" }}
            >
              Connect
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  const [filter, setFilter] = useState<GameType>("all");
  const [connectStep, setConnectStep] = useState<ConnectStep>("idle");
  const [showDropdown, setShowDropdown] = useState(false);

  // ── Data state
  const [games, setGames] = useState<Game[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [usdmPrice, setUsdmPrice] = useState<string>("$1.00");
  const [blockNumber, setBlockNumber] = useState<string>("#N/A");
  const [playerCount, setPlayerCount] = useState<string>("0");
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [gamesError, setGamesError] = useState(false);

  // ── Onboarding state — drives the modal's drip status card
  const [onboardStatus, setOnboardStatus] = useState<OnboardStatus>("dripping");
  const [dripAmount, setDripAmount] = useState<string | null>(null);

  // ── Privy
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();

  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
  const externalWallet = wallets.find((w) => w.walletClientType !== "privy");

  // Get MiniPay wallet info
  const { isMiniPay, address: miniPayAddress, shortAddress: miniPayShort, wallet: miniPayWalletObj } = useMiniPay();

  // Determine active address for display and API calls
  const activeAddress = isMiniPay
    ? miniPayAddress
    : embeddedWallet?.address ?? externalWallet?.address ?? user?.wallet?.address ?? null;

  // This is the actual wallet object capable of signing (needed for waitlist registration)
  const activeWalletForSigning = isMiniPay
    ? miniPayWalletObj
    : embeddedWallet ?? externalWallet ?? null;

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

  // ── Onboarding: drip CELO + register on waitlist for new users
  const [onboardingTriggered, setOnboardingTriggered] = useState(false);

  const { retry: retryOnboarding } = useOnboarding({
    wallet: activeWalletForSigning,
    authenticated: authenticated || isMiniPay,
    onSuccess: ({ dripAmount: amount }) => {
      setDripAmount(amount);
      setOnboardStatus("done");
    },
    onError: () => {
      setOnboardStatus("error");
    },
  });

  // ── Data loading
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setGamesError(false);
      try {
        const [gamesResult, leaderboardData, price, block, players] = await Promise.all([
          fetchGames().then(
            (data) => ({ ok: true as const, data }),
            (err) => ({ ok: false as const, err })
          ),
          fetchLeaderboard(),
          fetchUSDmPrice(),
          fetchBlockNumber(),
          fetchPlayerCount(),
        ]);

        if (gamesResult.ok) {
          setGames(gamesResult.data);
        } else {
          console.error("fetchGames failed:", gamesResult.err);
          setGames([]);
          setGamesError(true);
        }
        setLeaderboard(leaderboardData);
        setUsdmPrice(price);
        setBlockNumber(block);
        setPlayerCount(players);

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
    const interval = setInterval(loadData, 30_000);
    return () => clearInterval(interval);
  }, [authenticated, activeAddress]);

  // ── Flip modal to "success" once Privy confirms auth AND trigger onboarding
  useEffect(() => {
    if (authenticated && connectStep === "connecting") {
      setConnectStep("success");

      if (!onboardingTriggered && activeWalletForSigning) {
        setOnboardingTriggered(true);
        setOnboardStatus("dripping");
      }
    }
  }, [authenticated, connectStep, activeWalletForSigning, onboardingTriggered]);

  useEffect(() => {
    setOnboardingTriggered(false);
    setOnboardStatus("pending");
  }, [activeWalletForSigning]);

  const handleConnect = useCallback(async () => {
    if (isMiniPay) return;
    setConnectStep("connecting");
    try {
      await login();
    } catch {
      setConnectStep("idle");
    }
  }, [login, isMiniPay]);

  const handleGoToLobby = useCallback(() => router.push("/lobby"), [router]);

  const handlePlay = useCallback(
    (gameId: string) => router.push(`/game/${gameId}`),
    [router]
  );

  const handleEnterLobby = useCallback(() => {
    setConnectStep("idle");
    router.push("/lobby");
  }, [router]);

  const filteredGames = filter === "all" ? games : games.filter((g) => g.type === filter);
  const showModal = !isMiniPay && (connectStep === "connecting" || connectStep === "success");
  const isConnected = authenticated || isMiniPay;

  return (
    <main className="relative min-h-screen w-full text-gray-100 pb-20 sm:pb-0">
      <LiquidBackground />

      {showModal && (
        <ConnectModal
          step={connectStep}
          onClose={() => setConnectStep("idle")}
          shortAddress={shortAddress}
          onboardStatus={onboardStatus}
          dripAmount={dripAmount}
          onEnterLobby={handleEnterLobby}
        />
      )}

      <div className="relative z-10">
        {/* ── Nav */}
        <nav className="w-full glass sticky top-0 z-40 border-b border-white/[0.07]">
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-3.5">
            <span className="font-mono-arc text-sm font-bold tracking-widest uppercase">
              mini<span className="text-violet-400">game</span>
            </span>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => router.push("/leaderboard")}
                className="hidden sm:inline font-mono-arc text-[10px] px-3 py-2 glass-sm rounded-sm text-gray-400 hover:text-gray-100 uppercase tracking-wider transition-all"
              >
                Rankings
              </button>

              {isMiniPay ? (
                <div className="relative">
                  <button
                    onClick={() => setShowDropdown((v) => !v)}
                    className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-full transition-all"
                    style={{ background: "rgba(56,189,248,0.08)", border: "0.5px solid rgba(56,189,248,0.25)" }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#4ade80", boxShadow: "0 0 5px #4ade80" }} />
                    <span className="font-mono-arc text-[10px] text-cyan-300 tracking-wider">
                      {miniPayShort ?? shortAddress ?? "Mainnet"}
                    </span>
                    <span className="font-mono-arc text-[9px] text-cyan-400 tracking-wider">⬡</span>
                    <span className="font-mono-arc text-[10px] text-cyan-400/50">▾</span>
                  </button>
                  {showDropdown && shortAddress && (
                    <WalletDropdown
                      shortAddress={shortAddress}
                      walletTypeLabel={walletTypeLabel}
                      isMiniPay={true}
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
                    className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-full transition-all hover:border-violet-400/40"
                    style={{ background: "rgba(167,139,250,0.08)", border: "0.5px solid rgba(167,139,250,0.25)" }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#4ade80", boxShadow: "0 0 5px #4ade80" }} />
                    {shortAddress && (
                      <span className="font-mono-arc text-[10px] text-violet-300 tracking-wider">
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
                  className="font-mono-arc text-[10px] px-3.5 sm:px-4 py-2 rounded-sm font-bold hover:opacity-90 active:scale-[0.98] transition-all uppercase tracking-wider flex items-center gap-1.5"
                  style={{ background: "#a78bfa", color: "#000" }}
                >
                  <span>⬡</span> Login
                </button>
              )}
            </div>
          </div>
        </nav>

        {/* ── Ticker */}
        <div className="flex items-center gap-4 sm:gap-5 px-4 sm:px-6 py-1.5 sm:py-2 border-b border-white/[0.04] bg-black/30 backdrop-blur-sm overflow-x-auto">
          <span className="font-mono-arc text-[9px] sm:text-[10px] text-gray-500 flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" style={{ boxShadow: "0 0 5px #4ade80" }} />
            <span className="hidden xs:inline text-violet-400">{NETWORK_CONFIG.displayName}</span>
          </span>
          <span className="font-mono-arc text-[9px] sm:text-[10px] text-gray-500 whitespace-nowrap">
            PLAYERS: <span className="text-violet-400">{playerCount}</span>
          </span>
          <span className="font-mono-arc text-[9px] sm:text-[10px] text-gray-500 whitespace-nowrap">
            USDm: <span className="text-violet-400">{usdmPrice}</span>
          </span>
          <span className="font-mono-arc text-[9px] sm:text-[10px] text-gray-500 whitespace-nowrap hidden sm:inline">
            BLOCK: <span className="text-violet-400">{blockNumber}</span>
          </span>
          <span className="font-mono-arc text-[9px] sm:text-[10px] text-gray-600 ml-auto whitespace-nowrap tracking-widest">
            <span className="text-emerald-400">●</span> OK ████
          </span>
        </div>

        {/* ── Hero + HUD, tightened into one compact block on mobile */}
        <section className="w-full px-4 sm:px-6 pt-6 pb-6 sm:py-16">
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6 sm:gap-10 items-start">
            <div>
              <p className="font-mono-arc text-[9px] sm:text-[10px] text-cyan-400 uppercase tracking-[0.2em] mb-3 sm:mb-4 flex items-center gap-3">
                <span className="w-7 h-px bg-cyan-400/50 inline-block" />
                MINIGAME PROTOCOL v2.4
              </p>
              <h1 className="text-3xl sm:text-5xl font-black leading-[1.1] tracking-tight mb-3 sm:mb-5">
                Play to earn.<br />
                <span className="text-violet-400">Earn crypto.</span>{" "}
                <span className="text-cyan-400">Own your stats.</span>
              </h1>
              <p className="text-[13px] sm:text-sm text-gray-500 leading-relaxed mb-5 sm:mb-7 max-w-md">
                {isMiniPay
                  ? "You're connected to Ethereum Mainnet. Play mini games and earn USDm tokens on every win."
                  : "Log in with Privy — your wallet is created instantly. Play, compete, and earn USDm on every win."}
              </p>

              {/* Mobile: one primary CTA. Desktop: primary + secondary. */}
              <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
                {isConnected ? (
                  <button
                    onClick={handleGoToLobby}
                    className="font-mono-arc text-xs px-6 py-3 rounded-sm bg-violet-500 text-black font-bold hover:bg-violet-400 active:scale-[0.98] transition-all uppercase tracking-wider"
                  >
                    Play now →
                    </button>
                  ) : (
                    <button
                      onClick={handleConnect}
                      className="font-mono-arc text-xs px-6 py-3 rounded-sm bg-violet-500 text-black font-bold hover:bg-violet-400 active:scale-[0.98] transition-all uppercase tracking-wider"
                    >
                      Sign in
                    </button>
                )}
                <button
                  onClick={handleGoToLobby}
                  className="hidden sm:inline font-mono-arc text-xs px-6 py-3 rounded-sm glass-sm text-gray-300 hover:text-gray-100 transition-all uppercase tracking-wider"
                >
                  All games
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

        {/* ── Compact stats strip — folded tight against hero, no page-break feel */}
        <div className="border-y border-white/[0.05] bg-black/20 backdrop-blur-sm">
          <div className="max-w-5xl mx-auto grid grid-cols-3">
            {[
              { num: playerCount,        label: "Online",   color: "#c084fc" },
              { num: `${games.length}`,  label: "Games",    color: "#22d3ee" },
              { num: "Free",             label: "Play",  color: "#4ade80" },
            ].map((s, i) => (
              <div
                key={s.label}
                className={`text-center py-4 sm:py-8 px-1 sm:px-4 ${i < 2 ? "border-r border-white/[0.05]" : ""}`}
              >
                <p className="font-mono-arc text-base sm:text-2xl font-bold mb-0.5 sm:mb-1" style={{ color: s.color }}>{s.num}</p>
                <p className="font-mono-arc text-[8px] sm:text-[10px] text-gray-600 uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Games grid — flows straight from the stats strip, same section rhythm */}
        <section className="w-full px-4 sm:px-6 pt-6 pb-4 sm:py-10">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
              <div className="flex items-center gap-3">
                <span className="font-mono-arc text-[10px] text-gray-500 uppercase tracking-[0.2em]">Games</span>
                <span className="flex-1 h-px bg-white/[0.05]" />
                <span className="font-mono-arc text-[9px] text-violet-400 border border-violet-500/25 px-2 py-0.5 rounded-sm">
                  {games.length} live
                </span>
              </div>
              <div className="flex gap-1.5 sm:gap-2 overflow-x-auto">
                {(["all", "arcade", "multi", "trivia"] as GameType[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`font-mono-arc text-[9px] px-3 py-1.5 rounded-sm uppercase tracking-wider transition-all whitespace-nowrap ${
                       filter === f ? "bg-violet-600 text-white font-bold" : "glass-sm text-gray-500 hover:text-gray-200"
                    }`}
                  >
                    {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-36 sm:h-40 bg-white/[0.05] rounded-lg animate-pulse" />
                ))}
              </div>
            ) : gamesError ? (
              <div className="text-center py-10 sm:py-14">
                <p className="font-mono-arc text-xs text-red-400 mb-1">Couldn&apos;t load games</p>
                <p className="font-mono-arc text-[10px] text-gray-600 mb-3">Check that Supabase is reachable and try again.</p>
                <button
                  onClick={() => window.location.reload()}
                  className="font-mono-arc text-[10px] text-violet-400 uppercase tracking-wider hover:text-violet-300 transition-colors"
                >
                  Retry →
                </button>
              </div>
            ) : filteredGames.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                {filteredGames.map((game) => (
                  <GameCard key={game.id} game={game} onPlay={handlePlay} />
                ))}
              </div>
            ) : (
              <div className="text-center py-10 sm:py-14">
                <p className="font-mono-arc text-xs text-gray-600 mb-1">No games in this category</p>
                <button
                  onClick={() => setFilter("all")}
                  className="font-mono-arc text-[10px] text-violet-400 uppercase tracking-wider hover:text-violet-300 transition-colors"
                >
                  Show all →
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ── Leaderboard — same continuous flow, no hard border break on mobile */}
        <section className="w-full px-4 sm:px-6 pt-2 pb-8 sm:py-8 sm:border-t sm:border-white/[0.05]">
          <div className="max-w-5xl mx-auto">
            <div className="glass-card p-4 sm:p-6 border-pink-500/10 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-pink-500/40 to-transparent" />
              <div className="flex items-center gap-3 mb-3 sm:mb-5">
                <span className="font-mono-arc text-[10px] text-gray-500 uppercase tracking-[0.2em]">Leaderboard</span>
                <span className="flex-1 h-px bg-white/[0.04]" />
                <span className="font-mono-arc text-[9px] text-pink-400 border border-pink-500/25 px-2 py-0.5 rounded-sm">7 days</span>
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
                <p className="text-center text-gray-500 py-4 text-sm">No leaderboard data available</p>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* ── Mobile sticky action bar — keeps the primary action one thumb-reach away */}
      <div
        className="sm:hidden fixed bottom-0 left-0 right-0 z-30 px-4 py-3 flex items-center gap-2.5"
        style={{
          background: "rgba(9,10,18,0.92)",
          backdropFilter: "blur(12px)",
          borderTop: "0.5px solid rgba(255,255,255,0.08)",
        }}
      >
        <button
          onClick={handleGoToLobby}
          className="flex-1 font-mono-arc text-[11px] py-3 rounded-sm glass-sm text-gray-300 uppercase tracking-wider text-center"
        >
          Browse
        </button>
        {isConnected ? (
          <button
            onClick={handleGoToLobby}
            className="flex-[1.4] font-mono-arc text-[11px] py-3 rounded-sm bg-violet-500 text-black font-bold uppercase tracking-wider active:scale-[0.98] transition-all"
          >
            Go to lobby →
          </button>
        ) : (
          <button
            onClick={handleConnect}
            className="flex-[1.4] font-mono-arc text-[11px] py-3 rounded-sm bg-violet-500 text-black font-bold uppercase tracking-wider active:scale-[0.98] transition-all"
          >
            Start playing
          </button>
        )}
      </div>
    </main>
  );
}