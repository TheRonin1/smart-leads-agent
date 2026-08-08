# Smart Leads Agent for Hoardings

A MERN app that detects upcoming hoarding vacancies, ranks the best-fit customer for
each one with explicit reasons, and drafts a personalised pitch with a rate-card-backed
price — built for the DigiPlus IT Agentic AI Hackathon (Q5 brief).

## How it maps to the brief

| Spec requirement | Where it lives |
|---|---|
| Vacancy pipeline from booking end-dates (next 90 days) | `backend/services/vacancyService.js` |
| Lead score per site × customer (history, industry fit, budget, relationship) | `backend/services/leadScoringService.js` |
| APIs for vacancies, leads, pitch | `backend/routes/*.js` |
| Vacancy list + top-3 ranked leads + "why" reasons + pitch preview | `frontend/src/App.jsx` + `components/` |
| AI layer: drafts pitch, narrates ranking | `backend/services/pitchService.js` (pitch), reasons array in `leadScoringService.js` (narration) |
| Bonus: renewal-vs-churn, cold-relationship flags, 90-day timeline | `predictRenewal()` in `pitchService.js`, `is_cold_relationship` flag, `RunwayStrip.jsx` |

**Note on the "AI layer":** pitch drafting and ranking narration are implemented as a
transparent, rule-based generator (no external LLM call needed to run the app) — every
sentence and every score is traceable to a field in the CSVs, which satisfies the
brief's "no invented numbers" / "never an unexplained score" validation scenarios
directly. If you'd rather have an actual LLM write the pitch prose, see
"Swapping in a real LLM" below — the integration point is a single function.

## Validating against the brief's scenarios

Before touching any UI, run the standalone check (no DB needed):

```bash
cd backend
npm install
node scripts/validate.js
```

This confirms, straight off the CSVs: no vacancy leaks in from beyond 90 days, no
in-window vacancy is missed, budget-mismatched customers are excluded from a
Premium site's list, and suggested rates never exceed the rate card.

## Project structure

```
smart-leads-agent/
  backend/
    config/          db connection + business-rule constants (weights, budget tiers, industry affinity)
    models/           Mongoose schemas: Hoarding, Customer, Booking
    services/          vacancyService, leadScoringService, pitchService (the actual logic)
    routes/             /api/vacancies, /api/leads, /api/pitch
    scripts/           generateData.js (synthetic CSVs), seed.js (CSV -> MongoDB), validate.js (smoke test)
    data/                hoardings.csv, bookings.csv, customers.csv (300 sites / 150 customers / ~770 bookings)
    server.js
  frontend/          "Hoardings Cockpit" — TS/React/Tailwind dashboard ("Signal Ledger" design)
    src/
      pages/Home.tsx         the whole dashboard: vacancy list, drawer, compare, pitch studio
      api/client.ts            typed axios wrapper around the backend's 4 endpoints
      components/ui/           trimmed shadcn primitives actually in use (sonner, tooltip)
      components/ErrorBoundary.tsx, contexts/ThemeContext.tsx, lib/utils.ts, hooks/
  frontend-legacy/   the original plain-JSX/inline-style frontend, kept for reference —
                       not wired up, safe to delete
```

**Note on `frontend/`:** this replaces the original plain-JSX frontend with a fuller
TypeScript/Tailwind dashboard that was designed separately (see `ideas.md` history) —
it's been wired to call the real `/api/vacancies`, `/api/leads/:id`, and
`/api/pitch/:hoardingId/:customerId` endpoints instead of the hardcoded demo data it
shipped with. A few fields the backend doesn't compute (site "priority", chart trends)
are derived client-side from real fields only — see comments at the top of `Home.tsx`.

## Running it locally

**Prerequisites:** Node 18+, a MongoDB instance (local `mongod`, or a free MongoDB
Atlas cluster — recommended, since it also lines up with the "live public URL"
deployment step).

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env        # put your MONGO_URI in here
npm run generate-data        # (already generated — rerun anytime for a fresh dataset)
npm run seed                 # loads the CSVs into MongoDB
npm run dev                  # http://localhost:5000

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev                  # http://localhost:5173, proxies /api to :5000
```

Open http://localhost:5173 — the vacancy list loads on the left/main pane from the live
API, click "View opportunity" on any site to see its real top-3 ranked leads and
reasons in the drawer, and "Generate personalized pitch" calls the real pitch endpoint.

## API reference

- `GET /api/vacancies` — all hoardings vacant/going vacant in the next 90 days, sorted
  soonest-first, with `revenue_at_risk_per_month` and total.
- `GET /api/leads/:hoardingId` — top-3 ranked customers for that site, each with a
  `score_breakdown` and a `reasons[]` array.
- `GET /api/leads/:hoardingId/renewal/:customerId` — bonus renewal-vs-churn heuristic
  for an incumbent.
- `GET /api/pitch/:hoardingId/:customerId` — personalised pitch text + suggested rate.

## Deploying (free tier + public repo, per the brief)

1. **Database:** create a free MongoDB Atlas cluster, grab the connection string.
2. **Backend:** push this repo to GitHub, deploy `backend/` to Render (or Railway) as
   a Node web service — set `MONGO_URI` as an env var, build command `npm install`,
   start command `npm start`. Run `node scripts/seed.js` once (Render shell, or a
   one-off job) against the same `MONGO_URI` to load data.
3. **Frontend:** deploy `frontend/` to Vercel or Netlify. Set the API proxy target
   (or switch `api/client.js`'s `baseURL` to your Render backend's public URL) via a
   `VITE_API_URL` env var at build time.
4. Push the whole repo to a public GitHub repository — both requirements in the
   brief's "Deployment" row are then satisfied.

## Swapping in a real LLM for the pitch (optional)

`generatePitch()` in `backend/services/pitchService.js` currently assembles the pitch
from a template. To have an LLM write the prose instead, replace the `pitchText`
construction with a call to your model of choice, passing it the same `site_facts` /
`customer_history` / `suggested_rate` object already computed — that keeps the rate
and facts grounded in real data while letting the model handle tone.

## Design notes

The frontend UI ("Hoardings Cockpit") uses a dark control-room palette — the
`RunwayStrip` component is the one signature element: a lit countdown bar per site
that visualizes how many of the 90 days remain before it goes dark, doubling as the
brief's bonus "90-day timeline visual."
