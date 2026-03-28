// ============================================================================
// Server-Authoritative Tic-Tac-Toe Match Handler
// All game logic runs on the server. Clients send moves, server validates
// and broadcasts state updates. Prevents any client-side cheating.
// ============================================================================

const moduleName = "tic-tac-toe";
const tickRate = 5;
const maxEmptySec = 30;
const delayBetweenGamesSec = 5;
const turnTimeFastSec = 30;
const turnTimeNormalSec = 60;

const LEADERBOARD_ID = "ttt_global_leaderboard";
const STATS_COLLECTION = "player_stats";
const STATS_KEY = "stats";

const winningPositions: number[][] = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
];

interface State {
    label: MatchLabel
    emptyTicks: number
    presences: {[userId: string]: nkruntime.Presence | null}
    joinsInProgress: number
    playing: boolean
    board: Board
    marks: {[userId: string]: Mark | null}
    mark: Mark
    deadlineRemainingTicks: number
    winner: Mark | null
    winnerPositions: BoardPosition[] | null
    nextGameRemainingTicks: number
}

function msecToSec(n: number): number {
    return Math.floor(n / 1000);
}

// ---- Match Init ----
let matchInit: nkruntime.MatchInitFunction<State> = function (
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    params: {[key: string]: string}
) {
    const fast = !!params['fast'];

    let label: MatchLabel = {
        open: 1,
        fast: fast ? 1 : 0,
    };

    let state: State = {
        label: label,
        emptyTicks: 0,
        presences: {},
        joinsInProgress: 0,
        playing: false,
        board: [],
        marks: {},
        mark: Mark.UNDEFINED,
        deadlineRemainingTicks: 0,
        winner: null,
        winnerPositions: null,
        nextGameRemainingTicks: 0,
    };

    logger.info('Match init: tickRate=%d, fast=%t', tickRate, fast);

    return {
        state,
        tickRate,
        label: JSON.stringify(label),
    };
};

// ---- Join Attempt ----
let matchJoinAttempt: nkruntime.MatchJoinAttemptFunction<State> = function (
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    dispatcher: nkruntime.MatchDispatcher,
    tick: number,
    state: State,
    presence: nkruntime.Presence,
    metadata: {[key: string]: any}
) {
    // Allow rejoining after disconnect
    if (presence.userId in state.presences) {
        if (state.presences[presence.userId] === null) {
            state.joinsInProgress++;
            return { state: state, accept: false };
        } else {
            return { state: state, accept: false, rejectMessage: 'already joined' };
        }
    }

    // Check if match is full
    if (connectedPlayers(state) + state.joinsInProgress >= 2) {
        return { state: state, accept: false, rejectMessage: 'match full' };
    }

    state.joinsInProgress++;
    return { state, accept: true };
};

// ---- Join ----
let matchJoin: nkruntime.MatchJoinFunction<State> = function (
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    dispatcher: nkruntime.MatchDispatcher,
    tick: number,
    state: State,
    presences: nkruntime.Presence[]
) {
    const t = msecToSec(Date.now());

    for (const presence of presences) {
        state.emptyTicks = 0;
        state.presences[presence.userId] = presence;
        state.joinsInProgress--;

        // Send current state to reconnecting player
        if (state.playing) {
            let update: UpdateMessage = {
                board: state.board,
                mark: state.mark,
                deadline: t + Math.floor(state.deadlineRemainingTicks / tickRate),
            };
            dispatcher.broadcastMessage(OpCode.UPDATE, JSON.stringify(update));
        } else if (state.board.length !== 0 && Object.keys(state.marks).length !== 0 && state.marks[presence.userId]) {
            let done: DoneMessage = {
                board: state.board,
                winner: state.winner,
                winnerPositions: state.winnerPositions,
                nextGameStart: t + Math.floor(state.nextGameRemainingTicks / tickRate),
                winnerUserId: null,
                reason: 'reconnect',
            };
            dispatcher.broadcastMessage(OpCode.DONE, JSON.stringify(done));
        }
    }

    // Close match to new players when full
    if (Object.keys(state.presences).length >= 2 && state.label.open != 0) {
        state.label.open = 0;
        const labelJSON = JSON.stringify(state.label);
        dispatcher.matchLabelUpdate(labelJSON);
    }

    return { state };
};

// ---- Leave ----
let matchLeave: nkruntime.MatchLeaveFunction<State> = function (
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    dispatcher: nkruntime.MatchDispatcher,
    tick: number,
    state: State,
    presences: nkruntime.Presence[]
) {
    for (let presence of presences) {
        logger.info("Player %s left match %s", presence.userId, ctx.matchId);
        state.presences[presence.userId] = null;
    }

    let remaining: nkruntime.Presence[] = [];
    Object.keys(state.presences).forEach((userId) => {
        if (state.presences[userId] !== null) {
            remaining.push(state.presences[userId]!);
        }
    });

    // Notify remaining player
    if (remaining.length === 1) {
        dispatcher.broadcastMessage(OpCode.OPPONENT_LEFT, null, remaining, null, true);
    }

    return { state };
};

