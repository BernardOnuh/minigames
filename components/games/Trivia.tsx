"use client";

import { useState, useEffect, useCallback } from "react";
import type { GameProps } from "../../app/game/[gameId]/page";

// ─── Questions by Category ─────────────────────────────────────────────────────

const CATEGORIES = [
  {
    id: "blockchains",
    label: "Blockchains",
    emoji: "🔗",
    questions: [
      { q: "Who created Ethereum?", o: ["Vitalik Buterin", "Satoshi Nakamoto", "Charles Hoskinson", "Gavin Wood"], c: 0 },
      { q: "What consensus does Bitcoin use?", o: ["Proof of Stake", "Proof of Work", "DPoS", "PoA"], c: 1 },
      { q: "Which blockchain introduced smart contracts first?", o: ["Bitcoin", "Ethereum", "Solana", "Cardano"], c: 1 },
      { q: "What is the native token of Solana?", o: ["SOL", "ADA", "DOT", "AVAX"], c: 0 },
      { q: "What does DeFi stand for?", o: ["Decentralized Finance", "Digital Finance", "Decentralized File", "Distributed Finance"], c: 0 },
      { q: "Which network uses the 'Ouroboros' consensus?", o: ["Ethereum", "Cardano", "Polkadot", "Avalanche"], c: 1 },
      { q: "What is a Layer 2 solution?", o: ["Main chain upgrade", "Scaling solution on top of L1", "New blockchain", "Hard fork"], c: 1 },
      { q: "Which crypto uses zk-SNARKs for privacy?", o: ["Monero", "Zcash", "Dash", "Bitcoin"], c: 1 },
      { q: "What is the gas limit in Ethereum?", o: ["Max gas per block", "Min gas per tx", "Total gas ever", "Gas price"], c: 0 },
      { q: "Who founded Polkadot?", o: ["Vitalik Buterin", "Gavin Wood", "Charles Hoskinson", "Brad Garlinghouse"], c: 1 },
      { q: "What is an NFT?", o: ["Non-Fungible Token", "New Financial Tool", "Network File Transfer", "Non-Forgeable Tag"], c: 0 },
      { q: "Which blockchain uses the 'Avalanche' consensus?", o: ["Solana", "Avalanche", "Polygon", "Fantom"], c: 1 },
      { q: "What is the largest stablecoin by market cap?", o: ["USDC", "USDT", "DAI", "BUSD"], c: 1 },
    ],
  },
  {
    id: "worldcups",
    label: "World Cups",
    emoji: "🏆",
    questions: [
      { q: "Which country won the 2022 FIFA World Cup?", o: ["France", "Brazil", "Argentina", "Germany"], c: 2 },
      { q: "How often is the FIFA World Cup held?", o: ["2 years", "3 years", "4 years", "5 years"], c: 2 },
      { q: "Who has the most World Cup goals all-time?", o: ["Pelé", "Miroslav Klose", "Ronaldo", "Lionel Messi"], c: 1 },
      { q: "Which country has won the most World Cups?", o: ["Germany", "Italy", "Brazil", "Argentina"], c: 2 },
      { q: "Where was the 2018 World Cup held?", o: ["Brazil", "South Africa", "Russia", "Qatar"], c: 2 },
      { q: "Which country hosted the first World Cup?", o: ["Brazil", "Uruguay", "Italy", "France"], c: 1 },
      { q: "Who won the Golden Boot in 2022?", o: ["Kylian Mbappé", "Lionel Messi", "Olivier Giroud", "Harry Kane"], c: 0 },
      { q: "Which country won the 2010 World Cup?", o: ["Netherlands", "Spain", "Germany", "Italy"], c: 1 },
      { q: "How many teams compete in the World Cup?", o: ["24", "32", "36", "48"], c: 1 },
      { q: "What trophy is awarded to the World Cup winner?", o: ["Golden Cup", "FIFA World Cup Trophy", "Jules Rimet Trophy", "World Cup Trophy"], c: 2 },
      { q: "Who scored the 'Hand of God' goal?", o: ["Maradona", "Messi", "Pelé", "Zidane"], c: 0 },
      { q: "Which country has never missed a World Cup?", o: ["Germany", "Brazil", "Italy", "Argentina"], c: 1 },
      { q: "Who was the captain of Argentina in 2022?", o: ["Di María", "Messi", "Álvarez", "Otamendi"], c: 1 },
    ],
  },
  {
    id: "politics",
    label: "Global Politics",
    emoji: "🌍",
    questions: [
      { q: "What is the United Nations?", o: ["A country", "An intl org of nations", "A treaty", "A bank"], c: 1 },
      { q: "Who is the Secretary-General of the UN in 2024?", o: ["António Guterres", "Ban Ki-moon", "Kofi Annan", "Boutros Boutros-Ghali"], c: 0 },
      { q: "What does NATO stand for?", o: ["North Atlantic Treaty Org", "National Alliance", "North American Treaty", "New Atlantic Org"], c: 0 },
      { q: "Which country left the European Union in 2020?", o: ["France", "Germany", "UK", "Italy"], c: 2 },
      { q: "How many countries are in the UN?", o: ["154", "177", "193", "201"], c: 2 },
      { q: "What is the European Union?", o: ["A country", "A political union of 27 states", "A military alliance", "A trade deal"], c: 1 },
      { q: "Which country has the largest population?", o: ["China", "India", "USA", "Indonesia"], c: 1 },
      { q: "What is the G7?", o: ["7 largest economies", "7 UN members", "7 EU countries", "7 NATO members"], c: 0 },
      { q: "Which country is the newest UN member?", o: ["South Sudan", "East Timor", "Montenegro", "Kosovo"], c: 0 },
      { q: "What is the Paris Agreement about?", o: ["Trade", "Climate change", "Nuclear weapons", "Human rights"], c: 1 },
      { q: "Who is the current US President (2025)?", o: ["Joe Biden", "Donald Trump", "Kamala Harris", "Barack Obama"], c: 0 },
      { q: "What is the World Bank?", o: ["A bank for rich people", "Intl financial institution", "A charity", "UN agency"], c: 1 },
      { q: "Which country has a veto in the UN Security Council?", o: ["Germany", "India", "Russia", "Japan"], c: 2 },
    ],
  },
  {
    id: "inventors",
    label: "Inventors",
    emoji: "💡",
    questions: [
      { q: "Who invented the light bulb?", o: ["Nikola Tesla", "Thomas Edison", "Alexander Bell", "Benjamin Franklin"], c: 1 },
      { q: "Who invented the telephone?", o: ["Thomas Edison", "Nikola Tesla", "Alexander Bell", "Guglielmo Marconi"], c: 2 },
      { q: "Who invented the World Wide Web?", o: ["Bill Gates", "Tim Berners-Lee", "Steve Jobs", "Vint Cerf"], c: 1 },
      { q: "Who invented the printing press?", o: ["Johannes Gutenberg", "Galileo Galilei", "Isaac Newton", "Leonardo da Vinci"], c: 0 },
      { q: "Who invented the airplane?", o: ["The Wright Brothers", "Alberto Santos", "Charles Lindbergh", "Howard Hughes"], c: 0 },
      { q: "Who discovered penicillin?", o: ["Louis Pasteur", "Alexander Fleming", "Joseph Lister", "Robert Koch"], c: 1 },
      { q: "Who invented the steam engine?", o: ["James Watt", "Thomas Newcomen", "George Stephenson", "Robert Fulton"], c: 0 },
      { q: "Who invented the radio?", o: ["Thomas Edison", "Alexander Bell", "Guglielmo Marconi", "Nikola Tesla"], c: 2 },
      { q: "Who invented the modern computer?", o: ["Alan Turing", "Charles Babbage", "John von Neumann", "Konrad Zuse"], c: 1 },
      { q: "Who invented the X-ray?", o: ["Marie Curie", "Wilhelm Röntgen", "Albert Einstein", "Henri Becquerel"], c: 1 },
      { q: "Who invented the Internet?", o: ["Vint Cerf + Bob Kahn", "Tim BL", "Al Gore", "DARPA"], c: 0 },
      { q: "Who invented the battery?", o: ["Alessandro Volta", "Benjamin Franklin", "Michael Faraday", "Nikola Tesla"], c: 0 },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    emoji: "💰",
    questions: [
      { q: "What does GDP stand for?", o: ["Gross Domestic Product", "General Debt Plan", "Global Development Policy", "Gross Demand Price"], c: 0 },
      { q: "What is inflation?", o: ["Prices going down", "Prices rising over time", "Interest rates up", "Money printing"], c: 1 },
      { q: "What is a stock?", o: ["A loan to a company", "Ownership in a company", "A bond", "A commodity"], c: 1 },
      { q: "What is compound interest?", o: ["Interest on principal only", "Interest on principal + accumulated interest", "Fixed interest", "Simple interest"], c: 1 },
      { q: "What does the Federal Reserve do?", o: ["Sets fiscal policy", "US central bank", "Tax collection", "Regulates trade"], c: 1 },
      { q: "What is a bond?", o: ["Ownership share", "A debt security", "A derivative", "A currency"], c: 1 },
      { q: "What is the S&P 500?", o: ["500 largest US companies", "500 global companies", "A bond index", "A commodity index"], c: 0 },
      { q: "What is a recession?", o: ["Economic growth", "2+ quarters of negative GDP growth", "High inflation", "Low unemployment"], c: 1 },
      { q: "What does APR stand for?", o: ["Annual Percentage Rate", "Actual Payment Rate", "Average Profit Ratio", "Annual Principal Return"], c: 0 },
      { q: "What is diversification?", o: ["Investing in one asset", "Spreading investments across assets", "High-risk strategy", "Day trading"], c: 1 },
      { q: "What is a hedge fund?", o: ["A mutual fund", "An investment pool using complex strategies", "A bank account", "An ETF"], c: 1 },
      { q: "What is the Dow Jones?", o: ["A stock market index", "A bank", "A bond", "A regulatory body"], c: 0 },
      { q: "What is a cryptocurrency?", o: ["Digital currency using cryptography", "A stock", "A bond", "A commodity"], c: 0 },
    ],
  },
  {
    id: "general",
    label: "General",
    emoji: "🧠",
    questions: [
      { q: "What is the capital of France?", o: ["London", "Paris", "Berlin", "Madrid"], c: 1 },
      { q: "Which planet is known as the Red Planet?", o: ["Venus", "Mars", "Jupiter", "Saturn"], c: 1 },
      { q: "What is the largest ocean?", o: ["Atlantic", "Indian", "Arctic", "Pacific"], c: 3 },
      { q: "Who wrote Romeo and Juliet?", o: ["Jane Austen", "Shakespeare", "Charles Dickens", "Mark Twain"], c: 1 },
      { q: "What is the smallest country?", o: ["Monaco", "Liechtenstein", "Vatican City", "San Marino"], c: 2 },
      { q: "How many continents are there?", o: ["5", "6", "7", "8"], c: 2 },
      { q: "What is the chemical symbol for gold?", o: ["Gd", "Au", "Ag", "Go"], c: 1 },
      { q: "Which country has the kangaroo?", o: ["New Zealand", "South Africa", "Australia", "Brazil"], c: 2 },
      { q: "What is the fastest land animal?", o: ["Lion", "Gazelle", "Cheetah", "Pronghorn"], c: 2 },
      { q: "Who painted the Mona Lisa?", o: ["Michelangelo", "Da Vinci", "Raphael", "Donatello"], c: 1 },
      { q: "How many bones in the human body?", o: ["106", "206", "306", "406"], c: 1 },
      { q: "What gas do plants absorb?", o: ["Oxygen", "Nitrogen", "CO2", "Hydrogen"], c: 2 },
      { q: "What is the speed of light?", o: ["300,000 km/s", "150,000 km/s", "500,000 km/s", "1,000,000 km/s"], c: 0 },
    ],
  },
] as const;

type CategoryId = (typeof CATEGORIES)[number]["id"];

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
    <div className="w-full h-full flex flex-col items-center justify-center gap-6 px-6" style={{ background: "rgba(10,6,25,0.97)" }}>
      <div style={{ fontSize: 56 }}>🧠</div>
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

// ─── Trivia Game ───────────────────────────────────────────────────────────────

export default function TriviaGameEnhanced({ gameConfig, onGameComplete, onGameFail }: GameProps) {
  const [phase, setPhase] = useState<"categories" | "playing" | "results">("categories");
  const [category, setCategory] = useState<CategoryId>("general");
  const [qIdx, setQIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(18);
  const [multiplier, setMultiplier] = useState(1);
  const [powerUps, setPowerUps] = useState(3);
  const [hintUsed, setHintUsed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);

  const cat = CATEGORIES.find(c => c.id === category)!;
  const questions = cat.questions;
  const q = questions[qIdx];
  const totalQ = questions.length;
  const timePct = (timeLeft / 20) * 100;
  const timeColor = timeLeft > 12 ? "#4ade80" : timeLeft > 6 ? "#f59e0b" : "#ef4444";
  const isCorrect = selected === q?.c;

  // Timer
  useEffect(() => {
    if (phase !== "playing" || answered) return;
    const iv = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          setSelected(-1);
          setAnswered(true);
          setStreak(0);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [phase, answered]);

  const handleAnswer = useCallback((index: number) => {
    if (answered) return;
    setSelected(index);
    setAnswered(true);
    if (index === q.c) {
      const bonus = Math.floor(timeLeft * 2);
      const pts = (10 + bonus) * multiplier;
      setScore(s => s + pts);
      setStreak(s => s + 1);
      if ((streak + 1) % 3 === 0) setMultiplier(m => m + 1);
    } else {
      setStreak(0);
      setMultiplier(1);
    }
  }, [answered, q, timeLeft, multiplier, streak]);

  const nextQuestion = useCallback(() => {
    if (qIdx + 1 < totalQ) {
      setQIdx(i => i + 1);
      setSelected(null);
      setAnswered(false);
      setTimeLeft(20);
      setHintUsed(false);
      setShowHint(false);
    } else {
      const fs = score;
      setFinalScore(fs);
      const xp = Math.max(100, Math.floor((fs / 100) * (gameConfig.base_xp ?? 50)));
      setXpEarned(xp);
      setPhase("results");
    }
  }, [qIdx, totalQ, score, gameConfig.base_xp]);

  const useHint = () => {
    if (powerUps <= 0 || hintUsed || answered) return;
    setHintUsed(true);
    setShowHint(true);
    setPowerUps(p => p - 1);
  };

  const skipQuestion = () => {
    if (powerUps <= 0 || answered) return;
    setPowerUps(p => p - 1);
    nextQuestion();
  };

  const getHint = () => {
    const correct = q.o[q.c];
    return `${correct[0]}${"_".repeat(correct.length - 1)} (${correct.length} letters)`;
  };

  const progress = ((answered ? qIdx + 1 : qIdx) / totalQ) * 100;

  const startCategory = useCallback((id: CategoryId) => {
    setCategory(id);
    setPhase("playing");
    setQIdx(0);
    setScore(0);
    setSelected(null);
    setAnswered(false);
    setStreak(0);
    setMultiplier(1);
    setPowerUps(2);
    setHintUsed(false);
    setShowHint(false);
    setTimeLeft(20);
  }, []);

  const handleClaim = useCallback(() => {
    onGameComplete(finalScore);
  }, [onGameComplete, finalScore]);

  if (phase === "results") {
    return (
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl border border-purple-400/30"
        style={{ background: "linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%)" }}
      >
        <XPClaimScreen score={finalScore} xpEarned={xpEarned} onClaim={handleClaim} />
      </div>
    );
  }

  if (phase === "categories") {
    return (
      <div className="w-full max-w-2xl">
        <div
          className="rounded-2xl p-8 shadow-2xl border border-purple-400/30"
          style={{ background: "linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%)" }}
        >
          <h2 className="text-3xl font-bold text-purple-400 text-center mb-2">TRIVIA MASTER</h2>
          <p className="text-cyan-400 text-xs mb-8 uppercase tracking-widest text-center">Choose a category</p>
          <div className="grid grid-cols-2 gap-3">
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                onClick={() => startCategory(c.id)}
                className="p-5 rounded-xl text-left font-bold transition-all hover:scale-[1.02] active:scale-95 border border-purple-400/20 hover:border-purple-400/60"
                style={{ background: "rgba(167,139,250,0.06)" }}
              >
                <span className="text-2xl block mb-1">{c.emoji}</span>
                <span className="text-sm text-white block">{c.label}</span>
                <span className="text-[9px] text-gray-500 mt-1 block">{c.questions.length} questions</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl">
      <div
          className="rounded-2xl p-6 shadow-2xl border border-purple-400/35"
          style={{ background: "linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%)" }}
        >
          {/* HUD */}
          <div className="mb-6 p-3 rounded-lg border border-cyan-400/25" style={{ background: "rgba(56,189,248,0.04)" }}>
          <div className="flex justify-between items-center gap-3">
            <div className="flex-1">
              <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-0.5">Score</p>
              <p className="text-xl font-bold text-purple-400">{score}</p>
            </div>
            <div className="flex-1">
              <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-0.5">Streak</p>
              <p className="text-xl font-bold text-green-400">{streak}x{streak > 2 && " 🔥"}</p>
            </div>
            <div className="flex-1">
              <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-0.5">Mult</p>
              <p className="text-xl font-bold text-amber-400">x{multiplier}</p>
            </div>
            <div className="flex-1">
              <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-0.5">Powers</p>
              <p className="text-xl font-bold text-pink-400">{powerUps}</p>
            </div>
          </div>
        </div>

        {/* Progress + Timer */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-400">{cat.emoji} {cat.label} · {qIdx + 1}/{totalQ}</span>
            <span className="text-xs font-bold" style={{ color: timeColor }}>{timeLeft}s</span>
          </div>
          <div className="w-full bg-gray-700/50 rounded-full h-1.5 overflow-hidden border border-purple-400/20 mb-1.5">
            <div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <div className="w-full bg-gray-700/50 rounded-full h-1.5 overflow-hidden border border-green-400/20">
            <div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${timePct}%` }} />
          </div>
        </div>

        {/* Question */}
        <h3 className="text-xl font-bold text-white mb-1 text-center leading-tight">{q.q}</h3>
          <p className="text-center text-[9px] text-gray-600 mb-6 uppercase tracking-widest">{cat.label}</p>

        {/* Hint */}
        {showHint && (
          <div className="mb-4 p-3 rounded-lg border border-cyan-400/50" style={{ background: "rgba(56,189,248,0.08)" }}>
            <p className="text-cyan-400 font-mono-arc text-sm">💡 Hint: {getHint()}</p>
          </div>
        )}

        {/* Options */}
        <div className="grid gap-2 mb-5">
          {q.o.map((opt, i) => {
            let cls = "bg-gray-700/50 border border-gray-600";
            if (answered) {
              if (i === q.c) cls = "bg-green-500/30 border border-green-500 text-green-300";
              else if (i === selected) cls = "bg-red-500/30 border border-red-500 text-red-300";
            } else {
              cls = "bg-gray-700/50 border border-gray-600 hover:border-purple-400 cursor-pointer hover:bg-gray-700";
            }
            return (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                disabled={answered}
                className={`p-3 rounded-lg font-semibold text-left transition-all duration-300 ${cls}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm">{opt}</span>
                  {answered && i === q.c && <span className="text-green-400 text-sm">✓</span>}
                  {answered && i === selected && i !== q.c && <span className="text-red-400 text-sm">✗</span>}
                </div>
              </button>
            );
          })}
        </div>

        {/* Power-ups */}
        {!answered && (
          <div className="grid grid-cols-2 gap-3 mb-5">
            <button onClick={useHint} disabled={hintUsed || powerUps === 0}
              className={`py-2 px-4 rounded-lg font-semibold text-[10px] uppercase tracking-widest transition-all ${
                hintUsed || powerUps === 0
                  ? "bg-gray-700/30 text-gray-600 cursor-not-allowed"
                  : "bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 hover:bg-cyan-500/30"
              }`}
            >💡 HINT</button>
            <button onClick={skipQuestion} disabled={powerUps === 0}
              className={`py-2 px-4 rounded-lg font-semibold text-[10px] uppercase tracking-widest transition-all ${
                powerUps === 0
                  ? "bg-gray-700/30 text-gray-600 cursor-not-allowed"
                  : "bg-pink-500/20 border border-pink-400/50 text-pink-300 hover:bg-pink-500/30"
              }`}
            >⊘ SKIP</button>
          </div>
        )}

        {/* Feedback */}
        {answered && (
          <div className="space-y-3">
            <div className={`p-3 rounded-lg text-center font-semibold ${
              isCorrect
                ? "bg-green-500/20 border border-green-500 text-green-300"
                : "bg-red-500/20 border border-red-500 text-red-300"
            }`}>
              {isCorrect ? (
                <div>
                  <p className="text-base">🎉 CORRECT!</p>
                  <p className="text-[11px] mt-0.5">+{(10 + Math.floor(timeLeft * 2)) * multiplier} points</p>
                </div>
              ) : (
                <div>
                  <p className="text-base">❌ INCORRECT</p>
                  <p className="text-[11px] mt-0.5">Answer: {q.o[q.c]}</p>
                </div>
              )}
            </div>
            <button onClick={nextQuestion}
              className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-lg hover:from-purple-400 hover:to-pink-400 transition-all uppercase tracking-widest text-sm"
            >
              {qIdx + 1 === totalQ ? "FINISH QUIZ" : "NEXT QUESTION"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
