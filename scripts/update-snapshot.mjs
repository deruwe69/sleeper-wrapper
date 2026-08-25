import fs from "node:fs/promises";

const LEAGUE_ID = "1395682393989328896";
const USERNAME = "beaveruwe";
const BASE = "https://api.sleeper.app/v1";

async function sleeper(path) {
  const response = await fetch(`${BASE}${path}`, {
    headers: {
      "user-agent": "barmstedt-beavers-snapshot/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Sleeper API error ${response.status}: ${path}`
    );
  }

  return response.json();
}

function ownerMap(users) {
  return Object.fromEntries(
    users.map((user) => [user.user_id, user])
  );
}

function rosterView(roster, usersById) {
  const user = usersById[roster.owner_id] || {};

  return {
    roster_id: roster.roster_id,
    owner_id: roster.owner_id,
    username: user.username || null,
    display_name: user.display_name || null,
    team_name: user.metadata?.team_name || null,
    starters: roster.starters || [],
    players: roster.players || [],
    reserve: roster.reserve || [],
    settings: roster.settings || {},
  };
}

async function main() {
  const [
    league,
    rosters,
    users,
    profile,
    nflState,
    tradedPicks,
  ] = await Promise.all([
    sleeper(`/league/${LEAGUE_ID}`),
    sleeper(`/league/${LEAGUE_ID}/rosters`),
    sleeper(`/league/${LEAGUE_ID}/users`),
    sleeper(`/user/${USERNAME}`),
    sleeper("/state/nfl"),
    sleeper(`/league/${LEAGUE_ID}/traded_picks`),
  ]);

  /*
   * nflState.week refers to the current real NFL week.
   * Before the regular season we default to Week 1 for
   * league transactions/matchups.
   */
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
    rosterView(roster, usersById)
  );

  const myRoster =
    rosterViews.find(
      (roster) => roster.owner_id === profile.user_id
    ) || null;

  const snapshot = {
    generated_at: new Date().toISOString(),
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
    transactions,
    traded_picks: tradedPicks,
  };

  await fs.writeFile(
    "snapshot.json",
    JSON.stringify(snapshot, null, 2) + "\n",
    "utf8"
  );

  console.log(
    `Snapshot written: week ${week}, ` +
      `${rosterViews.length} rosters, ` +
      `${transactions.length} transactions.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
