import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;
const LEAGUE_ID = process.env.SLEEPER_LEAGUE_ID || '1395682393989328896';
const USERNAME = (process.env.SLEEPER_USERNAME || 'beaveruwe').replace(/^@/, '');
const BASE = 'https://api.sleeper.app/v1';

app.use(express.json());

async function sleeper(path) {
  const r = await fetch(`${BASE}${path}`, { headers: { 'user-agent': 'sleeper-league-wrapper/1.0' }});
  if (!r.ok) throw new Error(`Sleeper ${r.status}: ${path}`);
  return r.json();
}

function ownerMap(users) {
  return Object.fromEntries(users.map(u => [u.user_id, u]));
}

function rosterView(roster, usersById) {
  const u = usersById[roster.owner_id] || {};
  return {
    roster_id: roster.roster_id,
    owner_id: roster.owner_id,
    username: u.username || null,
    display_name: u.display_name || null,
    team_name: u.metadata?.team_name || null,
    starters: roster.starters || [],
    players: roster.players || [],
    reserve: roster.reserve || [],
    settings: roster.settings || {}
  };
}

app.get('/health', (_req,res) => res.json({ok:true, league_id: LEAGUE_ID, username: USERNAME}));

app.get('/api/league', async (_req,res) => {
  try { res.json(await sleeper(`/league/${LEAGUE_ID}`)); }
  catch (e) { res.status(502).json({error:e.message}); }
});

app.get('/api/rosters', async (_req,res) => {
  try {
    const [rosters, users] = await Promise.all([
      sleeper(`/league/${LEAGUE_ID}/rosters`),
      sleeper(`/league/${LEAGUE_ID}/users`)
    ]);
    const map = ownerMap(users);
    res.json(rosters.map(r => rosterView(r, map)));
  } catch (e) { res.status(502).json({error:e.message}); }
});

app.get('/api/my-team', async (_req,res) => {
  try {
    const [rosters, users, profile] = await Promise.all([
      sleeper(`/league/${LEAGUE_ID}/rosters`),
      sleeper(`/league/${LEAGUE_ID}/users`),
      sleeper(`/user/${USERNAME}`)
    ]);
    const map = ownerMap(users);
    const roster = rosters.find(r => r.owner_id === profile.user_id);
    if (!roster) return res.status(404).json({error:'User not found in league', user_id: profile.user_id});
    res.json({user: profile, roster: rosterView(roster,map)});
  } catch (e) { res.status(502).json({error:e.message}); }
});

app.get('/api/matchups/:week', async (req,res) => {
  try { res.json(await sleeper(`/league/${LEAGUE_ID}/matchups/${req.params.week}`)); }
  catch (e) { res.status(502).json({error:e.message}); }
});

app.get('/api/transactions/:week', async (req,res) => {
  try { res.json(await sleeper(`/league/${LEAGUE_ID}/transactions/${req.params.week}`)); }
  catch (e) { res.status(502).json({error:e.message}); }
});

app.get('/api/snapshot/:week?', async (req,res) => {
  try {
    const week = req.params.week || 1;
    const [league, rosters, users, profile, matchups, transactions, tradedPicks, nflState] = await Promise.all([
      sleeper(`/league/${LEAGUE_ID}`),
      sleeper(`/league/${LEAGUE_ID}/rosters`),
      sleeper(`/league/${LEAGUE_ID}/users`),
      sleeper(`/user/${USERNAME}`),
      sleeper(`/league/${LEAGUE_ID}/matchups/${week}`),
      sleeper(`/league/${LEAGUE_ID}/transactions/${week}`),
      sleeper(`/league/${LEAGUE_ID}/traded_picks`),
      sleeper(`/state/nfl`)
    ]);
    const map = ownerMap(users);
    const views = rosters.map(r => rosterView(r,map));
    const mine = views.find(r => r.owner_id === profile.user_id) || null;
    res.json({generated_at:new Date().toISOString(), week:Number(week), league, nfl_state:nflState, me:profile, my_roster:mine, rosters:views, matchups, transactions, traded_picks:tradedPicks});
  } catch (e) { res.status(502).json({error:e.message}); }
});

app.listen(PORT, () => console.log(`Sleeper wrapper listening on :${PORT}`));
