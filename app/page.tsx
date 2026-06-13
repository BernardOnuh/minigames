'use client'

import { useState } from 'react'
import { Play, Zap, Flame, Trophy } from 'lucide-react'
import Link from 'next/link'

export default function Home() {
  const [playerName, setPlayerName] = useState('')
  const [showNameInput, setShowNameInput] = useState(false)

  const handleStartGame = (e: React.FormEvent) => {
    e.preventDefault()
    if (playerName.trim()) {
      // Store player name in localStorage for use in the game
      localStorage.setItem('minipay_player_name', playerName)
      // Redirect to game hub
      window.location.href = '/game-hub'
    }
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-950 via-blue-950 to-gray-950 flex flex-col items-center justify-center px-4 py-8">
      {/* Background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-pulse" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 mb-4">
            <Flame className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
            Minipay
          </h1>
          <p className="text-gray-400 text-sm">Compete. Win. Dominate.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-lg p-3 text-center">
            <Zap className="w-5 h-5 text-blue-400 mx-auto mb-1" />
            <p className="text-xs text-gray-400">15 Games</p>
          </div>
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-lg p-3 text-center">
            <Trophy className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
            <p className="text-xs text-gray-400">Leaderboards</p>
          </div>
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-lg p-3 text-center">
            <Play className="w-5 h-5 text-green-400 mx-auto mb-1" />
            <p className="text-xs text-gray-400">Multiplayer</p>
          </div>
        </div>

        {/* Features */}
        <div className="space-y-3 mb-8">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center mt-0.5">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
            </div>
            <p className="text-sm text-gray-300">
              <span className="font-semibold">Quick Reflex Games</span> - Test your speed and accuracy
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center mt-0.5">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
            </div>
            <p className="text-sm text-gray-300">
              <span className="font-semibold">Real-Time Multiplayer</span> - Challenge friends and players worldwide
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center mt-0.5">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
            </div>
            <p className="text-sm text-gray-300">
              <span className="font-semibold">Global Rankings</span> - Climb the leaderboards and prove you're the best
            </p>
          </div>
        </div>

        {/* CTA Button or Name Input */}
        {!showNameInput ? (
          <button
            onClick={() => setShowNameInput(true)}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-lg mb-3 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Play className="w-5 h-5" />
            Play Now
          </button>
        ) : (
          <form onSubmit={handleStartGame} className="space-y-3 mb-3">
            <input
              type="text"
              placeholder="Enter your player name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={20}
              autoFocus
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            <button
              type="submit"
              disabled={!playerName.trim()}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5" />
              Start Playing
            </button>
            <button
              type="button"
              onClick={() => {
                setShowNameInput(false)
                setPlayerName('')
              }}
              className="w-full py-3 px-4 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 font-semibold rounded-lg transition-all"
            >
              Cancel
            </button>
          </form>
        )}

        {/* Bottom Info */}
        <div className="text-center text-xs text-gray-500 mt-8">
          <p>Optimized for mobile • Best experience on iPhone or Android</p>
        </div>
      </div>
    </div>
  )
}