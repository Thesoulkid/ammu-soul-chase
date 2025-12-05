import React, { useState, useEffect } from 'react';
import GameScene from './components/GameScene';
import { GameState } from './types';
import { getGameSummary } from './services/geminiService';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    isPlaying: false,
    isGameOver: false,
    score: 0,
    hearts: 0,
    speed: 10,
    obstaclesHit: [],
  });
  
  const [summary, setSummary] = useState<string>("");
  const [loadingSummary, setLoadingSummary] = useState(false);

  const startGame = () => {
    setGameState({
      isPlaying: true,
      isGameOver: false,
      score: 0,
      hearts: 0,
      speed: 10,
      obstaclesHit: [],
    });
    setSummary("");
  };

  const handleGameOver = async (finalState: GameState) => {
    setGameState((prev) => ({ ...prev, isGameOver: true, isPlaying: false }));
    setLoadingSummary(true);
    const result = await getGameSummary(finalState.hearts, finalState.obstaclesHit);
    setSummary(result || "Better luck next time!");
    setLoadingSummary(false);
  };

  return (
    <div className="relative w-full h-full bg-slate-900">
      {/* 3D Scene */}
      <GameScene gameState={gameState} setGameState={setGameState} onGameOver={handleGameOver} />

      {/* UI Overlay */}
      <div className="absolute inset-0 pointer-events-none">
        
        {/* HUD */}
        {gameState.isPlaying && !gameState.isGameOver && (
          <div className="absolute top-4 left-4 right-4 flex justify-between text-white font-bold text-xl drop-shadow-md">
            <div className="flex items-center gap-2">
              <span className="text-red-500 text-3xl">❤</span> {gameState.hearts}
            </div>
            <div>Score: {Math.floor(gameState.score)}</div>
          </div>
        )}

        {/* Start Screen */}
        {!gameState.isPlaying && !gameState.isGameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 pointer-events-auto backdrop-blur-sm">
            <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-500 mb-2">
              AMMU & SOUL
            </h1>
            <p className="text-white text-lg mb-8">The Endless Chase</p>
            <div className="bg-white/10 p-6 rounded-xl border border-white/20 mb-8 max-w-md text-center">
              <p className="text-gray-300 mb-2">Swipe or use Arrow Keys to move.</p>
              <p className="text-gray-300">Avoid <b>Family Problems</b> & <b>Ego</b>.</p>
              <p className="text-gray-300">Collect <span className="text-red-400">❤</span> for Ammu!</p>
            </div>
            <button 
              onClick={startGame}
              className="px-8 py-3 bg-gradient-to-r from-pink-500 to-rose-600 text-white font-bold rounded-full text-xl hover:scale-105 transition transform shadow-lg shadow-pink-500/50"
            >
              Start Running
            </button>
          </div>
        )}

        {/* Game Over Screen */}
        {gameState.isGameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 pointer-events-auto backdrop-blur-md p-6">
            <h2 className="text-5xl font-bold text-white mb-4">Game Over</h2>
            
            <div className="flex gap-8 mb-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-red-500">{gameState.hearts}</div>
                <div className="text-gray-400 text-sm">Hearts Collected</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-400">{Math.floor(gameState.score)}</div>
                <div className="text-gray-400 text-sm">Distance Run</div>
              </div>
            </div>

            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 max-w-lg w-full mb-8 min-h-[120px] flex items-center justify-center">
              {loadingSummary ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-gray-400 text-sm">Asking Relationship Counselor AI...</span>
                </div>
              ) : (
                <p className="text-pink-100 italic text-center text-lg leading-relaxed">
                  "{summary}"
                </p>
              )}
            </div>

            <button 
              onClick={startGame}
              className="px-8 py-3 bg-white text-slate-900 font-bold rounded-full text-xl hover:bg-gray-200 transition transform"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
