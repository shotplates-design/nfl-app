# nfl-app
# ThePlayerProps
Data: `data/raw.csv` -> `npm run prepare-data` -> `data/players.json`.
Content: `npm run content` regenerates `data/articles.json` (trending/top-performance/matchup pages) + `public/search.json`. Runs automatically in `npm run build`.
Refresh: `.github/workflows/refresh-data.yml` rebuilds `data/raw.csv` from nflverse weekly stats (ESPN public JSON only for QB rating/long and third downs), writes the current `data/matchups/week-N.json`, and commits to `main` after validation. Vercel deploys that push. The job has `contents: read` by default and `contents: write` only on the commit job. Actions must be allowed to push to `main` (workflow permissions, and a bypass if a ruleset blocks the GitHub Actions bot). There is no deploy hook, so the old content workflow cannot double-deploy.
Set `NEXT_PUBLIC_SITE_URL` to the final domain for canonical/sitemap URLs.

## Accounts (dashboard login)
NextAuth (credentials) + Upstash Redis free tier. Set in Vercel env: `NEXTAUTH_SECRET` (`openssl rand -base64 32`), `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (or the Marketplace names `KV_REST_API_URL`/`KV_REST_API_TOKEN`). Without them, public pages work and sign-up shows "not configured".

## Weekly matchups
Add `data/matchups/week-N.json` (copy `week-6.json`): `season`, `week`, `schedule_source`, `byes` (team codes), `games[]` with `away`/`home` (team nicknames, e.g. "Seahawks"), `kickoff` (ISO with offset), `network`, `venue`, optional `analysis` and `*_strengths`/`*_weaknesses`. The highest week number becomes the home/Matchups view; per-game pages `/matchups/<away>-at-<home>-<season>-week-<N>` and sitemap entries are generated at build. Only add lines/spreads if they come from a real source.
`raw-week-6-supplied.json` is the user's original file: its pairings disagreed with NFL.com for 8 of 13 games, so week-6.json uses the official schedule and keeps the supplied analysis only for the 3 pairings that matched.
