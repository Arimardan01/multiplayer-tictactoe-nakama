// ============================================================================
// InitModule: Entry point for the Nakama TypeScript runtime
// Registers all RPCs, match handler, and creates the leaderboard
// ============================================================================

const rpcIdFindMatch = 'find_match';
const rpcIdGetLeaderboard = 'get_leaderboard';

function InitModule(
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    initializer: nkruntime.Initializer
) {
    // Create the global leaderboard (idempotent - safe to call on every startup)
    try {
        nk.leaderboardCreate(
            LEADERBOARD_ID,   // id
            true,             // authoritative (only server writes)
            nkruntime.SortOrder.DESCENDING,
            nkruntime.Operator.INCREMENTAL,
            undefined,        // no reset schedule (persistent)
            undefined,        // no metadata
        );
        logger.info('Leaderboard created/verified: %s', LEADERBOARD_ID);
    } catch (error) {
        logger.error('Error creating leaderboard: %v', error);
    }

    // Register RPC functions
    initializer.registerRpc(rpcIdFindMatch, rpcFindMatch);
    initializer.registerRpc(rpcIdGetLeaderboard, rpcGetLeaderboard);

    // Register authoritative match handler
    initializer.registerMatch(moduleName, {
        matchInit,
        matchJoinAttempt,
        matchJoin,
        matchLeave,
        matchLoop,
        matchTerminate,
        matchSignal,
    });

    logger.info('Tic-Tac-Toe module loaded successfully.');
}
