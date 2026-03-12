# GemiGraph — AI Research Agent

A full-stack autonomous research agent powered by **Google Gemini**, **LangGraph**, **Exa Search**, and **Africa's Talking**. The agent plans searches, gathers live web sources, reflects on quality, iterates until the answer is comprehensive, and delivers results to your phone via SMS — no browser required.

## Agent Pipeline

The research agent is built as a LangGraph stateful graph. Every node is a discrete reasoning step:

| Step | Node                        | What Gemini Does                                                                                               |
| ---- | --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1    | **Intake**                  | Analyzes the query — is it clear enough to search, or does it need clarification?                              |
| 2    | **Clarify** _(conditional)_ | Interrupts execution, asks a clarifying question. Resumes once the user responds (browser _or_ SMS reply).     |
| 3    | **Plan Search**             | Generates 3–5 focused search queries. On later iterations, refines them based on identified gaps.              |
| 4    | **Execute Search**          | Runs all queries against the Exa live web search API.                                                          |
| 5    | **Analyze Results**         | Reads all sources and drafts an answer with inline `[Source N]` citations.                                     |
| 6    | **Reflect**                 | Critiques the draft for completeness and accuracy. Decides: iterate again, ask for clarification, or finalize. |
| 7    | **Synthesize**              | Writes the final polished answer with numbered citations and a Sources section.                                |

The agent self-improves through up to **3 search → analyze → reflect iterations** before delivering the final answer.

### Model Council Mode

Enable **Council Mode** to deploy Gemini, GPT, and Claude as independent parallel researchers on the same question. Each model runs its own full pipeline simultaneously, then a synthesis step compares their answers — surfacing agreements, unique insights, and disagreements across all models.

## Architecture

```
┌──────────────────────┐        ┌─────────────────────────┐
│   Next.js Frontend   │──SSE──▶│   FastAPI Backend        │
│   React + AI SDK     │◀──────│   LangGraph Agent        │
│   Port 3000          │        │   Port 8000              │
└──────────────────────┘        └──────────┬──────────────┘
         │                                 │
         │                      ┌──────────▼──────────────┐
         │                      │   External Services      │
         │                      │  • Google Gemini API     │
         │                      │  • Exa Search API        │
         │                      │  • OpenAI / Anthropic    │
         │                      │  • LangSmith (tracing)   │
         │                      └─────────────────────────┘
         │
┌────────▼─────────────┐        ┌─────────────────────────┐
│   PostgreSQL DB       │        │   Africa's Talking       │
│   Chat persistence    │        │   Inbound SMS callback   │
│   Port 5432           │        │   Outbound SMS delivery  │
└──────────────────────┘        └─────────────────────────┘
```

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) v2+
- API keys listed in the table below

## API Keys

