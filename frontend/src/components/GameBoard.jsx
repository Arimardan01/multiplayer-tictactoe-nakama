import React, { useState, useEffect, useRef } from 'react';

export default function GameBoard({
  board,
  marks,
  currentMark,
  players,
  userId,
  matchId,
  deadline,
  isFastMode,
  onMove,
  gameOver,
  winnerPositions,
}) {
  const [timeLeft, setTimeLeft] = useState(null);
  const timerRef = useRef(null);

  // Get player info
  const myMark = marks ? marks[userId] : null;
  const isMyTurn = currentMark === myMark && !gameOver;

  const opponent = players?.find((p) => p.userId !== userId);
  const me = players?.find((p) => p.userId === userId);

  // Timer countdown
  useEffect(() => {
    if (deadline && !gameOver) {
      const updateTimer = () => {
        const now = Math.floor(Date.now() / 1000);
        const remaining = Math.max(0, deadline - now);
        setTimeLeft(remaining);
      };

      updateTimer();
      timerRef.current = setInterval(updateTimer, 1000);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    } else {
      setTimeLeft(null);
    }
  }, [deadline, gameOver]);

  const handleCellClick = (position) => {
    if (!isMyTurn || gameOver) return;
    if (board[position] !== null) return;
    onMove(position);
  };

  const renderMark = (value) => {
    if (value === null || value === 0) return null;
    const markClass = value === 1 ? 'mark-x' : 'mark-o';
    return <span className={markClass}>{value === 1 ? 'X' : 'O'}</span>;
  };

  const isWinningCell = (index) => {
    if (!winnerPositions) return false;
    return winnerPositions.includes(index);
  };

  return (
    <div className="game-screen slide-up">
      {/* Player Bar */}
      <div className="player-bar">
        <div className="player-info">
          <span className={`player-name ${me ? 'is-you' : ''}`}>
            {me?.username || 'You'}
          </span>
          <span className="player-tag">(you)</span>
        </div>

        <div className="turn-indicator">
          <div className={`turn-mark ${currentMark === 1 ? 'mark-x' : 'mark-o'}`}>
            {currentMark === 1 ? 'X' : 'O'}
          </div>
          <span className="turn-label">
            {gameOver ? 'Game Over' : isMyTurn ? 'Your Turn' : 'Opponent'}
          </span>
        </div>

        <div className="player-info">
          <span className="player-name">
            {opponent?.username || 'Waiting...'}
          </span>
          <span className="player-tag">(opp)</span>
        </div>
      </div>

      {/* Timer */}
      {isFastMode && timeLeft !== null && !gameOver && (
        <div className="game-timer">
          <div className={`timer-value ${timeLeft <= 10 ? 'urgent' : ''}`}>
            {timeLeft}s
          </div>
          <div className="timer-label">
            {isMyTurn ? 'Your time remaining' : "Opponent's time"}
          </div>
        </div>
      )}

      {/* Board */}
      <div className="board-container">
        <div className="board">
          {board.map((cell, index) => (
            <button
              key={index}
              id={`cell-${index}`}
              className={`cell ${cell !== null && cell !== 0 ? 'filled' : ''} ${isWinningCell(index) ? 'winning' : ''}`}
              onClick={() => handleCellClick(index)}
              disabled={!isMyTurn || cell !== null || gameOver}
            >
              {renderMark(cell)}
            </button>
          ))}
        </div>
      </div>

      {/* Match ID */}
      <div className="match-id">
        Match: {matchId?.substring(0, 8)}...
      </div>
    </div>
  );
}
