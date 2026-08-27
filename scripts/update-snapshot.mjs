import fs from "node:fs/promises";

const LEAGUE_ID = "1395682393989328896";
const USERNAME = "beaveruwe";
const BASE = "https://api.sleeper.app/v1";

async function sleeper(path) {
  const response = await fetch(`${BASE}${path}`, {
    headers: {
      "user-agent": "barmstedt-beavers-snapshot/2.1",
    },
  });

  if (!response.ok) {
    throw new Error(`Sleeper API error ${response.status}: ${path}`);
  }

  return response.json();
}

function ownerMap(users) {
  return Object.fromEntries(
    users.map((user) => [user.user_id, user])
  );
}

function normalizePlayer(playerId, playersById) {
  if (!playerId) return null;

  // Team defenses use IDs like "HOU".
  if (!playersById[playerId]) {
    return {
      player_id: playerId,
      full_name: playerId,
      first_name: null,
      last_name: null,
      position: "DEF",
      fantasy_positions: ["DEF"],
      team: playerId,
      status: "Active",
      injury_status: null,
      injury_notes: null,
      depth_chart_position: null,
      depth_chart_order: null,
      years_exp: null,
      age: null,
      search_rank: null,
    };
  }

  const p = playersById[playerId];

  return {
    player_id: playerId,
    full_name:
      p.full_name ||
      [p.first_name, p.last_name].filter(Boolean).join(" ") ||
      playerId,
    first_name: p.first_name || null,
    last_name: p.last_name || null,
    position: p.position || null,
    fantasy_positions: p.fantasy_positions || [],
    team: p.team || null,
    status: p.status || null,
    injury_status: p.injury_status || null,
    injury_notes: p.injury_notes || null,
    depth_chart_position: p.depth_chart_position || null,
    depth_chart_order: p.depth_chart_order ?? null,
    years_exp: p.years_exp ?? null,
    age: p.age ?? null,
    search_rank:
      Number.isFinite(p.search_rank) ? p.search_rank : null,
  };
}

function rosterView(roster, usersById, playersById) {
  const user = usersById[roster.owner_id] || {};

  const playerIds = roster.players || [];
  const starterIds = roster.starters || [];
  const reserveIds = roster.reserve || [];

  return {
    roster_id: roster.roster_id,
    owner_id: roster.owner_id,
    username: user.username || null,
    display_name: user.display_name || null,
    team_name: user.metadata?.team_name || null,

    starter_ids: starterIds,
    player_ids: playerIds,
    reserve_ids: reserveIds,

    starters: starterIds
      .filter((id) => id && id !== "0")
      .map((id) => normalizePlayer(id, playersById)),

    players: playerIds.map((id) =>
      normalizePlayer(id, playersById)
    ),

    reserve: reserveIds.map((id) =>
      normalizePlayer(id, playersById)
    ),

    settings: roster.settings || {},
  };
}

function isFantasyRelevant(player) {
  if (!player) return false;

  const relevantPositions = new Set([
    "QB",
    "RB",
    "WR",
    "TE",
    "K",
  ]);

  if (!relevantPositions.has(player.position)) {
    return false;
  }

  const allowedStatuses = new Set([
    "Active",
    "Inactive",
    "Injured Reserve",
    "Physically Unable to Perform",
    "Non Football Injury",
    null,
  ]);

  return allowedStatuses.has(player.status ?? null);
}

function buildFreeAgents(rosters, playersById) {
  const rosteredIds = new Set();

  for (const roster of rosters) {
    for (const id of roster.players || []) {
      rosteredIds.add(id);
    }
  }

  return Object.entries(playersById)
    .filter(([playerId, player]) => {
      return (
        !rosteredIds.has(playerId) &&
        isFantasyRelevant(player) &&
        player.team
      );
    })
    .map(([playerId, player]) => ({
      ...normalizePlayer(playerId, playersById),
      search_rank:
        Number.isFinite(player.search_rank)
          ? player.search_rank
          : 999999,
    }))
    .sort((a, b) => {
      if (a.search_rank !== b.search_rank) {
        return a.search_rank - b.search_rank;
      }

      return (a.full_name || "").localeCompare(
        b.full_name || ""
      );
    })
    .slice(0, 300);
}

function enrichTransactions(transactions, playersById) {
  return transactions.map((transaction) => {
    const adds = transaction.adds || {};
    const drops = transaction.drops || {};

    return {
      ...transaction,

      added_players: Object.entries(adds).map(
        ([playerId, rosterId]) => ({
          roster_id: rosterId,
          player: normalizePlayer(playerId, playersById),
        })
      ),

      dropped_players: Object.entries(drops).map(
        ([playerId, rosterId]) => ({
          roster_id: rosterId,
          player: normalizePlayer(playerId, playersById),
        })
      ),
    };
  });
}

async function main() {
  const [
    league,
    rosters,
    users,
    profile,
    nflState,
    tradedPicks,
    playersById,
  ] = await Promise.all([
    sleeper(`/league/${LEAGUE_ID}`),
    sleeper(`/league/${LEAGUE_ID}/rosters`),
    sleeper(`/league/${LEAGUE_ID}/users`),
    sleeper(`/user/${USERNAME}`),
    sleeper("/state/nfl"),
    sleeper(`/league/${LEAGUE_ID}/traded_picks`),
    sleeper("/players/nfl"),
  ]);

  const week =
    nflState.season_type === "regular"
      ? Number(nflState.week)
      : 1;

  const [matchups, transactions] = await Promise.all([
    sleeper(`/league/${LEAGUE_ID}/matchups/${week}`),
    sleeper(`/league/${LEAGUE_ID}/transactions/${week}`),
  ]);

  const usersById = ownerMap(users);

  const rosterViews = rosters.map((roster) =>
    rosterView(roster, usersById, playersById)
  );

  const myRoster =
    rosterViews.find(
      (roster) => roster.owner_id === profile.user_id
    ) || null;

  const freeAgents = buildFreeAgents(
    rosters,
    playersById
  );

  const snapshot = {
    generated_at: new Date().toISOString(),
    snapshot_version: 2,
    week,

    league,

    nfl_state: nflState,

    me: {
      user_id: profile.user_id,
      username: profile.username,
      display_name: profile.display_name,
    },

    my_roster: myRoster,

    rosters: rosterViews,

    matchups,

    transactions: enrichTransactions(
      transactions,
      playersById
    ),

    traded_picks: tradedPicks,

    free_agents: freeAgents,

    metadata: {
      total_rosters: rosterViews.length,
      total_free_agents: freeAgents.length,
      player_directory_size:
        Object.keys(playersById).length,
    },
  };

  await fs.writeFile(
    "snapshot.json",
    JSON.stringify(snapshot, null, 2) + "\n",
    "utf8"
  );

  console.log(
    [
      "Snapshot written",
      `week=${week}`,
      `rosters=${rosterViews.length}`,
      `transactions=${transactions.length}`,
      `free_agents=${freeAgents.length}`,
      `players=${Object.keys(playersById).length}`,
    ].join(" | ")
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});