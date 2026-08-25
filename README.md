# Sleeper League Wrapper

Tiny read-only wrapper around Sleeper's public API for one fantasy league.

Defaults are preconfigured for:
- League ID: `1395682393989328896`
- Sleeper username: `beaveruwe`

## Run locally
```bash
npm install
npm start
```
Open `http://localhost:3000/health`.

## Useful endpoints
- `/health`
- `/api/league`
- `/api/rosters`
- `/api/my-team`
- `/api/matchups/1`
- `/api/transactions/1`
- `/api/snapshot/1`  ← best endpoint for the Tuesday report

## Deploy
This works on Render, Railway, Fly.io, or any Node host.
Set environment variables if you want to override defaults:
- `SLEEPER_LEAGUE_ID`
- `SLEEPER_USERNAME`
- `PORT` (usually supplied by the host)

### Render
1. Create a new Web Service from this folder/repo.
2. Build command: `npm install`
3. Start command: `npm start`
4. Deploy.

The public URL will then look like:
`https://YOUR-SERVICE.onrender.com/api/snapshot/1`

## Notes
Sleeper's API is read-only and requires no token for these league endpoints. Keep call volume reasonable.
