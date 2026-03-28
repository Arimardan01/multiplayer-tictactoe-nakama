import React from 'react';

export default function Leaderboard({ records, userId }) {
  if (!records || records.length === 0) {
    return (
      <div className="leaderboard">
        <div className="leaderboard-title">
          <span className="leaderboard-icon">🏆</span>
          Leaderboard
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
          No records yet. Play a game to get on the board!
        </p>
      </div>
    );
  }

  return (
    <div className="leaderboard">
      <div className="leaderboard-title">
        <span className="leaderboard-icon">🏆</span>
        Leaderboard
      </div>

      <table className="leaderboard-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th>W/L/D</th>
            <th>🔥</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record, index) => (
            <tr
              key={record.userId}
              className={record.userId === userId ? 'is-you' : ''}
            >
              <td>
                <span className="leaderboard-rank">
                  {index + 1}.
                </span>
              </td>
              <td>
                <span className="leaderboard-name">
                  {record.username}
                  {record.userId === userId && ' (you)'}
                </span>
              </td>
              <td className="leaderboard-wld">
                <span className="win">{record.wins}</span>
                <span className="sep">/</span>
                <span className="loss">{record.losses}</span>
                <span className="sep">/</span>
                <span className="draw">{record.draws}</span>
              </td>
              <td className="leaderboard-streak">
                {record.streak > 0 ? `${record.streak}` : '-'}
              </td>
              <td className="leaderboard-score">
                {record.score}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
