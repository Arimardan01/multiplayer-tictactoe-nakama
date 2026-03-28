// ============================================================================
// Shared types, enums, and constants for the Tic-Tac-Toe server module
// ============================================================================

enum Mark {
    UNDEFINED = 0,
    X = 1,
    O = 2,
}

// Communication opcodes between clients and server
enum OpCode {
    START = 1,          // New game round starting
    UPDATE = 2,         // State update during ongoing round
    DONE = 3,           // Game round completed
    MOVE = 4,           // Player's move (client -> server)
    REJECTED = 5,       // Move was rejected
    OPPONENT_LEFT = 6,  // Opponent disconnected
}

type BoardPosition = 0|1|2|3|4|5|6|7|8
type Board = (Mark|null)[]
type Message = StartMessage | UpdateMessage | DoneMessage | MoveMessage

interface MatchLabel {
    open: number
    fast: number
}

// Server -> Client: new game round
interface StartMessage {
    board: Board
    marks: {[userID: string]: Mark | null}
    mark: Mark
    deadline: number
    players: {userId: string, username: string}[]
}

// Server -> Client: state update after valid move
interface UpdateMessage {
    board: Board
    mark: Mark
    deadline: number
}

// Server -> Client: game over
interface DoneMessage {
    board: Board
    winner: Mark | null
    winnerPositions: BoardPosition[] | null
    nextGameStart: number
    winnerUserId: string | null
    reason: string
}

// Client -> Server: player makes a move
interface MoveMessage {
    position: BoardPosition
}

// RPC request/response types
interface RpcFindMatchRequest {
    fast: boolean
}

interface RpcFindMatchResponse {
    matchIds: string[]
}

interface RpcLeaderboardResponse {
    records: LeaderboardRecord[]
}

interface LeaderboardRecord {
    userId: string
    username: string
    score: number
    wins: number
    losses: number
    draws: number
    streak: number
}

interface PlayerStats {
    wins: number
    losses: number
    draws: number
    currentStreak: number
    bestStreak: number
    totalScore: number
}
