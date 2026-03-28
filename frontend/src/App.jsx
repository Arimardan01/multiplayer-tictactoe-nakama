import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createNakamaClient, authenticate, connectSocket, OpCode } from './nakamaClient';
import NicknameModal from './components/NicknameModal';
import Matchmaking from './components/Matchmaking';
import GameBoard from './components/GameBoard';
import GameResult from './components/GameResult';

// Screens: NICKNAME -> LOBBY -> MATCHMAKING -> PLAYING -> GAME_OVER
const SCREENS = {
  NICKNAME: 'NICKNAME',
  LOBBY: 'LOBBY',
  PLAYING: 'PLAYING',
  GAME_OVER: 'GAME_OVER',
};

export default function App() {
  // Connection state
  const [client, setClient] = useState(null);
  const [session, setSession] = useState(null);
  const [socket, setSocket] = useState(null);
  const [userId, setUserId] = useState(null);
  const [username, setUsername] = useState('');

  // Screen state
  const [screen, setScreen] = useState(SCREENS.NICKNAME);
  const [error, setError] = useState(null);

  // Game state
  const [matchId, setMatchId] = useState(null);
  const [board, setBoard] = useState(Array(9).fill(null));
  const [marks, setMarks] = useState({});
  const [currentMark, setCurrentMark] = useState(0);
  const [players, setPlayers] = useState([]);
  const [deadline, setDeadline] = useState(null);
  const [isFastMode, setIsFastMode] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [winnerPositions, setWinnerPositions] = useState(null);

  // Game result
  const [result, setResult] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);

  // Refs for socket event handlers
  const socketRef = useRef(null);
  const matchIdRef = useRef(null);

  // Keep refs in sync
  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  useEffect(() => {
    matchIdRef.current = matchId;
  }, [matchId]);

  // Error auto-dismiss
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // ----- Handle Nickname Submit -----
  const handleNicknameSubmit = async (name) => {
    try {
      const nakamaClient = createNakamaClient();
      const sess = await authenticate(nakamaClient, name);
      const sock = await connectSocket(nakamaClient, sess);

      setClient(nakamaClient);
      setSession(sess);
      setSocket(sock);
      setUserId(sess.user_id);
      setUsername(name);

      // Setup socket event handlers
      setupSocketHandlers(sock);

      setScreen(SCREENS.LOBBY);
    } catch (err) {
      console.error('Connection error:', err);
      setError('Failed to connect to server. Make sure Nakama is running.');
      throw err;
    }
  };

  // ----- Socket Event Handlers -----
  const setupSocketHandlers = (sock) => {
    sock.onmatchdata = (matchData) => {
      const opCode = matchData.op_code;
      let payload = {};

      if (matchData.data) {
        try {
          const decoded = new TextDecoder().decode(matchData.data);
          payload = JSON.parse(decoded);
        } catch (e) {
          console.warn('Failed to parse match data:', e);
          return;
        }
      }

      switch (opCode) {
        case OpCode.START:
          handleGameStart(payload);
          break;
        case OpCode.UPDATE:
          handleGameUpdate(payload);
          break;
        case OpCode.DONE:
          handleGameDone(payload, sock);
          break;
        case OpCode.REJECTED:
          setError('Move rejected by server');
          break;
        case OpCode.OPPONENT_LEFT:
          setError('Opponent has left the game');
          break;
        default:
          console.log('Unknown opCode:', opCode);
      }
    };

    sock.onmatchpresence = (presenceEvent) => {
      if (presenceEvent.leaves) {
        for (const leave of presenceEvent.leaves) {
          console.log('Player left:', leave.username);
        }
      }
    };

    sock.ondisconnect = () => {
      console.log('Disconnected from server');
      setError('Disconnected from server');
    };
  };

  // ----- Game Event Handlers -----
  const handleGameStart = (payload) => {
    setBoard(payload.board.map(v => v === 0 ? null : v));
    setMarks(payload.marks);
    setCurrentMark(payload.mark);
    setDeadline(payload.deadline || null);
    setGameOver(false);
    setWinnerPositions(null);
    setResult(null);

    if (payload.players) {
      setPlayers(payload.players);
    }

    setScreen(SCREENS.PLAYING);
  };

  const handleGameUpdate = (payload) => {
    setBoard(payload.board.map(v => v === 0 ? null : v));
    setCurrentMark(payload.mark);
    setDeadline(payload.deadline || null);
  };

  const handleGameDone = async (payload, sock) => {
    setBoard(payload.board.map(v => v === 0 ? null : v));
    setGameOver(true);
    setWinnerPositions(payload.winnerPositions || null);

    setResult({
      winner: payload.winner,
      winnerUserId: payload.winnerUserId || null,
      reason: payload.reason || 'win',
    });

    // Fetch leaderboard
    try {
      const response = await sock.rpc('get_leaderboard', '{}');
      const data = JSON.parse(response.payload);
      setLeaderboard(data.records || []);
    } catch (e) {
      console.warn('Failed to fetch leaderboard:', e);
    }

    // Short delay then show result screen
    setTimeout(() => {
      setScreen(SCREENS.GAME_OVER);
    }, 1500);
  };

  // ----- Actions -----
  const handleMove = (position) => {
    if (!socket || !matchId) return;
    socket.sendMatchState(matchId, OpCode.MOVE, JSON.stringify({ position }));
  };

  const handleMatchFound = (match, fastMode) => {
    setMatchId(match.match_id);
    setIsFastMode(fastMode);
    setGameOver(false);
    setResult(null);
    setWinnerPositions(null);
    setBoard(Array(9).fill(null));

    // Extract player info from match presences
    if (match.presences) {
      setPlayers(match.presences.map(p => ({
        userId: p.user_id,
        username: p.username,
      })));
    }

    // Stay on lobby until we get a START message from server
    // The server will send START when both players have joined
  };

  const handlePlayAgain = async () => {
    // Leave current match
    if (socket && matchId) {
      try {
        await socket.leaveMatch(matchId);
      } catch (e) {
        // Ignore leave errors
      }
    }

    // Reset game state
    setMatchId(null);
    setBoard(Array(9).fill(null));
    setMarks({});
    setCurrentMark(0);
    setPlayers([]);
    setDeadline(null);
    setGameOver(false);
    setWinnerPositions(null);
    setResult(null);
    setScreen(SCREENS.LOBBY);
  };

  const handleBackToLobby = async () => {
    // Leave current match
    if (socket && matchId) {
      try {
        await socket.leaveMatch(matchId);
      } catch (e) {
        // Ignore leave errors
      }
    }

    // Reset all game state
    setMatchId(null);
    setBoard(Array(9).fill(null));
    setMarks({});
    setCurrentMark(0);
    setPlayers([]);
    setDeadline(null);
    setGameOver(false);
    setWinnerPositions(null);
    setResult(null);
    setLeaderboard([]);
    setScreen(SCREENS.LOBBY);
  };

  // ----- Render -----
  return (
    <div className="app-container">
      {screen === SCREENS.NICKNAME && (
        <NicknameModal onSubmit={handleNicknameSubmit} />
      )}

      {screen === SCREENS.LOBBY && (
        <Matchmaking
          socket={socket}
          session={session}
          onMatchFound={handleMatchFound}
          onCancel={() => {}}
        />
      )}

      {screen === SCREENS.PLAYING && (
        <GameBoard
          board={board}
          marks={marks}
          currentMark={currentMark}
          players={players}
          userId={userId}
          matchId={matchId}
          deadline={deadline}
          isFastMode={isFastMode}
          onMove={handleMove}
          gameOver={gameOver}
          winnerPositions={winnerPositions}
        />
      )}

      {screen === SCREENS.GAME_OVER && result && (
        <GameResult
          winner={result.winner}
          winnerMark={result.winner}
          winnerUserId={result.winnerUserId}
          userId={userId}
          reason={result.reason}
          leaderboard={leaderboard}
          onPlayAgain={handlePlayAgain}
          onBackToLobby={handleBackToLobby}
        />
      )}

      {/* Error Toast */}
      {error && <div className="error-toast">{error}</div>}
    </div>
  );
}