| Variable                       | Required | Get it from                                                                             |
| ------------------------------ | -------- | --------------------------------------------------------------------------------------- |
| `GOOGLE_API_KEY`               | **Yes**  | [Google AI Studio](https://aistudio.google.com/apikey)                                  |
| `GOOGLE_GENERATIVE_AI_API_KEY` | **Yes**  | Same key as above                                                                       |
| `EXA_API_KEY`                  | **Yes**  | [Exa Dashboard](https://dashboard.exa.ai/api-keys)                                      |
| `OPENAI_API_KEY`               | Optional | [OpenAI Platform](https://platform.openai.com/api-keys) — needed for GPT council models |
| `ANTHROPIC_API_KEY`            | Optional | [Anthropic Console](https://console.anthropic.com) — needed for Claude council models   |
| `LANGSMITH_KEY`                | Optional | [LangSmith](https://smith.langchain.com) — enables full agent tracing                   |
| `AT_KEY`                       | Optional | [Africa's Talking](https://account.africastalking.com) — enables SMS features           |
| `AT_NAME`                      | Optional | Your Africa's Talking app username                                                      |
| `AT_SENDER_NAME`               | Optional | Your registered AT sender ID                                                            |
| `NEXT_PUBLIC_APP_URL`          | Optional | Your public tunnel URL — makes SMS links accessible outside localhost                   |

---

## Getting Started with Docker Compose

### Step 1 — Clone the repository

```bash
git clone https://github.com/Brian-Mwangi-developer/gemini-at-hack.git
cd gemini-at-hack
```

### Step 2 — Configure environment variables

Copy the example file and fill in your keys:

```bash
cp .env.example .env
```

Open `.env` and replace the placeholder values:

```env
# Required
GOOGLE_API_KEY=AIzaSy...
GOOGLE_GENERATIVE_AI_API_KEY=AIzaSy...
EXA_API_KEY=20408391-...

# Optional — for Model Council
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...

# Optional — for LangSmith tracing
LANGSMITH_KEY=lsv2_pt_...

# Optional — for SMS features
AT_KEY=atsk_...
AT_NAME=your-africastalking-username
AT_SENDER_NAME=AFTKNG

# Leave DATABASE_URL as-is — Docker Compose provides Postgres internally
DATABASE_URL="postgresql://gemigraph:gemigraph@localhost:5432/gemigraph"
```

> `.env` is git-ignored. Never commit real keys to version control.

### Step 3 — Build and start all services

```bash
docker compose up --build
```

This builds and starts three services:

| Service    | URL                   | Description              |
| ---------- | --------------------- | ------------------------ |
| `nextjs`   | http://localhost:3000 | Next.js frontend         |
| `fastapi`  | http://localhost:8000 | LangGraph research agent |
| `postgres` | localhost:5432        | PostgreSQL database      |

Next.js waits for both FastAPI (health check) and Postgres to be ready before starting. First build takes 3–5 minutes.

To run in the **background** (detached):

```bash
docker compose up --build -d
```

### Step 4 — Apply database migrations

On the **first run**, you need to run the Prisma migration to create the `chats` table. With containers running:

```bash
docker compose exec nextjs npx prisma migrate deploy
```

> You only need to do this once. On subsequent starts the schema is already in place.

### Step 5 — Open the app

Visit **http://localhost:3000** — you should see the GemiGraph landing page.

### Stopping

```bash
docker compose down
```

To also delete the Postgres data volume:

```bash
docker compose down -v
```

---

## Rebuilding After Code Changes

When you make changes to the source code, rebuild only the affected service:

```bash
# Rebuild both images from scratch
docker compose build --no-cache

# Rebuild one service
docker compose build --no-cache nextjs
docker compose build --no-cache fastapi

# Restart after rebuild
docker compose up -d
```

---

## SMS Features Setup (Africa's Talking)

GemiGraph supports two SMS flows:

**1. Send research to your phone:** After any research completes in the browser, click the menu → "Send via SMS", enter your number, and receive the chat URL as an SMS.

**2. SMS-initiated research:** Text any research question to your Africa's Talking number. The agent runs autonomously and texts you back when complete — no browser needed.

### Enabling Inbound SMS (two-way)

The `/sms-callback` endpoint on the FastAPI server receives incoming SMS from Africa's Talking. To connect it:

1. **Get a public URL.** Start the Cloudflare tunnel service:

   ```bash
   docker compose --profile tunnel up -d
   ```

   Get the generated public URL:

   ```bash
   docker compose logs tunnel
   # Look for a line like:
   # INF | Your quick Tunnel has been created! Visit it at https://random-words.trycloudflare.com
   ```

2. **Set your public URL** in `.env`:

   ```env
   NEXT_PUBLIC_APP_URL=https://random-words.trycloudflare.com
   ```

   Then restart the Next.js service:

   ```bash
   docker compose restart nextjs
   ```

3. **Register the callback** in your Africa's Talking dashboard:
   - Go to **SMS** → **SMS Callback URL**
   - Set it to: `https://random-words.trycloudflare.com/sms-callback`

4. **Test it:** Text any research question to your AT number and follow the SMS exchange.

> The free Cloudflare tunnel URL changes on every restart. For a stable URL, use [ngrok](https://ngrok.com) with a free account and static domain, or your own domain with a Cloudflare Named Tunnel.

---

## Local Development (without Docker)

### Backend

```bash
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cd src/api
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend

```bash
pnpm install
pnpm dev:next
```

### Both concurrently

```bash
pnpm dev
```

> For local dev, make sure Postgres is running. The easiest way: `docker compose up postgres -d`

---

## LangSmith Tracing

When `LANGSMITH_KEY` is set, the agent automatically enables end-to-end tracing. Every run is recorded — all LLM calls, node executions, tool invocations, token usage, and interrupt/resume flows.

View traces at **https://smith.langchain.com** → project `gemigraph-research-agent`.

---

## Project Structure

```
├── Dockerfile.nextjs              # Multi-stage Next.js build
├── Dockerfile.fastapi             # FastAPI container
├── docker-compose.yml             # Service orchestration
├── .env.example                   # Template — copy to .env
├── requirements.txt               # Python dependencies
├── prisma/
│   └── schema.prisma              # Chat model schema
└── src/
    ├── api/                       # FastAPI backend
    │   ├── main.py                # Server, SSE streaming, SMS callback
    │   └── research_agent/
    │       ├── graph.py           # LangGraph state machine
    │       ├── nodes.py           # Node implementations
    │       ├── council.py         # Multi-model parallel council
    │       ├── state.py           # TypedDict state definitions
    │       └── tools.py           # Exa search tools
    ├── app/                       # Next.js App Router
    │   ├── page.tsx               # Landing page
    │   ├── chat/                  # New chat page (auto-generates UUID)
    │   ├── chat/[id]/             # Chat page by ID (loads from DB)
    │   └── api/
    │       ├── chat/              # Proxies to FastAPI (SSE streaming)
    │       ├── chats/             # Chat CRUD (Prisma → Postgres)
    │       └── send-sms/          # Proxies to FastAPI SMS endpoint
    ├── components/
    │   ├── chat-area/             # All chat UI components
    │   └── ui/                    # shadcn/ui primitives
    ├── lib/
    │   └── prisma.ts              # Prisma client singleton (PrismaPg adapter)
    └── store/
        └── index.ts               # Zustand state (model selection, council mode)
```

## Tech Stack

| Layer                   | Technology                                                         |
| ----------------------- | ------------------------------------------------------------------ |
| **Core AI**             | Google Gemini 3.1 Pro via `langchain-google-genai`                 |
| **Agent Orchestration** | LangGraph — stateful graph with interrupts and iterative loops     |
| **Multi-model Council** | LangChain (OpenAI + Anthropic) for parallel model execution        |
| **Web Search**          | Exa API — live search with full text extraction                    |
| **SMS Platform**        | Africa's Talking — two-way SMS (inbound + outbound)                |
| **Backend**             | FastAPI + Python — SSE streaming, async background tasks           |
| **Frontend**            | Next.js 16, React 19, Vercel AI SDK, Zustand, Tailwind CSS v4      |
| **Database**            | PostgreSQL 16 + Prisma 7 (PrismaPg adapter)                        |
| **Tunnel**              | Cloudflare `cloudflared` — zero-config public URL for SMS webhooks |
| **Tracing**             | LangSmith — full agent observability                               |
| **Deployment**          | Docker Compose                                                     |
