// ============================================================================
// RPC Functions: Match Finding & Leaderboard
// ============================================================================

// RPC: Find or create a match
let rpcFindMatch: nkruntime.RpcFunction = function (
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    payload: string
): string {
    if (!ctx.userId) {
        throw Error('No user ID in context');
    }

    if (!payload) {
        throw Error('Expects payload');
    }

    let request = {} as RpcFindMatchRequest;
    try {
        request = JSON.parse(payload);
    } catch (error) {
        logger.error('Error parsing find_match payload: %q', error);
        throw error;
    }

    // Try to find an existing open match with the same mode
    let matches: nkruntime.Match[];
    try {
        const query = `+label.open:1 +label.fast:${request.fast ? 1 : 0}`;
        matches = nk.matchList(10, true, null, null, 1, query);
    } catch (error) {
        logger.error('Error listing matches: %v', error);
        throw error;
    }

    let matchIds: string[] = [];
    if (matches.length > 0) {
        matchIds = matches.map(m => m.matchId);
    } else {
        // No available matches, create a new one
        try {
            matchIds.push(nk.matchCreate(moduleName, { fast: request.fast }));
        } catch (error) {
            logger.error('Error creating match: %v', error);
            throw error;
        }
    }

    let res: RpcFindMatchResponse = { matchIds };
    return JSON.stringify(res);
};

// RPC: Get leaderboard with player stats
let rpcGetLeaderboard: nkruntime.RpcFunction = function (
    ctx: nkruntime.Context,
    logger: nkruntime.Logger,
    nk: nkruntime.Nakama,
    payload: string
): string {
    let records: LeaderboardRecord[] = [];

    try {
        const result = nk.leaderboardRecordsList(
            LEADERBOARD_ID,
            undefined,
            20,     // limit
            undefined,
            0,      // expiry override
        );

        if (result && result.records) {
            for (const record of result.records) {
                // Read player stats from storage
                let stats: PlayerStats = {
                    wins: 0, losses: 0, draws: 0,
                    currentStreak: 0, bestStreak: 0, totalScore: 0,
                };

                try {
                    const storageResult = nk.storageRead([{
                        collection: STATS_COLLECTION,
                        key: STATS_KEY,
                        userId: record.ownerId,
                    }]);
                    if (storageResult.length > 0) {
                        stats = storageResult[0].value as unknown as PlayerStats;
                    }
                } catch (e) {
                    // Use defaults
                }

                records.push({
                    userId: record.ownerId,
                    username: record.username ?? 'Unknown',
                    score: Number(record.score),
                    wins: stats.wins,
                    losses: stats.losses,
                    draws: stats.draws,
                    streak: stats.currentStreak,
                });
            }
        }
    } catch (error) {
        logger.error('Error reading leaderboard: %v', error);
    }

    let res: RpcLeaderboardResponse = { records };
    return JSON.stringify(res);
};
