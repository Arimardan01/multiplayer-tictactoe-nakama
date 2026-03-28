import React, { useState, useEffect, useRef } from 'react';

export default function Matchmaking({ onCancel, onMatchFound, socket, session }) {
  const [mode, setMode] = useState('classic'); // 'classic' or 'timed'
  const [searching, setSearching] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (searching) {
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [searching]);

  const handleFindMatch = async () => {
    setSearching(true);
    setElapsed(0);

    try {
      const isFast = mode === 'timed';

      // Call the find_match RPC to find or create a match
      const response = await socket.rpc('find_match', JSON.stringify({ fast: isFast }));
      const data = JSON.parse(response.payload);

      if (data.matchIds && data.matchIds.length > 0) {
        const matchId = data.matchIds[0];
        const match = await socket.joinMatch(matchId);
        onMatchFound(match, isFast);
      }
    } catch (err) {
      console.error('Error finding match:', err);
      setSearching(false);
    }
  };

  const handleCancel = () => {
    setSearching(false);
    setElapsed(0);
    if (timerRef.current) clearInterval(timerRef.current);
    onCancel();
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (searching) {
    return (
      <div className="glass-card matchmaking slide-up">
        <div className="spinner"></div>
        <h2 className="title">Finding a random player<span className="waiting-dots"></span></h2>
        <p className="subtitle">It usually takes 26 seconds</p>
        <div className="search-timer">{formatTime(elapsed)}</div>
        <button id="cancel-search" className="btn btn-danger btn-sm" onClick={handleCancel}>
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="glass-card fade-in" style={{ textAlign: 'center' }}>
      <div className="status-badge connected">
        <span className="dot"></span>
        Connected
      </div>

      <h2 className="title" style={{ fontSize: '1.6rem', marginBottom: '4px' }}>
        Tic-Tac-Toe
      </h2>
      <p className="subtitle">Choose a game mode and find a match</p>

      <div className="mode-selector">
        <button
          id="mode-classic"
          className={`mode-btn ${mode === 'classic' ? 'active' : ''}`}
          onClick={() => setMode('classic')}
        >
          <span className="mode-label">⚡ Classic</span>
          <span className="mode-desc">No time limit</span>
        </button>
        <button
          id="mode-timed"
          className={`mode-btn ${mode === 'timed' ? 'active' : ''}`}
          onClick={() => setMode('timed')}
        >
          <span className="mode-label">⏱️ Timed</span>
          <span className="mode-desc">30s per turn</span>
        </button>
      </div>

      <button id="find-match" className="btn btn-primary" onClick={handleFindMatch}>
        Find Match
      </button>
    </div>
  );
}