// ---- Main Game Loop ----
let matchLoop: nkruntime.MatchLoopFunction<State> = function (
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    dispatcher: nkruntime.MatchDispatcher,
    tick: number,
    state: State,
    messages: nkruntime.MatchMessage[]
) {
    // Auto-close idle matches
    if (connectedPlayers(state) + state.joinsInProgress === 0) {
        state.emptyTicks++;
        if (state.emptyTicks >= maxEmptySec * tickRate) {
            logger.info('Closing idle match');
            return null;
        }
    }

    let t = msecToSec(Date.now());

    // ---- Between games: manage state ----
    if (!state.playing) {
        // Purge disconnected users between games
        for (let userID in state.presences) {
            if (state.presences[userID] === null) {
                delete state.presences[userID];
            }
        }

        // Re-open match if player left
        if (Object.keys(state.presences).length < 2 && state.label.open != 1) {
            state.label.open = 1;
            dispatcher.matchLabelUpdate(JSON.stringify(state.label));
        }

        // Need 2 players to start
        if (Object.keys(state.presences).length < 2) {
            return { state };
        }

        // Delay between games
        if (state.nextGameRemainingTicks > 0) {
            state.nextGameRemainingTicks--;
            return { state };
        }

        // ==== START NEW GAME ====
        state.playing = true;
        state.board = [null, null, null, null, null, null, null, null, null];
        state.marks = {};
        let marks = [Mark.X, Mark.O];
        Object.keys(state.presences).forEach(userId => {
            state.marks[userId] = marks.shift() ?? null;
        });
        state.mark = Mark.X;
        state.winner = Mark.UNDEFINED;
        state.winnerPositions = null;
        state.deadlineRemainingTicks = calculateDeadlineTicks(state.label);
        state.nextGameRemainingTicks = 0;

        // Build player info for client
        let playerList: {userId: string, username: string}[] = [];
        Object.keys(state.presences).forEach(userId => {
            const p = state.presences[userId];
            if (p) {
                playerList.push({ userId: p.userId, username: p.username });
            }
        });

        let msg: StartMessage = {
            board: state.board,
            marks: state.marks,
            mark: state.mark,
            deadline: t + Math.floor(state.deadlineRemainingTicks / tickRate),
            players: playerList,
        };
        dispatcher.broadcastMessage(OpCode.START, JSON.stringify(msg));

        return { state };
    }

    // ---- In-game: process moves ----
    for (const message of messages) {
        switch (message.opCode) {
            case OpCode.MOVE:
                let mark = state.marks[message.sender.userId] ?? null;
                let sender = [message.sender];

                if (mark === null || state.mark != mark) {
                    dispatcher.broadcastMessage(OpCode.REJECTED, null, sender);
                    continue;
                }

                let moveMsg = {} as MoveMessage;
                try {
                    moveMsg = JSON.parse(nk.binaryToString(message.data));
                } catch (error) {
                    dispatcher.broadcastMessage(OpCode.REJECTED, null, sender);
                    continue;
                }

                if (moveMsg.position < 0 || moveMsg.position > 8 || state.board[moveMsg.position]) {
                    dispatcher.broadcastMessage(OpCode.REJECTED, null, sender);
                    continue;
                }

                // Apply validated move
                state.board[moveMsg.position] = mark;
                state.mark = mark === Mark.O ? Mark.X : Mark.O;
                state.deadlineRemainingTicks = calculateDeadlineTicks(state.label);

                // Check for winner
                const [isWin, winPos] = winCheck(state.board, mark);
                if (isWin) {
                    state.winner = mark;
                    state.winnerPositions = winPos;
                    state.playing = false;
                    state.deadlineRemainingTicks = 0;
                    state.nextGameRemainingTicks = delayBetweenGamesSec * tickRate;

                    // Update stats & leaderboard
                    updatePlayerStats(nk, logger, state);
                }

                // Check for draw
                let isDraw = state.board.every(v => v !== null);
                if (isDraw && state.playing) {
                    state.winner = null;
                    state.playing = false;
                    state.deadlineRemainingTicks = 0;
                    state.nextGameRemainingTicks = delayBetweenGamesSec * tickRate;
                    updatePlayerStats(nk, logger, state);
                }

                // Broadcast result
                if (state.playing) {
                    let updateMsg: UpdateMessage = {
                        board: state.board,
                        mark: state.mark,
                        deadline: t + Math.floor(state.deadlineRemainingTicks / tickRate),
                    };
                    dispatcher.broadcastMessage(OpCode.UPDATE, JSON.stringify(updateMsg));
                } else {
                    // Find winner user ID
                    let winnerUserId: string | null = null;
                    if (state.winner) {
                        for (const uid of Object.keys(state.marks)) {
                            if (state.marks[uid] === state.winner) {
                                winnerUserId = uid;
                                break;
                            }
                        }
                    }

                    let doneMsg: DoneMessage = {
                        board: state.board,
                        winner: state.winner,
                        winnerPositions: state.winnerPositions,
                        nextGameStart: t + Math.floor(state.nextGameRemainingTicks / tickRate),
                        winnerUserId: winnerUserId,
                        reason: isDraw ? 'draw' : 'win',
                    };
                    dispatcher.broadcastMessage(OpCode.DONE, JSON.stringify(doneMsg));
                }
                break;

            default:
                dispatcher.broadcastMessage(OpCode.REJECTED, null, [message.sender]);
        }
    }

    // ---- Timer: forfeit on timeout ----
    if (state.playing) {
        state.deadlineRemainingTicks--;
        if (state.deadlineRemainingTicks <= 0) {
            state.playing = false;
            state.winner = state.mark === Mark.O ? Mark.X : Mark.O;
            state.deadlineRemainingTicks = 0;
            state.nextGameRemainingTicks = delayBetweenGamesSec * tickRate;

            let winnerUserId: string | null = null;
            for (const uid of Object.keys(state.marks)) {
                if (state.marks[uid] === state.winner) {
                    winnerUserId = uid;
                    break;
                }
            }

            updatePlayerStats(nk, logger, state);

            let msg: DoneMessage = {
                board: state.board,
                winner: state.winner,
                winnerPositions: null,
                nextGameStart: t + Math.floor(state.nextGameRemainingTicks / tickRate),
                winnerUserId: winnerUserId,
                reason: 'timeout',
            };
            dispatcher.broadcastMessage(OpCode.DONE, JSON.stringify(msg));
        }
    }

    return { state };
};

