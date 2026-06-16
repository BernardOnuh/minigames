"use client";

import { useState, useEffect } from "react";
import type { GameProps } from "../../app/game/[gameId]/page";

const QUESTIONS = [
  {
    question: "What is the capital of France?",
    options: ["London", "Paris", "Berlin", "Madrid"],
    correct: 1,
    category: "Geography",
  },
  {
    question: "Which planet is known as the Red Planet?",
    options: ["Venus", "Mars", "Jupiter", "Saturn"],
    correct: 1,
    category: "Science",
  },
  {
    question: "What is the largest ocean on Earth?",
    options: ["Atlantic", "Indian", "Arctic", "Pacific"],
    correct: 3,
    category: "Geography",
  },
  {
    question: "Who wrote Romeo and Juliet?",
    options: ["Jane Austen", "William Shakespeare", "Charles Dickens", "Mark Twain"],
    correct: 1,
    category: "Literature",
  },
  {
    question: "What is the smallest country in the world?",
    options: ["Monaco", "Liechtenstein", "Vatican City", "San Marino"],
    correct: 2,
    category: "Geography",
  },
  {
    question: "How many continents are there?",
    options: ["5", "6", "7", "8"],
    correct: 2,
    category: "Geography",
  },
  {
    question: "What is the chemical symbol for gold?",
    options: ["Gd", "Au", "Ag", "Go"],
    correct: 1,
    category: "Science",
  },
  {
    question: "Which country is home to the kangaroo?",
    options: ["New Zealand", "South Africa", "Australia", "Brazil"],
    correct: 2,
    category: "Geography",
  },
  {
    question: "What is the fastest land animal?",
    options: ["Lion", "Gazelle", "Cheetah", "Pronghorn"],
    correct: 2,
    category: "Science",
  },
  {
    question: "Who painted the Mona Lisa?",
    options: ["Michelangelo", "Leonardo da Vinci", "Raphael", "Donatello"],
    correct: 1,
    category: "Art",
  },
];

interface PowerUpState {
  type: "hint" | "skip" | "timeBoost" | null;
  available: number;
}

