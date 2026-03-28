import React from 'react';
import Leaderboard from './Leaderboard';

export default function GameResult({
  winner,
  winnerMark,
  winnerUserId,
  userId,
  reason,
  leaderboard,
  onPlayAgain,
  onBackToLobby,
}) {
  const isWinner = winnerUserId === userId;
  const isDraw = !winnerUserId && (winner === null || winner === 0);

  let resultTitle = '';
  let resultClass = '';
  let points = '';
  let markDisplay = '';

  if (isDraw) {
    resultTitle = 'DRAW!';
    resultClass = 'draw';
    points = '+50 pts';
    markDisplay = '🤝';
  } else if (isWinner) {
    resultTitle = 'WINNER!';
    resultClass = 'win';
    points = '+200 pts';
    markDisplay = winnerMark === 1 ? 'X' : 'O';
  } else {
    resultTitle = 'YOU LOST';
    resultClass = 'lose';
    points = '+0 pts';
    markDisplay = winnerMark === 1 ? 'X' : 'O';
  }

  let reasonText = '';
  if (reason === 'timeout') {
    reasonText = isWinner ? 'Opponent ran out of time!' : 'You ran out of time!';
  }

  return (
    <div className="glass-card game-result slide-up">
      {/* Result Display */}
      <div
        className={`result-mark ${
          isDraw ? '' : winnerMark === 1 ? 'mark-x' : 'mark-o'
        }`}
      >
        {markDisplay}
      </div>

      <h2 className={`result-title ${resultClass}`}>
        {resultTitle}
      </h2>

      <div className="result-points">{points}</div>

      {reasonText && (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
          {reasonText}
        </p>
      )}

      <div className="result-divider" />

      {/* Leaderboard */}
      <Leaderboard records={leaderboard} userId={userId} />

      {/* Actions */}
      <div className="result-actions">
        <button id="play-again" className="btn btn-primary" onClick={onPlayAgain}>
          Play Again
        </button>
        <button id="back-to-lobby" className="btn btn-secondary btn-sm" onClick={onBackToLobby}>
          Back to Lobby
        </button>
      </div>
    </div>
  );
}
