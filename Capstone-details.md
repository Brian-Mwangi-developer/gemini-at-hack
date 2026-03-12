# Capstone: Research‑Augmented Conversational Agent

One-line summary

Build and evaluate a fullstack research assistant that accepts user prompts (web UI and SMS), performs iterative web research with LangGraph + Gemini, synthesizes answers with citations, and provides a reproducible deployment using Docker Compose.

Goals & learning objectives

- Implement a production-capable fullstack app (React + FastAPI/LangGraph).
- Build a LangGraph agent that generates queries, performs web research, reflects, and synthesizes answers.
- Integrate two-way SMS (Africa's Talking) for inbound queries and replies.
- Containerize and deploy with Docker Compose; manage secrets safely.
- Design tests, evaluation metrics, and a demo that show correctness, latency, and citation quality.

High-level architecture

- Frontend: React + Vite UI (`/frontend`) with an input form, activity timeline, and citations view.
- Backend: LangGraph-powered FastAPI app (`/backend`) exposing API endpoints and LangGraph graphs that orchestrate:
  - query generation
  - web search connector
  - reflection & iteration loop
  - answer synthesis
- Data & infra: Redis (pub/sub), Postgres (persistence) via `docker-compose`.
- External: Google Gemini (LLM), LangSmith / LangGraph license, Africa's Talking (SMS).

Minimal contract (MVP)

- Inputs: user query (UI or SMS).
- Process: generate queries → search → reflect → iterate → synthesize.
- Output: text answer + list of citations and an activity timeline.
- Error modes: missing API keys, rate limits, search failures, license errors.
- Success: one end-to-end run that returns a coherent answer with ≥1 citation for sample prompts.

Scope options & assumptions

- Assumes developer has basic Python (FastAPI), React (Vite), Docker experience.
- Required external keys: GEMINI_API_KEY and LANGSMITH_API_KEY or LANGGRAPH_CLOUD_LICENSE_KEY.
- Two target scopes: MVP (core research loop + UI) and Production (robust infra, tests, SMS, monitoring).

Timeline & estimates

Solo, experienced fullstack engineer (recommended approach)

- MVP: 4–6 weeks (160–240 hours)
  - Week 0 (planning): 4–8 hours
  - Week 1: backend core + LangGraph graph (16–24 hours)
  - Week 2: search connector + ingestion (24–32 hours)
  - Week 3: frontend MVP + streaming timeline (24–32 hours)
  - Week 4: dockerize, persistence, tests, demo (24–40 hours)

- Production-grade add-ons: +4–8 weeks (160–320 hours)
  - Postgres-backed runtime, metrics, monitoring, SMS integration, CI, secrets management.

Small team (2–3 engineers)

- MVP: 2–3 weeks (parallel frontend & backend work)
- Production: 3–6 additional weeks

Milestones & deliverables (concrete)

- M1 — Repo skeleton + `.env.example`: repo README, skeleton directories, basic docs (1 day).
- M2 — Core LangGraph graph + prompt templates: query generation, reflection, synthesis (4–7 days).
- M3 — Search adapter + ingestion pipeline: integrate search API or mock connector (3–5 days).
- M4 — Frontend MVP: input + timeline + results (3–5 days).
- M5 — Docker Compose dev stack + demo script (2–3 days).
- M6 — Persistence, tests, CI, SMS, production polishing (2–6 weeks).

Deliverables & acceptance criteria

- Working repo branch with:
  - `README.md` updated, `CAPSTONE.md` (this doc), and `/.env.example` (no secrets)
  - `backend/` with FastAPI + LangGraph graph and a CLI runner
  - `frontend/` Vite app with input and timeline
  - `docker-compose.yml` + `docker-compose.override.yml` for dev
- Acceptance:
  - Able to run locally with Docker Compose and perform an agent run returning an answer with citations
  - Frontend shows timeline + final answer
  - No startup license crash when correct keys provided

Testing & evaluation plan

- Unit tests: prompt templates, query generation, citation parsing.
- Integration tests: agent run with mocked web search responses.
- End-to-end tests: scripted runs (5–10 questions) asserting non-empty answers and at least one citation.
- Human evaluation: blind review of 10–20 outputs for accuracy and citation usefulness.
- Metrics to collect: median/p95 latency, citation coverage, success rate across test prompts.

Demo scenarios

- Research a recent technical topic (e.g., "latest trends in wind turbines"): show generated queries, interim search results, and final answer with link citations.
- SMS demo: send a short question via Africa's Talking webhook (ngrok for local testing), show inbound handling and outbound reply.
- Failure case: ask about obscure facts and show reflection loop and graceful fallback message.

Run & deployment notes (developer quick commands)

- Build image (optional):

```bash
docker build -t gemini-fullstack-langgraph -f Dockerfile .
```

- Production (compose):

```bash
# from project root
docker-compose up --build
# or detached
docker-compose up --build -d
```

- Development (override mounts source + hot-reload):

```bash
docker-compose -f docker-compose.yml -f docker-compose.override.yml up --build
```

- Tail backend logs:

```bash
docker-compose logs -f langgraph-api
```

- Verify env inside container:

```bash
docker-compose exec langgraph-api env | grep -E 'LANGSMITH|LANGGRAPH|GEMINI'
```

Security & ethical considerations

- Never commit API keys or license keys to git. Add `.env` to `.gitignore` and provide `/.env.example` only.
- Redact PII when testing SMS flows. Limit SMS tests and follow provider policies.
- Respect robots.txt and copyright when implementing scraping; prefer official search APIs.

Risks & mitigations

- LangGraph license failures: provide clear docs to set `LANGSMITH_API_KEY` or `LANGGRAPH_CLOUD_LICENSE_KEY`.
- LLM cost and rate limits: add caching, fewer loops, and budgeted request limits.
- Data retention and privacy: document retention, provide commands to clear DB (`docker-compose down -v`).

Grading rubric (suggested)

- Functionality (40%): UI, API, agent runs, SMS demo.
- Answer quality (25%): citation coverage, clarity, factuality (human-evaluated).
- Engineering & reproducibility (20%): tests, Docker Compose, docs.
- Presentation (15%): demo video and final writeup.

Next steps (suggested immediate actions)

- Create `/.env.example` (no secrets) and add to repo.
- Scaffold minimal skeleton for `backend/` and `frontend/` if starting from scratch.
- Implement M2 (LangGraph graph + prompt templates) or mock LLM/search for rapid prototyping.
