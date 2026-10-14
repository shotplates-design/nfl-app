# nfl-app# BetStats NFL
Data: `data/raw.csv` -> `npm run prepare-data` -> `data/players.json`.
Content: `npm run content` regenerates `data/articles.json` (trending/top-performance/matchup pages) + `public/search.json`. Runs automatically in `npm run build`.
Schedule: cron `0 11 * * * cd /workspace/betstats && npm run content && npm run build` or `.github/workflows/refresh-content.yml` (deploy hook).
Set `NEXT_PUBLIC_SITE_URL` to the final domain for canonical/sitemap URLs.

## Accounts (dashboard login)
NextAuth (credentials) + Upstash Redis free tier. Set in Vercel env: `NEXTAUTH_SECRET` (`openssl rand -base64 32`), `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`. Without them, public pages work and sign-up shows "not configured".
