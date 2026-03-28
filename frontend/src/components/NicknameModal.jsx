import React, { useState } from 'react';

export default function NicknameModal({ onSubmit }) {
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nickname.trim() || loading) return;
    setLoading(true);
    try {
      await onSubmit(nickname.trim());
    } catch (err) {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card nickname-modal fade-in" style={{ position: 'relative' }}>
      <h1 className="title">Who are you?</h1>
      <p className="subtitle">Enter a nickname to start playing</p>

      <form className="nickname-form" onSubmit={handleSubmit}>
        <input
          id="nickname-input"
          className="input-field"
          type="text"
          placeholder="Nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={20}
          autoFocus
          autoComplete="off"
        />
        <button
          id="nickname-submit"
          className="btn btn-primary"
          type="submit"
          disabled={!nickname.trim() || loading}
        >
          {loading ? 'Connecting...' : 'Continue'}
        </button>
      </form>
    </div>
  );
}