export default function TriviaGameEnhanced({
  gameConfig,
  onGameComplete,
  onGameFail,
}: GameProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [gameActive, setGameActive] = useState(false);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);
  const [pointMultiplier, setPointMultiplier] = useState(1);
  const [powerUps, setPowerUps] = useState<PowerUpState>({
    type: null,
    available: 2,
  });
  const [hintUsed, setHintUsed] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const question = QUESTIONS[currentQuestion];
  const totalQuestions = QUESTIONS.length;
  const timePercentage = (timeLeft / 20) * 100;
  const timeColor = timeLeft > 10 ? "#4ade80" : timeLeft > 5 ? "#f59e0b" : "#ef4444";

  // Timer
  useEffect(() => {
    if (!gameActive || answered || !gameStarted) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameActive, answered]);

  const gameStarted = questionsAnswered === 0 && !answered;

  const handleTimeUp = () => {
    if (!answered) {
      setSelectedAnswer(-1); // Invalid selection
      setAnswered(true);
      setStreak(0);
    }
  };

  const handleAnswerClick = (index: number) => {
    if (answered) return;

    setSelectedAnswer(index);
    setAnswered(true);

    const isCorrect = index === question.correct;
    if (isCorrect) {
      // Time bonus
      const timeBonus = Math.floor(timeLeft * 2);
      const basePoints = 10;
      const earnedPoints = (basePoints + timeBonus) * pointMultiplier;
      
      setScore((prev) => prev + earnedPoints);
      setStreak((prev) => prev + 1);
      
      // Update max streak
      setMaxStreak((prev) => Math.max(prev, streak + 1));

      // Increase multiplier with streak
      if ((streak + 1) % 3 === 0) {
        setPointMultiplier((prev) => prev + 1);
      }
    } else {
      setStreak(0);
      setPointMultiplier(1);
    }
  };

  const handleNext = () => {
    if (currentQuestion + 1 < totalQuestions) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
      setAnswered(false);
      setQuestionsAnswered(questionsAnswered + 1);
      setTimeLeft(20);
      setHintUsed(false);
      setShowHint(false);
    } else {
      // Quiz complete
      const finalScore = score;
      onGameComplete(finalScore);
      setGameActive(false);
    }
  };

  const handleStart = () => {
    setGameActive(true);
    setTimeLeft(20);
  };

  const handleUseHint = () => {
    if (powerUps.available > 0 && !hintUsed && !answered) {
      setHintUsed(true);
      setShowHint(true);
      setPowerUps((prev) => ({
        ...prev,
        available: prev.available - 1,
      }));
    }
  };

  const handleSkipQuestion = () => {
    if (powerUps.available > 0 && !answered) {
      setPowerUps((prev) => ({
        ...prev,
        available: prev.available - 1,
      }));
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
      setAnswered(false);
      setQuestionsAnswered(questionsAnswered + 1);
      setTimeLeft(20);
      setHintUsed(false);
      setShowHint(false);
    }
  };

  const isCorrect = selectedAnswer === question.correct;
  const progress = ((questionsAnswered + (answered ? 1 : 0)) / totalQuestions) * 100;

  // Generate hint
  const getHint = () => {
    const correctAnswer = question.options[question.correct];
    const firstLetter = correctAnswer.charAt(0);
    const length = correctAnswer.length;
    return `${firstLetter}${"_".repeat(length - 1)} (${length} letters)`;
  };

  return (
    <div className="w-full max-w-2xl">
      {/* Start Screen */}
      {!gameActive && (
        <div
          className="rounded-2xl p-12 text-center shadow-2xl border border-purple-400/30"
          style={{
            background: "linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%)",
          }}
        >
          <h2 className="text-4xl font-bold text-purple-400 mb-2">TRIVIA MASTER</h2>
          <p className="text-cyan-400 text-sm mb-4 uppercase tracking-widest">
            Test Your Knowledge
          </p>
          <p className="text-gray-300 mb-2">Answer {totalQuestions} questions</p>
          <p className="text-gray-400 text-sm mb-8">
            ⏱️ 20 seconds per question | Bonuses for speed
          </p>
          <p className="text-gray-400 text-sm mb-8">
            🏆 Build streaks for multiplier rewards
          </p>
          <button
            onClick={handleStart}
            className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-lg hover:from-purple-400 hover:to-pink-400 transition-all text-lg uppercase tracking-widest"
          >
            START QUIZ
          </button>
        </div>
      )}

      {/* Quiz Container */}
      {gameActive && (
        <div
          className="rounded-2xl p-8 shadow-2xl border border-purple-400/30"
          style={{
            background: "linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%)",
          }}
        >
          {/* HUD Top Bar */}
          <div
            className="mb-8 p-4 rounded-lg border border-cyan-400/30"
            style={{ background: "rgba(56, 189, 248, 0.05)" }}
          >
            <div className="flex justify-between items-center gap-4">
              <div className="flex-1">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Score</p>
                <p className="text-2xl font-bold text-purple-400">{score}</p>
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Streak</p>
                <p className="text-2xl font-bold text-green-400">
                  {streak}x
                  {streak > 2 && " 🔥"}
                </p>
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Multiplier</p>
                <p className="text-2xl font-bold text-amber-400">x{pointMultiplier}</p>
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Power-ups</p>
                <p className="text-2xl font-bold text-pink-400">{powerUps.available}</p>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-gray-400">
                Question {questionsAnswered + 1} of {totalQuestions}
              </span>
              <span className={`text-sm font-bold`} style={{ color: timeColor }}>
                {timeLeft}s
              </span>
            </div>
            <div className="w-full bg-gray-700/50 rounded-full h-2 overflow-hidden border border-purple-400/20 mb-2">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="w-full bg-gray-700/50 rounded-full h-2 overflow-hidden border border-green-400/20">
              <div
                className="h-full bg-green-500 transition-all duration-300"
                style={{ width: `${timePercentage}%` }}
              />
            </div>
          </div>

          {/* Question */}
          <h3 className="text-2xl font-bold text-white mb-2 text-center leading-tight">
            {question.question}
          </h3>
          <p className="text-center text-xs text-gray-500 mb-8 uppercase tracking-widest">
            {question.category}
          </p>

          {/* Hint Display */}
          {showHint && (
            <div
              className="mb-6 p-4 rounded-lg border border-cyan-400/50"
              style={{ background: "rgba(56, 189, 248, 0.1)" }}
            >
              <p className="text-cyan-400 font-mono-arc text-sm">
                💡 Hint: {getHint()}
              </p>
            </div>
          )}

          {/* Options */}
          <div className="grid gap-3 mb-8">
            {question.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswerClick(index)}
                disabled={answered}
                className={`p-4 rounded-lg font-semibold text-left transition-all duration-300 text-lg ${
                  !answered
                    ? "bg-gray-700/50 border border-gray-600 hover:border-purple-400 cursor-pointer hover:bg-gray-700"
                    : selectedAnswer === index
                    ? isCorrect
                      ? "bg-green-500/30 border border-green-500 text-green-300"
                      : "bg-red-500/30 border border-red-500 text-red-300"
                    : index === question.correct
                    ? "bg-green-500/30 border border-green-500 text-green-300"
                    : "bg-gray-700/50 border border-gray-600"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{option}</span>
                  {answered && index === question.correct && (
                    <span className="text-lg">✓</span>
                  )}
                  {answered && selectedAnswer === index && !isCorrect && (
                    <span className="text-lg">✗</span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Power-ups Bar */}
          {!answered && (
            <div className="grid grid-cols-2 gap-3 mb-8">
              <button
                onClick={handleUseHint}
                disabled={hintUsed || powerUps.available === 0}
                className={`py-2 px-4 rounded-lg font-semibold text-xs uppercase tracking-widest transition-all ${
                  hintUsed || powerUps.available === 0
                    ? "bg-gray-700/30 text-gray-600 cursor-not-allowed"
                    : "bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 hover:bg-cyan-500/30"
                }`}
              >
                💡 HINT
              </button>
              <button
                onClick={handleSkipQuestion}
                disabled={powerUps.available === 0}
                className={`py-2 px-4 rounded-lg font-semibold text-xs uppercase tracking-widest transition-all ${
                  powerUps.available === 0
                    ? "bg-gray-700/30 text-gray-600 cursor-not-allowed"
                    : "bg-pink-500/20 border border-pink-400/50 text-pink-300 hover:bg-pink-500/30"
                }`}
              >
                ⊘ SKIP
              </button>
            </div>
          )}

          {/* Feedback & Next Button */}
          {answered && (
            <div className="space-y-4">
              <div
                className={`p-4 rounded-lg text-center font-semibold ${
                  isCorrect
                    ? "bg-green-500/20 border border-green-500 text-green-300"
                    : "bg-red-500/20 border border-red-500 text-red-300"
                }`}
              >
                {isCorrect ? (
                  <div>
                    <p className="text-xl">🎉 CORRECT!</p>
                    <p className="text-sm mt-1">
                      +{(10 + Math.floor(timeLeft * 2)) * pointMultiplier} points
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xl">❌ INCORRECT</p>
                    <p className="text-sm mt-1">Correct answer: {question.options[question.correct]}</p>
                  </div>
                )}
              </div>
              <button
                onClick={handleNext}
                className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-lg hover:from-purple-400 hover:to-pink-400 transition-all uppercase tracking-widest"
              >
                {currentQuestion + 1 === totalQuestions ? "FINISH QUIZ" : "NEXT QUESTION"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}