// ---- Terminate ----
let matchTerminate: nkruntime.MatchTerminateFunction<State> = function (
    ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama,
    dispatcher: nkruntime.MatchDispatcher, tick: number, state: State, graceSeconds: number
) {
    return { state };
};

// ---- Signal ----
let matchSignal: nkruntime.MatchSignalFunction<State> = function (
    ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama,
    dispatcher: nkruntime.MatchDispatcher, tick: number, state: State
) {
    return { state };
};

// ============================================================================
// Utility Functions
// ============================================================================

function calculateDeadlineTicks(l: MatchLabel): number {
    if (l.fast === 1) {
        return turnTimeFastSec * tickRate;
    }
    return turnTimeNormalSec * tickRate;
}

function winCheck(board: Board, mark: Mark): [boolean, BoardPosition[] | null] {
    for (let wp of winningPositions) {
        if (board[wp[0]] === mark && board[wp[1]] === mark && board[wp[2]] === mark) {
            return [true, wp as BoardPosition[]];
        }
    }
    return [false, null];
}

function connectedPlayers(s: State): number {
    let count = 0;
    for (const p of Object.keys(s.presences)) {
        if (s.presences[p] !== null) count++;
    }
    return count;
}

// ============================================================================
// Leaderboard & Stats Management
// ============================================================================

function updatePlayerStats(
    nk: nkruntime.Nakama,
    logger: nkruntime.Logger,
    state: State
): void {
    const playerIds = Object.keys(state.presences);

    for (const userId of playerIds) {
        const presence = state.presences[userId];
        if (!presence) continue;

        // Read current stats
        let stats: PlayerStats = {
            wins: 0, losses: 0, draws: 0,
            currentStreak: 0, bestStreak: 0, totalScore: 0,
        };

        try {
            const result = nk.storageRead([{
                collection: STATS_COLLECTION,
                key: STATS_KEY,
                userId: userId,
            }]);
            if (result.length > 0) {
                stats = result[0].value as unknown as PlayerStats;
            }
        } catch (e) {
            logger.warn('Error reading stats for %s: %v', userId, e);
        }

        // Determine outcome for this player
        let score = 0;
        if (state.winner === null || state.winner === Mark.UNDEFINED) {
            // Draw
            stats.draws++;
            stats.currentStreak = 0;
            score = 50;
        } else if (state.marks[userId] === state.winner) {
            // Win
            stats.wins++;
            stats.currentStreak++;
            if (stats.currentStreak > stats.bestStreak) {
                stats.bestStreak = stats.currentStreak;
            }
            score = 200;
        } else {
            // Loss
            stats.losses++;
            stats.currentStreak = 0;
        }

        stats.totalScore += score;

        // Persist stats
        try {
            nk.storageWrite([{
                collection: STATS_COLLECTION,
                key: STATS_KEY,
                userId: userId,
                value: stats as unknown as {[key: string]: any},
                permissionRead: 2,  // Public read
                permissionWrite: 0, // Server only
            }]);
        } catch (e) {
            logger.error('Error writing stats for %s: %v', userId, e);
        }

        // Update leaderboard
        try {
            nk.leaderboardRecordWrite(
                LEADERBOARD_ID,
                userId,
                presence.username,
                score,
                0,
                undefined,
                undefined,
            );
        } catch (e) {
            logger.error('Error writing leaderboard for %s: %v', userId, e);
        }
    }
}
