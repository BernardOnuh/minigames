"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { GameProps } from "../../app/game/[gameId]/page";

type Suit = "spades" | "hearts" | "clubs" | "diamonds";
type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

interface Card {
  suit: Suit;
  rank: Rank;
  hidden?: boolean;
}

const SUIT_SYMBOL: Record<Suit, string> = { spades: "♠", hearts: "♥", clubs: "♣", diamonds: "♦" };
const SUIT_COLOR: Record<Suit, string> = { spades: "#e2e8f0", hearts: "#ef4444", clubs: "#e2e8f0", diamonds: "#ef4444" };

function createDeck(): Card[] {
  const suits: Suit[] = ["spades", "hearts", "clubs", "diamonds"];
  const ranks: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const deck: Card[] = [];
  for (const suit of suits)
    for (const rank of ranks) deck.push({ suit, rank });
  return deck;
}

function shuffle(d: Card[]): Card[] {
  const a = [...d];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cardValue(rank: Rank): number {
  if (rank === "A") return 11;
  if (["K","Q","J"].includes(rank)) return 10;
  return parseInt(rank);
}

function handValue(cards: Card[]): number {
  let total = 0, aces = 0;
  for (const c of cards) {
    if (c.hidden) continue;
    total += cardValue(c.rank);
    if (c.rank === "A") aces++;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function CardView({ card, small }: { card: Card; small?: boolean }) {
  if (card.hidden) {
    return (
      <div className={`rounded-lg flex items-center justify-center font-bold`}
        style={{
          width: small ? 40 : 48, height: small ? 56 : 64,
          background: "linear-gradient(135deg,#7c3aed,#a78bfa)",
          border: "0.5px solid rgba(167,139,250,0.4)",
          borderRadius: 8, fontSize: small ? 14 : 18, color: "#fff",
        }}
      >?</div>
    );
  }
  return (
    <div className={`rounded-lg flex flex-col items-center justify-center font-bold`}
      style={{
        width: small ? 40 : 48, height: small ? 56 : 64,
        background: "rgba(255,255,255,0.08)",
        border: "0.5px solid rgba(255,255,255,0.12)",
        borderRadius: 8,
        color: SUIT_COLOR[card.suit],
      }}
    >
      <span style={{ fontSize: small ? 10 : 13, lineHeight: 1 }}>{card.rank}</span>
      <span style={{ fontSize: small ? 12 : 16, lineHeight: 1 }}>{SUIT_SYMBOL[card.suit]}</span>
    </div>
  );
}

// ─── XP Claim Screen ──────────────────────────────────────────────────────────

function XPClaimScreen({ score, xpEarned, onClaim }: {
  score: number; xpEarned: number; onClaim: () => void;
}) {
  const [claimed, setClaimed] = useState(false);
  const [counting, setCounting] = useState(0);

  useEffect(() => {
    if (!claimed) return;
    let n = 0;
    const step = Math.ceil(xpEarned / 40);
    const iv = setInterval(() => {
      n = Math.min(n + step, xpEarned);
      setCounting(n);
      if (n >= xpEarned) clearInterval(iv);
    }, 30);
    return () => clearInterval(iv);
  }, [claimed, xpEarned]);

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center gap-6 px-6" style={{ background: "rgba(10,6,25,0.97)", minHeight: 400, borderRadius: 16 }}>
      <div style={{ fontSize: 56 }}>🃏</div>
      <div className="text-center">
        <p className="font-mono-arc text-[9px] text-gray-500 uppercase tracking-[0.2em] mb-1">Final score</p>
        <p className="font-mono-arc text-5xl font-bold text-white tabular-nums">{score.toLocaleString()}</p>
      </div>
      <div className="w-full h-px" style={{ background: "rgba(167,139,250,0.15)" }} />
      {!claimed ? (
        <div className="text-center flex flex-col items-center gap-4">
          <p className="font-mono-arc text-[9px] text-violet-400 uppercase tracking-[0.2em]">XP earned this round</p>
          <div className="font-mono-arc text-3xl font-bold" style={{ color: "#a78bfa", textShadow: "0 0 20px rgba(167,139,250,0.5)" }}>
            +{xpEarned} XP
          </div>
          <button onClick={() => setClaimed(true)}
            className="font-mono-arc text-xs font-bold uppercase tracking-widest px-8 py-3 rounded-lg transition-all hover:opacity-90 active:scale-95"
            style={{ background: "linear-gradient(135deg,#7c3aed,#a78bfa)", color: "#fff", boxShadow: "0 0 24px rgba(167,139,250,0.3)" }}
          >
            Claim XP →
          </button>
        </div>
      ) : (
        <div className="text-center flex flex-col items-center gap-4">
          <p className="font-mono-arc text-[9px] text-violet-400 uppercase tracking-[0.2em]">XP claimed!</p>
          <div className="font-mono-arc text-4xl font-bold" style={{ color: "#4ade80", textShadow: "0 0 20px rgba(74,222,128,0.4)" }}>
            +{counting} XP ✓
          </div>
          <button onClick={onClaim}
            className="font-mono-arc text-[10px] uppercase tracking-widest px-6 py-2.5 rounded-lg transition-all hover:opacity-80"
            style={{ background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.12)", color: "#9ca3af" }}
          >
            Back to lobby →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Game ─────────────────────────────────────────────────────────────────

export default function BlackjackGame({ gameConfig, onGameComplete }: GameProps) {
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [dealerHand, setDealerHand] = useState<Card[]>([]);
  const [phase, setPhase] = useState<"start" | "playing" | "dealer" | "result" | "results">("start");
  const [result, setResult] = useState<"win" | "lose" | "push" | null>(null);
  const [bank, setBank] = useState(500);
  const [bet, setBet] = useState(50);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [dealerRevealed, setDealerRevealed] = useState(false);

  const deckRef = useRef<Card[]>([]);
  const dealerRef = useRef<Card[]>([]);
  const playerRef = useRef<Card[]>([]);

  const initDeal = useCallback(() => {
    const d = shuffle(createDeck());
    deckRef.current = d;
    playerRef.current = [d.pop()!, d.pop()!];
    dealerRef.current = [d.pop()!, { ...d.pop()!, hidden: true }];
    setPlayerHand([...playerRef.current]);
    setDealerHand([...dealerRef.current]);
    setPhase("playing");
    setResult(null);
    setDealerRevealed(false);
  }, []);

  const doHit = useCallback(() => {
    if (phase !== "playing") return;
    const d = deckRef.current;
    const card = d.pop();
    if (!card) return;
    playerRef.current.push(card);
    setPlayerHand([...playerRef.current]);
    const v = handValue(playerRef.current);
    if (v > 21) {
      setPhase("result");
      setResult("lose");
      setLosses(l => l + 1);
      setBank(b => b - bet);
      setDealerRevealed(true);
      setDealerHand(dealerRef.current.map(c => ({ ...c, hidden: false })));
    }
  }, [phase, bet]);

  const doStand = useCallback(() => {
    if (phase !== "playing") return;
    setDealerRevealed(true);
    dealerRef.current = dealerRef.current.map(c => ({ ...c, hidden: false }));
    setDealerHand([...dealerRef.current]);
    setPhase("dealer");

    const drawLoop = () => {
      const v = handValue(dealerRef.current);
      if (v >= 17) {
        const pv = handValue(playerRef.current);
        const dv = handValue(dealerRef.current);
        let r: "win" | "lose" | "push";
        if (dv > 21 || pv > dv) { r = "win"; setWins(w => w + 1); setBank(b => b + bet); }
        else if (pv === dv) { r = "push"; }
        else { r = "lose"; setLosses(l => l + 1); setBank(b => b - bet); }
        setResult(r);
        setPhase("result");
        return;
      }
      const d = deckRef.current;
      const card = d.pop();
      if (!card) return;
      dealerRef.current.push(card);
      setDealerHand([...dealerRef.current]);
      setTimeout(drawLoop, 500);
    };
    setTimeout(drawLoop, 500);
  }, [bet]);

  const newRound = useCallback(() => {
    if (bank <= 0) {
      // Game over, can't continue
      return;
    }
    initDeal();
  }, [bank, initDeal]);

  const claimXp = useCallback(() => {
    const score = bank + wins * 100;
    setFinalScore(score);
    const xp = Math.max(100, Math.floor((score / 100) * (gameConfig.base_xp ?? 50)));
    setXpEarned(xp);
    setPhase("results");
  }, [bank, wins, gameConfig.base_xp]);

  const handleClaim = useCallback(() => {
    onGameComplete(finalScore);
  }, [onGameComplete, finalScore]);

  useEffect(() => {
    // Auto initial deal when game starts
    if (phase === "start") {
      initDeal();
    }
  }, [phase, initDeal]);

  if (phase === "results") {
    return <XPClaimScreen score={finalScore} xpEarned={xpEarned} onClaim={handleClaim} />;
  }

  const pv = handValue(playerHand);
  const dv = handValue(dealerHand);

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center gap-4 px-4">
      <div className="w-full rounded-2xl p-6 shadow-2xl border border-purple-400/30"
        style={{ background: "linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%)" }}
      >
        {/* HUD */}
        <div className="flex justify-between items-center mb-6">
          <div className="text-center">
            <p className="text-[9px] text-gray-500 uppercase tracking-widest">Bank</p>
            <p className="text-lg font-bold text-amber-400">${bank}</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] text-gray-500 uppercase tracking-widest">Bet</p>
            <p className="text-lg font-bold text-cyan-400">${bet}</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] text-gray-500 uppercase tracking-widest">W/L</p>
            <p className="text-lg font-bold">
              <span className="text-green-400">{wins}</span>
              <span className="text-gray-600">/</span>
              <span className="text-red-400">{losses}</span>
            </p>
          </div>
        </div>

        {/* Dealer */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9px] text-gray-500 uppercase tracking-widest">Dealer</p>
            <p className="text-sm font-bold" style={{ color: dv > 21 ? "#ef4444" : dv === 21 ? "#fbbf24" : "#e2e8f0" }}>
              {dealerRevealed ? dv : handValue(dealerHand.filter(c => !c.hidden))}
            </p>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {dealerHand.map((c, i) => <CardView key={i} card={c} />)}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px mb-6" style={{ background: "rgba(255,255,255,0.06)" }} />

        {/* Player */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9px] text-gray-500 uppercase tracking-widest">You</p>
            <p className="text-sm font-bold" style={{ color: pv > 21 ? "#ef4444" : pv === 21 ? "#fbbf24" : "#e2e8f0" }}>
              {pv}
            </p>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {playerHand.map((c, i) => <CardView key={i} card={c} />)}
          </div>
        </div>

        {/* Actions */}
        {phase === "playing" && (
          <div className="flex gap-3">
            <button onClick={doHit}
              className="flex-1 py-3 rounded-lg font-bold text-sm uppercase tracking-widest transition-all hover:opacity-90 active:scale-95"
              style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#fff" }}
            >Hit</button>
            <button onClick={doStand}
              className="flex-1 py-3 rounded-lg font-bold text-sm uppercase tracking-widest transition-all hover:opacity-90 active:scale-95"
              style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)", color: "#fff" }}
            >Stand</button>
          </div>
        )}

        {/* Result */}
        {phase === "result" && (
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 rounded-lg w-full text-center font-semibold"
              style={{
                background: result === "win" ? "rgba(74,222,128,0.15)" : result === "lose" ? "rgba(239,68,68,0.15)" : "rgba(251,191,36,0.15)",
                border: `1px solid ${result === "win" ? "#4ade80" : result === "lose" ? "#ef4444" : "#f59e0b"}`,
                color: result === "win" ? "#4ade80" : result === "lose" ? "#ef4444" : "#f59e0b",
              }}
            >
              <p className="text-base">
                {result === "win" ? "🎉 You win!" : result === "lose" ? "💀 Bust!" : "🤝 Push"}
              </p>
              <p className="text-xs mt-0.5 text-gray-400">
                Dealer: {dv} · You: {pv}
              </p>
            </div>
            <div className="flex gap-3 w-full">
              <button onClick={newRound}
                disabled={bank <= 0}
                className="flex-1 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-lg hover:from-purple-400 hover:to-pink-400 transition-all uppercase tracking-widest text-sm disabled:opacity-30"
              >
                {bank <= 0 ? "Bankrupt" : "Next Hand"}
              </button>
              <button onClick={claimXp}
                className="py-2.5 px-4 text-xs font-bold rounded-lg uppercase tracking-widest transition-all"
                style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}
              >
                Cash Out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
