# The VC Brain — $100K Checks in 24 Hours

Hack-Nation 6th Global AI Hackathon · Challenge 02 (Maschmeyer Group)

An AI-native venture fund operating system covering **Sourcing → Screening → Diligence → Decision**. Founders apply with just a deck and a company name — or get discovered before they ever apply — and the system produces an evidence-cited investment memo a human investor can act on within 24 hours.

## What it does

- **Thesis Engine** — the investor configures sectors, stage, geography, check size, ownership target, and risk appetite. Every screen, score, recommendation, *and outbound sourcing play* flows through this lens (`/thesis`).
- **Outbound sourcing** — the thesis itself generates concrete search plays (hackathon winners, OSS launches, research spinouts). Candidates are scored by the *exact same pipeline* as inbound applications, get a personalized outreach draft citing the specific signal that surfaced them, and converge into the same funnel when they apply (`/sourcing`).
- **Memory** — nothing is discarded. Every deck slide, web hit, and GitHub signal becomes a timestamped, source-tagged evidence row. The persistent **Founder Score** follows the person across startups and never resets — a founder who failed, shipped, and returned scores *up*.
- **Per-claim Trust Scores** — every founder claim is verified against an independently collected evidence pool. The score is a deterministic mapping, not LLM vibes: externally verified 80–95, deck-only 45, unverifiable 50, contradicted 10–25 (with both sources linked).
- **3-axis screening** — Founder / Market / Idea-vs-Market scored independently, never averaged, each with confidence, trend, and evidence citations. Disagreement is signal.
- **Cold-start mode** — first-time founders with no footprint are scored on what their materials evidence, with explicitly *wider* uncertainty bands instead of silent zeros.
- **Evidence-cited memos** — the five required sections, every bullet citing evidence ids, missing data explicitly flagged ("Cap table: not disclosed") — never fabricated.
- **Agentic traceability** — every pipeline stage logs to `reasoning_log`; the live progress view during analysis and the Trace tab are the same data.
- **Multi-attribute NL queries** — "technical founder, Berlin, AI infra, no prior VC backing" resolves in one pass, with per-criterion met / not-met / **unknown** chips.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · better-sqlite3 (the Memory layer) · OpenAI Responses API with strict structured outputs (decks ingested natively as PDF, so citations say "slide 4") · Tavily web search behind a cache table (demo-deterministic, rate-limit-immune).

## Run it

```bash
npm install
cp .env.example .env.local   # add OPENAI_API_KEY (+ TAVILY_API_KEY for live web search)
npm run smoke                # verify keys & model ids
npm run seed                 # rebuild the demo DB: 7 companies, real pipeline runs against cached fixtures
npm run dev                  # open http://localhost:3000
```

The seed corpus is fully fictional and marked "demo corpus" in the UI; contradictions are seeded on purpose to demonstrate the trust layer (the brief explicitly invites synthetic data with seeded contradictions).

## Deploy (public demo)

The repo ships with `data/demo-seed.db` — a pre-analyzed snapshot of the demo corpus. On boot, if no database exists, the app copies the snapshot into place, so a fresh deploy comes up fully populated with zero LLM calls. On hosts with ephemeral disks a restart simply resets the demo to this pristine state.

**Render** (zero config): this repo includes a `render.yaml` blueprint. In Render: *New → Blueprint → connect this repo*, set `OPENAI_API_KEY` and `TAVILY_API_KEY` when prompted, deploy. Any host that runs a persistent Node server (Railway, Fly.io) works the same way — build with `npm run build`, start with `npm start`. Vercel is not supported: the app needs a real filesystem for SQLite and long-lived background analysis.

## Demo walkthrough (2:30)

1. **Thesis** (`/thesis`) — everything downstream filters through this.
2. **Sourcing** (`/sourcing`) — generate plays from the thesis, run one, watch a candidate get scored like an application, read the outreach draft, then click *Simulate: candidate applies* — both tracks converge into one funnel record.
3. **Apply live** (`/apply`) — deck + company name; the analysis progress you watch *is* the reasoning log.
4. **Depth** — open QuantumLeap: three independent axis verdicts, the $50K-MRR claim contradicted at trust 18 with both sources linked, memo with flagged gaps and three diligence questions.
5. **Memory** — open Priya Sharma's founder profile: score history spanning two startups, up after a failure.
6. **Close** — dashboard query: *"technical founder, Berlin, AI infra, no prior VC backing"* → NeuraForge, with criterion chips.
