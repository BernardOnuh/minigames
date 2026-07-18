"use client";

import { useState, useEffect, useCallback } from "react";
import type { GameProps } from "../../app/game/[gameId]/page";

type Player = "X" | "O";
type Cell = Player | null;
type Board = Cell[];

function checkWinner(board: Board): Player | "draw" | null {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6],
  ];
  for (const [a,b,c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a] as Player;
  }
  if (board.every(c => c !== null)) return "draw";
  return null;
}

function minimax(board: Board, depth: number, isMax: boolean): number {
  const w = checkWinner(board);
  if (w === "X") return -10 + depth;
  if (w === "O") return 10 - depth;
  if (w === "draw") return 0;
  if (isMax) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] !== null) continue;
      board[i] = "O";
      best = Math.max(best, minimax(board, depth + 1, false));
      board[i] = null;
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] !== null) continue;
      board[i] = "X";
      best = Math.min(best, minimax(board, depth + 1, true));
      board[i] = null;
    }
    return best;
  }
}

function bestMove(board: Board): number {
  let best = -Infinity, move = -1;
  for (let i = 0; i < 9; i++) {
    if (board[i] !== null) continue;
    board[i] = "O";
    const val = minimax(board, 0, false);
    board[i] = null;
    if (val > best) { best = val; move = i; }
  }
  return move;
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
      <div style={{ fontSize: 56 }}>❌⭕</div>
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

export default function TicTacToeGame({ gameConfig, onGameComplete }: GameProps) {
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [turn, setTurn] = useState<Player>("X");
  const [winner, setWinner] = useState<Player | "draw" | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [phase, setPhase] = useState<"start" | "playing" | "results">("start");
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [resultText, setResultText] = useState("");
  const [finalScore, setFinalScore] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [aiThinking, setAiThinking] = useState(false);

  // AI move
  useEffect(() => {
    if (phase !== "playing" || gameOver || turn !== "O" || winner) return;
    setAiThinking(true);
    const t = setTimeout(() => {
      setBoard(prev => {
        const copy = [...prev];
        const move = bestMove(copy);
        if (move === -1) return prev;
        copy[move] = "O";
        return copy;
      });
      setTurn("X");
      setAiThinking(false);
    }, 380);
    return () => clearTimeout(t);
  }, [phase, turn, gameOver, winner]);

  // Check winner after board updates
  useEffect(() => {
    if (phase !== "playing") return;
    const w = checkWinner(board);
    if (w) {
      setWinner(w);
      setGameOver(true);
      let pts = 0;
      if (w === "X") { pts = 50; setResultText("You win!"); }
      else if (w === "O") { pts = 10; setResultText("AI wins..."); }
      else { pts = 25; setResultText("Draw!"); }
      setScore(s => s + pts);
    }
  }, [board, phase]);

  const handleCellClick = useCallback((i: number) => {
    if (phase !== "playing" || gameOver || turn !== "X" || board[i] !== null || aiThinking) return;
    setBoard(prev => {
      const copy = [...prev];
      copy[i] = "X";
      return copy;
    });
    setTurn("O");
  }, [phase, gameOver, turn, board, aiThinking]);

  const startGame = useCallback(() => {
    setBoard(Array(9).fill(null));
    setTurn("X");
    setWinner(null);
    setGameOver(false);
    setPhase("playing");
    setAiThinking(false);
  }, []);

  const nextRound = useCallback(() => {
    setRound(r => r + 1);
    setBoard(Array(9).fill(null));
    setTurn("X");
    setWinner(null);
    setGameOver(false);
    setAiThinking(false);
  }, []);

  const claimXp = useCallback(() => {
    setFinalScore(score);
    const xp = Math.max(100, Math.floor((score / 100) * (gameConfig.base_xp ?? 50)));
    setXpEarned(xp);
    setPhase("results");
  }, [score, gameConfig.base_xp]);

  const handleClaim = useCallback(() => {
    onGameComplete(finalScore);
  }, [onGameComplete, finalScore]);

  if (phase === "results") {
    return <XPClaimScreen score={finalScore} xpEarned={xpEarned} onClaim={handleClaim} />;
  }

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center gap-6 px-4">
      {phase === "start" && (
        <div className="w-full rounded-2xl p-8 text-center shadow-2xl border border-purple-400/30"
          style={{ background: "linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%)" }}
        >
          <h2 className="text-4xl font-bold text-purple-400 mb-2">X & O</h2>
          <p className="text-cyan-400 text-sm mb-6 uppercase tracking-widest">Tic Tac Toe</p>
          <p className="text-gray-300 mb-2">You are <span className="text-blue-400 font-bold">X</span> — play first</p>
          <p className="text-gray-500 text-xs mb-8">Beat the AI to earn XP</p>
          <button onClick={startGame}
            className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-lg hover:from-purple-400 hover:to-pink-400 transition-all text-lg uppercase tracking-widest"
          >
            Play Now
          </button>
        </div>
      )}

      {phase === "playing" && (
        <div className="w-full rounded-2xl p-6 shadow-2xl border border-purple-400/30"
          style={{ background: "linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%)" }}
        >
          {/* HUD */}
          <div className="flex justify-between items-center mb-6">
            <div className="text-center">
              <p className="text-[9px] text-gray-500 uppercase tracking-widest">Score</p>
              <p className="text-xl font-bold text-purple-400">{score}</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-gray-500 uppercase tracking-widest">Round</p>
              <p className="text-xl font-bold text-white">{round}</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-gray-500 uppercase tracking-widest">Turn</p>
              <p className={`text-xl font-bold ${turn === "X" ? "text-blue-400" : "text-red-400"}`}>
                {aiThinking ? "🤔" : turn}
              </p>
            </div>
          </div>

          {/* Board */}
          <div className="grid grid-cols-3 gap-2 mx-auto mb-6" style={{ maxWidth: 280 }}>
            {board.map((cell, i) => (
              <button key={i} onClick={() => handleCellClick(i)}
                disabled={gameOver || cell !== null || turn !== "X" || aiThinking}
                className="w-full aspect-square rounded-2xl text-3xl font-bold transition-all active:scale-95 flex items-center justify-center"
                style={{
                  background: cell ? "rgba(167,139,250,0.08)" : "rgba(255,255,255,0.03)",
                  border: cell
                    ? cell === "X" ? "1px solid rgba(96,165,250,0.4)" : "1px solid rgba(248,113,113,0.4)"
                    : "1px solid rgba(255,255,255,0.08)",
                  color: cell === "X" ? "#60a5fa" : "#f87171",
                  cursor: gameOver || cell !== null || turn !== "X" || aiThinking ? "default" : "pointer",
                }}
              >
                {cell === "X" && "✕"}
                {cell === "O" && "◯"}
              </button>
            ))}
          </div>

          {/* Status */}
          {gameOver ? (
            <div className="flex flex-col items-center gap-3">
              <div className="p-3 rounded-lg w-full text-center font-semibold"
                style={{
                  background: winner === "X" ? "rgba(74,222,128,0.15)" : winner === "O" ? "rgba(239,68,68,0.15)" : "rgba(251,191,36,0.15)",
                  border: `1px solid ${winner === "X" ? "#4ade80" : winner === "O" ? "#ef4444" : "#f59e0b"}`,
                  color: winner === "X" ? "#4ade80" : winner === "O" ? "#ef4444" : "#f59e0b",
                }}
              >
                <p className="text-base">{resultText}</p>
                <p className="text-xs mt-0.5">
                  {winner === "X" ? "+50 pts" : winner === "O" ? "+10 pts" : "+25 pts"}
                </p>
              </div>
              <button onClick={nextRound}
                className="w-full py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-lg hover:from-purple-400 hover:to-pink-400 transition-all uppercase tracking-widest text-sm"
              >
                Next Round
              </button>
              <button onClick={claimXp}
                className="w-full py-2 text-xs font-bold rounded-lg uppercase tracking-widest transition-all"
                style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}
              >
                Finish & Claim XP
              </button>
            </div>
          ) : (
            <p className="text-center text-[10px] text-gray-600 uppercase tracking-widest">
              {turn === "X" ? "Your turn" : "AI thinking..."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
