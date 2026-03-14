"""Research Agent — FastAPI server + interactive terminal CLI."""

import africastalking
import asyncio
import json
import os
import sys
import uuid
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from langchain_core.messages import HumanMessage
from langchain_core.runnables import RunnableConfig
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.types import Command
from pydantic import BaseModel
from research_agent.council import MODEL_DISPLAY_NAMES, PROVIDER_ICONS
from research_agent.graph import build_research_graph
from research_agent.state import ResearchState

_project_root = os.path.dirname(os.path.dirname(
    os.path.dirname(os.path.abspath(__file__))))
load_dotenv(os.path.join(_project_root, ".env"))

# ── LangSmith Tracing ─────────────────────────────────────────────────────
_langsmith_key = os.environ.get(
    "LANGSMITH_KEY") or os.environ.get("LANGCHAIN_API_KEY")
if _langsmith_key:
    os.environ.setdefault("LANGCHAIN_TRACING_V2", "true")
    os.environ.setdefault("LANGCHAIN_API_KEY", _langsmith_key)
    os.environ.setdefault("LANGCHAIN_PROJECT", os.environ.get(
        "LANGCHAIN_PROJECT", "gemigraph-research-agent"))
    print(
        f"[langsmith] Tracing enabled → project={os.environ['LANGCHAIN_PROJECT']}")
else:
    print("[langsmith] LANGSMITH_KEY / LANGCHAIN_API_KEY not set — tracing disabled")

graph = build_research_graph()


NODE_LABELS = {
    "intake": "Analyzing Query",
    "clarify": "Asking for Clarification",
    "plan_search": "Planning Search Strategy",
    "execute_search": "Searching the Web",
    "analyze_results": "Analyzing Results",
    "reflect": "Evaluating Answer Quality",
    "synthesize": "Writing Final Answer",
    "council_dispatch": "Running Model Council",
    "council_synthesize": "Synthesizing Findings",
}


def _sse(data: dict | str) -> str:
    """Format a single Server-Sent Event line."""
    if isinstance(data, str):
        return f"data: {data}\n\n"
    return f"data: {json.dumps(data)}\n\n"


async def _stream_graph(graph_instance, state_or_cmd, config):
    """Run graph.stream synchronously in a thread, yielding chunks async."""
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()

    def _run():
        try:
            for chunk in graph_instance.stream(
                state_or_cmd, config, stream_mode="updates"
            ):
                loop.call_soon_threadsafe(queue.put_nowait, ("chunk", chunk))
        except Exception as exc:
            loop.call_soon_threadsafe(queue.put_nowait, ("error", exc))
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, ("done", None))

    loop.run_in_executor(None, _run)

    while True:
        kind, data = await queue.get()
        if kind == "done":
            break
        if kind == "error":
            raise data
        yield data


# ---------------------------------------------------------------------------
# FastAPI
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

app = FastAPI(title="Research Agent", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://nextjs:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/chat")
async def chat_endpoint(request: Request):
    """Handle chat from the Next.js frontend using the AI SDK Data Stream
    Protocol (SSE with ``x-vercel-ai-ui-message-stream: v1``).

    • Each LangGraph node is exposed as an ``agent_step`` tool call so
      the frontend can render a real-time stepper with spinners.
    • An ``interrupt()`` in the graph becomes an ``ask_clarification``
      tool call **without** output — the frontend shows an input box and
      calls ``addToolResult`` which triggers a new POST here.
    • The final synthesised answer is streamed as incremental text deltas.
    """
    body = await request.json()
    messages = body.get("messages", [])
    thread_id = body.get("threadId") or str(uuid.uuid4())
    config = RunnableConfig(configurable={"thread_id": thread_id})

    # Council mode
    council_mode = body.get("modelCouncil", False)
    active_models = body.get("activeModels", [])

    # ── Council logging ──────────────────────────────────────────────────
    model_keys = [
        f"{m.get('provider', '?')}/{m.get('model', '?')}" for m in active_models] if active_models else []
    print(
        f"[council] thread={thread_id[:8]}  council_mode={council_mode}  models={model_keys}")
    if council_mode and not active_models:
        print(f"[council] WARNING: council_mode=True but no activeModels received!")

    resume_value = None
    for msg in reversed(messages):
        if msg.get("role") != "assistant":
            continue
        for part in msg.get("parts", []):
            if not isinstance(part, dict):
                continue
            tool_name = part.get("toolName", "")
            if not tool_name:
                part_type = part.get("type", "")
                if isinstance(part_type, str) and part_type.startswith("tool-"):
                    tool_name = part_type[5:]
            state_val = part.get("state", "")
            if tool_name == "ask_clarification" and state_val == "output-available":
                resume_value = part.get("output", "")
                break
        break

    last_asst = next((m for m in reversed(messages)
                     if m.get('role') == 'assistant'), None)
    if last_asst:
        part_summary = []
        for p in last_asst.get('parts', []):
            if isinstance(p, dict):
                part_summary.append(
                    f"{p.get('type', '?')}[state={p.get('state', '?')}, toolName={p.get('toolName', '?')}]")
        print(
            f"[chat] thread={thread_id[:8]}  resume={'YES: ' + repr(resume_value[:60]) if resume_value else 'NO'}  parts={part_summary}")
    else:
        print(
            f"[chat] thread={thread_id[:8]}  resume={'YES: ' + repr(resume_value[:60]) if resume_value else 'NO'}  (no assistant msg)")

    user_query = ""
    for msg in reversed(messages):
        if msg.get("role") == "user":
            for part in msg.get("parts", []):
                if isinstance(part, dict) and part.get("type") == "text":
                    user_query = part.get("text", "")
                    break
            break

    async def _generate():
        message_id = f"msg-{uuid.uuid4()}"
        yield _sse({"type": "start", "messageId": message_id})
        yield _sse({"type": "start-step"})

        try:

            if resume_value is not None:
                stream_input = Command(resume=resume_value)
            else:
                stream_input = {
                    "messages": [{"role": "user", "content": user_query}],
                    "research_query": user_query,
                    "search_queries": [],
                    "search_results": [],
                    "draft_answer": "",
                    "citations": [],
                    "reflection": "",
                    "iteration_count": 0,
                    "max_iterations": 3,
                    "errors": [],
                    "final_answer": "",
                    "council_mode": council_mode,
                    "council_models": active_models if council_mode else [],
                    "council_results": {},
                    "council_synthesized_answer": "",
                }

            async for chunk in _stream_graph(graph, stream_input, config):
                for node_name, update in chunk.items():
                    if node_name == "__interrupt__":
                        # ── Interrupt → ask_clarification tool (no output) ──
                        interrupt_info = None
                        if isinstance(update, (list, tuple)) and len(update) > 0:
                            item = update[0]
                            if hasattr(item, "value"):
                                interrupt_info = item.value
                            else:
                                interrupt_info = item
                        elif isinstance(update, dict):
                            interrupt_info = update
                        else:
                            interrupt_info = update

                        if isinstance(interrupt_info, dict):
                            question = interrupt_info.get(
                                "question", str(interrupt_info))
                        else:
                            question = str(interrupt_info)
                        tc_id = f"tc-clarify-{uuid.uuid4()}"
                        yield _sse(
                            {
                                "type": "tool-input-start",
                                "toolCallId": tc_id,
                                "toolName": "ask_clarification",
                            }
                        )
                        yield _sse(
                            {
                                "type": "tool-input-available",
                                "toolCallId": tc_id,
                                "toolName": "ask_clarification",
                                "input": {"question": question},
                            }
                        )

                    elif node_name == "council_dispatch" and isinstance(update, dict):
                        # ── Council dispatch: emit per-model agent cards ──
                        council_results = update.get("council_results", {})

                        dispatch_id = f"tc-step-{uuid.uuid4()}"
                        yield _sse(
                            {
                                "type": "tool-input-start",
                                "toolCallId": dispatch_id,
                                "toolName": "agent_step",
                            }
                        )
                        yield _sse(
                            {
                                "type": "tool-input-available",
                                "toolCallId": dispatch_id,
                                "toolName": "agent_step",
                                "input": {
                                    "node": "council_dispatch",
                                    "label": "Running Model Council",
                                },
                            }
                        )
                        yield _sse(
                            {
                                "type": "tool-output-available",
                                "toolCallId": dispatch_id,
                                "output": {
                                    "status": "completed",
                                    "detail": f"{len(council_results)} models completed",
                                },
                            }
                        )

                        for model_key, result in council_results.items():
                            agent_id = f"tc-council-{uuid.uuid4()}"
                            display_name = result.get(
                                "display_name", model_key)
                            provider = result.get("provider", "unknown")
                            steps = result.get("steps", [])
                            draft = result.get("draft_answer", "")
                            cites = result.get("citations", [])
                            errors = result.get("errors", [])

                            yield _sse(
                                {
                                    "type": "tool-input-start",
                                    "toolCallId": agent_id,
                                    "toolName": "council_agent",
                                }
                            )
                            yield _sse(
                                {
                                    "type": "tool-input-available",
                                    "toolCallId": agent_id,
                                    "toolName": "council_agent",
                                    "input": {
                                        "model_key": model_key,
                                        "display_name": display_name,
                                        "provider": provider,
                                        "icon": PROVIDER_ICONS.get(provider, "?"),
                                    },
                                }
                            )
                            yield _sse(
                                {
                                    "type": "tool-output-available",
                                    "toolCallId": agent_id,
                                    "output": {
                                        "status": "completed",
                                        "steps": steps,
                                        "step_count": len(steps),
                                        "draft_answer": draft,
                                        "citations": cites,
                                        "errors": errors,
                                    },
                                }
                            )

                    elif node_name == "council_synthesize" and isinstance(update, dict):
                        # ── Council synthesize: emit synthesis step + stream text ──
                        synth_id = f"tc-step-{uuid.uuid4()}"
                        yield _sse(
                            {
                                "type": "tool-input-start",
                                "toolCallId": synth_id,
                                "toolName": "agent_step",
                            }
                        )
                        yield _sse(
                            {
                                "type": "tool-input-available",
                                "toolCallId": synth_id,
                                "toolName": "agent_step",
                                "input": {
                                    "node": "council_synthesize",
                                    "label": "Synthesizing Findings",
                                },
                            }
                        )
                        yield _sse(
                            {
                                "type": "tool-output-available",
                                "toolCallId": synth_id,
                                "output": {
                                    "status": "completed",
                                    "detail": "Consensus analysis complete",
                                },
                            }
                        )

                        final_answer = update.get("final_answer", "")
                        if final_answer:
                            text_id = f"txt-{uuid.uuid4()}"
                            yield _sse(
                                {"type": "text-start", "id": text_id}
                            )
                            chunk_size = 12
                            for i in range(0, len(final_answer), chunk_size):
                                yield _sse(
                                    {
                                        "type": "text-delta",
                                        "id": text_id,
                                        "delta": final_answer[i: i + chunk_size],
                                    }
                                )
                                await asyncio.sleep(0.01)
                            yield _sse({"type": "text-end", "id": text_id})

                    else:
                        # Skip the clarify node — it is always followed
                        # by an __interrupt__ that becomes ask_clarification.
                        if node_name == "clarify":
                            continue

                        # ── Regular node → agent_step tool call ─────────
                        label = NODE_LABELS.get(node_name, node_name)
                        step_id = f"tc-step-{uuid.uuid4()}"

                        yield _sse(
                            {
                                "type": "tool-input-start",
                                "toolCallId": step_id,
                                "toolName": "agent_step",
                            }
                        )
                        yield _sse(
                            {
                                "type": "tool-input-available",
                                "toolCallId": step_id,
                                "toolName": "agent_step",
                                "input": {
                                    "node": node_name,
                                    "label": label,
                                },
                            }
                        )

                        detail = ""
                        if isinstance(update, dict):
                            if node_name == "execute_search":
                                n_res = len(update.get("search_results", []))
                                n_err = len(update.get("errors", []))
                                detail = f"{n_res} results found"
                                if n_err:
                                    detail += f", {n_err} errors"
                            elif node_name == "plan_search":
                                qs = update.get("search_queries", [])
                                detail = f"{len(qs)} search queries planned"
                            elif node_name == "reflect":
                                detail = (
                                    update.get("reflection", "")[:120] or ""
                                )
                            elif node_name == "analyze_results":
                                n_cit = len(update.get("citations", []))
                                detail = f"{n_cit} citations extracted"
                            elif node_name == "intake":
                                detail = "Query understood"

                        yield _sse(
                            {
                                "type": "tool-output-available",
                                "toolCallId": step_id,
                                "output": {
                                    "status": "completed",
                                    "detail": detail,
                                },
                            }
                        )

                        # ── If synthesize finished, stream the answer ───
                        if (
                            node_name == "synthesize"
                            and isinstance(update, dict)
                            and update.get("final_answer")
                        ):
                            final_answer = update["final_answer"]
                            text_id = f"txt-{uuid.uuid4()}"
                            yield _sse(
                                {"type": "text-start", "id": text_id}
                            )
                            chunk_size = 12
                            for i in range(
                                0, len(final_answer), chunk_size
                            ):
                                yield _sse(
                                    {
                                        "type": "text-delta",
                                        "id": text_id,
                                        "delta": final_answer[
                                            i: i + chunk_size
                                        ],
                                    }
                                )
                                await asyncio.sleep(0.01)
                            yield _sse({"type": "text-end", "id": text_id})

        except Exception as exc:
            yield _sse(
                {
                    "type": "error",
                    "errorText": f"{type(exc).__name__}: {exc}",
                }
            )

        yield _sse({"type": "finish-step"})
        yield _sse({"type": "finish"})
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        _generate(),
        media_type="text/event-stream",
        headers={
            "x-vercel-ai-ui-message-stream": "v1",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


class ResearchRequest(BaseModel):
    query: str
    thread_id: str | None = None


class ResumeRequest(BaseModel):
    thread_id: str
    user_input: str

# to be used with Terminal Testing of the app


@app.post("/research")
async def start_research(req: ResearchRequest):
    """Start a new research session."""
    thread_id = req.thread_id or str(uuid.uuid4())
    config = RunnableConfig(configurable={"thread_id": thread_id})

    initial_state: ResearchState = {
        "messages": [{"role": "user", "content": req.query}],  # type: ignore[]
        "research_query": req.query,
        "search_queries": [],
        "search_results": [],
        "draft_answer": "",
        "citations": [],
        "reflection": "",
        "iteration_count": 0,
        "max_iterations": 3,
        "errors": [],
        "final_answer": "",
    }

    result = await asyncio.to_thread(graph.invoke, initial_state, config)

    # Check for interrupt (clarification needed)
    if "__interrupt__" in result:
        interrupt_info = result["__interrupt__"][0].value
        return {
            "status": "needs_clarification",
            "thread_id": thread_id,
            "question": interrupt_info.get("question", str(interrupt_info)),
        }

    return {
        "status": "complete",
        "thread_id": thread_id,
        "answer": result.get("final_answer", ""),
    }


@app.post("/research/resume")
async def resume_research(req: ResumeRequest):
    """Resume a research session after providing clarification."""
    config = RunnableConfig(configurable={"thread_id": req.thread_id})
    result = await asyncio.to_thread(
        graph.invoke, Command(resume=req.user_input), config
    )

    if "__interrupt__" in result:
        interrupt_info = result["__interrupt__"][0].value
        return {
            "status": "needs_clarification",
            "thread_id": req.thread_id,
            "question": interrupt_info.get("question", str(interrupt_info)),
        }

    return {
        "status": "complete",
        "thread_id": req.thread_id,
        "answer": result.get("final_answer", ""),
    }


@app.get("/health")
async def health():
    return {"status": "ok"}


_at_username = os.environ.get("AT_NAME")
_at_api_key = os.environ.get("AT_KEY")
_at_sender_name = os.environ.get("AT_SENDER_NAME")

if _at_username and _at_api_key:
    africastalking.initialize(_at_username, _at_api_key)
    _at_sms = africastalking.SMS
    print(f"[africastalking] Initialized — username={_at_username}")
else:
    _at_sms = None
    print("[africastalking] AT_NAME / AT_KEY not set — SMS disabled")


class SendSmsRequest(BaseModel):
    phoneNumber: str
    chatUrl: str


@app.post("/send-sms")
async def send_sms(req: SendSmsRequest):
    """Send an SMS with the research chat URL."""
    if not _at_sms:
        return JSONResponse({"message": "SMS service not configured (missing AT_NAME / AT_KEY)"}, status_code=500)

    phone = req.phoneNumber.strip()
    if not phone or not phone.startswith("+"):
        return JSONResponse({"message": "Phone number must start with + and country code"}, status_code=400)

    message = f"Here is your Research:\n{req.chatUrl}"

    try:
        response = _at_sms.send(
            message=message,
            recipients=[phone],
            **({"sender_id": _at_sender_name} if _at_sender_name else {})
        )
        print(f"[sms] Sent to {phone}: {response}")
        return {"status": "success", "data": response}
    except Exception as e:
        print(f"[sms] Error sending to {phone}: {e}")
        return JSONResponse({"message": f"Failed to send SMS: {str(e)}"}, status_code=500)


# Maps phone number → {"thread_id": str, "status": "pending"|"awaiting_clarification"|"complete"}
_sms_sessions: dict[str, dict] = {}

_app_base_url = os.environ.get("NEXT_PUBLIC_APP_URL", "http://localhost:3000")
_nextjs_internal_url = os.environ.get(
    "NEXTJS_INTERNAL_URL", "http://localhost:3000")


# SMS

_sms_llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash", temperature=0.7)


def _generate_pending_message(user_query: str) -> str:
    """Generate an engaging, conversational 'research pending' message."""
    prompt = f"""You are a friendly AI research assistant. A user just asked: "{user_query}"

Generate a SHORT, conversational SMS message (max 160 characters) that acknowledges their query and tells them you're looking into it. Make it sound like YOU are actually researching and will get back to them. Be specific about what you'll look for based on their query.

Examples of good tone:
- "Looking up the best options for that. Will send you insights in a moment!"
- "Digging into details on that topic. Sending findings shortly!"
- "Let me research that for you. You'll have answers soon!"

ONLY respond with the message text, nothing else."""

    try:
        result = _sms_llm.invoke([HumanMessage(content=prompt)])

        if isinstance(result.content, list):
            text = ''.join([str(c) if isinstance(c, str) else c.get(
                'text', '') for c in result.content])
        else:
            text = result.content
        message = text.strip() if text else ""
        return message[:160]
    except Exception as e:
        print(f"[sms-prompt] Failed to generate pending message: {e}")
        return "Looking into your research query. You'll hear from me shortly!"


def _generate_summary(answer: str, user_query: str = "") -> str:
    """Extract the actual answer from research and format it for SMS.

    Strategy:
    - If extracted info (contacts, prices, facts) fits in ~2 SMS (~300 chars), return it directly.
    - If too long, give top 2-3 results + "& more at link."
    - NEVER say "check the link" without giving at least one concrete fact.
    """
    prompt = f"""You are an SMS response expert. A user sent this query via SMS: "{user_query}"

Here is the research answer:
{answer[:1200]}

YOUR JOB:
1. Read the research answer carefully and find the EXACT information the user asked for.
2. If the user asked for contacts/phone numbers/addresses: list them directly (name + number, one per line).
3. If the user asked for prices: list them directly.
4. If the user asked a factual question: answer it in 1-2 sentences.
5. Your response will be sent as SMS. Keep it under 580 characters TOTAL (fits ~4 SMS messages).
6.  Cover ALL items the user asked about. If multiple products, give top 2 stores/prices per item."
7.If you still cannot fit everything, summarize tightly and end with but you must atleast give an answer that make user want to click the link "& more at link."
8. DO NOT say "check the link" without first giving at least one real answer to users question.

9. DO NOT add preamble like "Here are the results" — just give the data.
10. Format as: Store: Product - KSh Price (one per line).
11. Format contacts as: Name: 0700000000 (one per line).

Respond with ONLY the SMS text, nothing else."""

    try:
        result = _sms_llm.invoke([HumanMessage(content=prompt)])
        if isinstance(result.content, list):
            text = ''.join([str(c) if isinstance(c, str) else c.get(
                'text', '') for c in result.content])
        else:
            text = result.content
        summary = text.strip() if text else ""
        return summary[:600]
    except Exception as e:
        print(f"[sms-prompt] Failed to generate summary: {e}")
        return "Got your research results. Check the link for details."


def _generate_completion_message(summary: str, chat_url: str) -> str:
    """Append the chat URL to the summary. Always include both data + link."""
    print(f"[CHAT_URL]: The Chat url is: {chat_url}")
    return f"{summary}\n\n{chat_url}"


def _generate_clarification_ack(question: str) -> str:
    """Generate a conversational acknowledgment message for clarification request."""
    prompt = f"""You are a friendly AI research assistant asking for clarification.
The user asked something, and you need a detail from them. Generate a SHORT, conversational
SMS message (max 160 characters) that acknowledges you received their message and are asking for a clarification.
Make it feel natural and engaging, like: "Got it! Just to narrow it down..."

Clarification question: {question}

ONLY respond with the message text, nothing else."""

    try:
        result = _sms_llm.invoke([HumanMessage(content=prompt)])
        if isinstance(result.content, list):
            text = ''.join([str(c) if isinstance(c, str) else c.get(
                'text', '') for c in result.content])
        else:
            text = result.content
        message = text.strip() if text else ""
        return message[:160]
    except Exception as e:
        print(f"[sms-prompt] Failed to generate clarification ack: {e}")
        return "Got your message! Need one more detail..."


def _save_chat_to_db(thread_id: str, query: str, answer: str):
    """Save the SMS research result to the Next.js chats API so the URL works."""
    import urllib.request
    messages = [
        {"id": f"user-{uuid.uuid4()}", "role": "user",
         "parts": [{"type": "text", "text": query}]},
        {"id": f"asst-{uuid.uuid4()}", "role": "assistant",
         "parts": [{"type": "text", "text": answer}]},
    ]
    payload = json.dumps({"messages": messages}).encode()
    url = f"{_nextjs_internal_url}/api/chats/{thread_id}"
    req = urllib.request.Request(url, data=payload, headers={
                                 "Content-Type": "application/json"}, method="PUT")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            print(f"[sms-cb] Saved chat {thread_id[:8]} to DB — {resp.status}")
    except Exception as e:
        print(f"[sms-cb] Failed to save chat {thread_id[:8]}: {e}")


def _send_sms_sync(to: str, message: str):
    """Fire-and-forget SMS send (call from a thread)."""
    if not _at_sms:
        print(f"[sms-cb] SMS disabled — would send to {to}: {message[:80]}")
        return
    try:
        resp = _at_sms.send(message=message, recipients=[
                            to], sender_id=_at_sender_name)
        print(f"[sms-cb] Sent to {to}: {resp}")
    except Exception as e:
        print(f"[sms-cb] Failed to send to {to}: {e}")


async def _run_sms_research(phone: str, query: str, thread_id: str):
    """Run the research graph in the background for an SMS user."""
    config = RunnableConfig(configurable={"thread_id": thread_id})

    initial_state: ResearchState = {
        "messages": [{"role": "user", "content": query}],  # type: ignore
        "research_query": query,
        "search_queries": [],
        "search_results": [],
        "draft_answer": "",
        "citations": [],
        "reflection": "",
        "iteration_count": 0,
        "max_iterations": 3,
        "errors": [],
        "final_answer": "",
        "council_mode": False,
        "council_models": [],
        "council_results": {},
        "council_synthesized_answer": "",
    }

    try:
        result = await asyncio.to_thread(graph.invoke, initial_state, config)

        if "__interrupt__" in result:
            interrupt_info = result["__interrupt__"][0].value
            question = interrupt_info.get("question", str(interrupt_info))
            _sms_sessions[phone]["status"] = "awaiting_clarification"

            ack_message = await asyncio.to_thread(_generate_clarification_ack, question)
            await asyncio.to_thread(
                _send_sms_sync, phone,
                f"{ack_message}\n\n{question}",
            )
            return

        # Research complete — save to DB and notify
        final_answer = result.get(
            "final_answer", "") or result.get("draft_answer", "")
        _sms_sessions[phone]["status"] = "complete"
        await asyncio.to_thread(_save_chat_to_db, thread_id, query, final_answer)
        chat_url = f"{_app_base_url}/chat/{thread_id}"

        summary = await asyncio.to_thread(_generate_summary, final_answer, query)
        completion_msg = await asyncio.to_thread(_generate_completion_message, summary, chat_url)
        await asyncio.to_thread(
            _send_sms_sync, phone,
            completion_msg,
        )
    except Exception as e:
        print(f"[sms-cb] Research failed for {phone}: {e}")
        _sms_sessions[phone]["status"] = "complete"
        await asyncio.to_thread(
            _send_sms_sync, phone,
            f"Sorry, your research encountered an error. Please try again.",
        )


async def _resume_sms_research(phone: str, user_input: str, thread_id: str):
    """Resume a research graph after the user replies to a clarification SMS."""
    config = RunnableConfig(configurable={"thread_id": thread_id})
    _sms_sessions[phone]["status"] = "pending"

    try:
        result = await asyncio.to_thread(
            graph.invoke, Command(resume=user_input), config
        )

        if "__interrupt__" in result:
            interrupt_info = result["__interrupt__"][0].value
            question = interrupt_info.get("question", str(interrupt_info))
            _sms_sessions[phone]["status"] = "awaiting_clarification"

            ack_message = await asyncio.to_thread(_generate_clarification_ack, question)
            await asyncio.to_thread(
                _send_sms_sync, phone,
                f"{ack_message}\n\n{question}",
            )
            return

        final_answer = result.get(
            "final_answer", "") or result.get("draft_answer", "")
        _sms_sessions[phone]["status"] = "complete"
        query = _sms_sessions[phone].get("query", "SMS Research")
        await asyncio.to_thread(_save_chat_to_db, thread_id, query, final_answer)
        chat_url = f"{_app_base_url}/chat/{thread_id}"
        summary = await asyncio.to_thread(_generate_summary, final_answer, query)
        completion_msg = await asyncio.to_thread(_generate_completion_message, summary, chat_url)
        print(f"[Chat_URL] the Url is:{chat_url}")
        await asyncio.to_thread(
            _send_sms_sync, phone,
            completion_msg,
        )
    except Exception as e:
        print(f"[sms-cb] Resume failed for {phone}: {e}")
        _sms_sessions[phone]["status"] = "complete"
        await asyncio.to_thread(
            _send_sms_sync, phone,
            f"Sorry, your research encountered an error. Please try again.",
        )


@app.post("/sms-callback")
async def sms_callback(request: Request):
    """Africa's Talking incoming SMS callback.

    Flow:
    1. New SMS from a number → start research, reply with "pending" message.
    2. If agent needs clarification → send question via SMS.
    3. User replies → resume agent with their answer.
    4. On completion → send the research URL via SMS.
    """
    # AT sends form-encoded data
    form = await request.form()
    text = form.get("text", "")
    sender = form.get("from", "")

    if not text or not sender:
        return JSONResponse({"error": "Missing text or from"}, status_code=400)

    text = str(text).strip()
    sender = str(sender).strip()
    print(f"[sms-cb] Incoming from {sender}: {text[:100]}")

    if not _at_sms:
        print("[sms-cb] SMS service not configured — cannot respond")
        return {"status": "received", "note": "SMS service disabled"}

    session = _sms_sessions.get(sender)

    # ── Resuming an existing conversation that asked for clarification ──
    if session and session["status"] == "awaiting_clarification":
        thread_id = session["thread_id"]
        print(f"[sms-cb] Resuming thread {thread_id[:8]} for {sender}")

        confirmation = "Got it! Processing your answer..."
        await asyncio.to_thread(
            _send_sms_sync, sender,
            confirmation,
        )

        asyncio.create_task(_resume_sms_research(sender, text, thread_id))
        return {"status": "resuming", "thread_id": thread_id}

    # ── New research request ──
    thread_id = str(uuid.uuid4())
    _sms_sessions[sender] = {"thread_id": thread_id,
                             "status": "pending", "query": text}
    print(
        f"[sms-cb] New research thread={thread_id[:8]} for {sender}: {text[:80]}")

    pending_msg = await asyncio.to_thread(_generate_pending_message, text)
    await asyncio.to_thread(
        _send_sms_sync, sender,
        pending_msg,
    )

    asyncio.create_task(_run_sms_research(sender, text, thread_id))
    return {"status": "started", "thread_id": thread_id}


def _print_step(text: str, style: str = "info"):
    colors = {
        "info": "\033[36m",     # cyan
        "success": "\033[32m",  # green
        "warning": "\033[33m",  # yellow
        "error": "\033[31m",    # red
        "bold": "\033[1m",
        "reset": "\033[0m",
    }
    prefix = colors.get(style, "")
    reset = colors["reset"]
    print(f"{prefix}{text}{reset}")


def run_terminal():
    """Interactive terminal mode for testing the research agent."""
    load_dotenv()

    _print_step("=" * 60, "bold")
    _print_step("  Research Agent — Interactive Terminal", "bold")
    _print_step("=" * 60, "bold")
    _print_step(
        "Type your research question below. Type 'quit' to exit.\n", "info")

    while True:
        try:
            query = input("\033[1mResearch Query > \033[0m").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            _print_step("Goodbye!", "success")
            break

        if not query:
            continue
        if query.lower() in ("quit", "exit", "q"):
            _print_step("Goodbye!", "success")
            break

        thread_id = str(uuid.uuid4())
        config = RunnableConfig(configurable={"thread_id": thread_id})

        initial_state: ResearchState = {
            "messages": [{"role": "user", "content": query}],# type: ignore[not Assignable to ResearchState]
            "research_query": query,
            "search_queries": [],
            "search_results": [],
            "draft_answer": "",
            "citations": [],
            "reflection": "",
            "iteration_count": 0,
            "max_iterations": 3,
            "errors": [],
            "final_answer": "",
        }

        _print_step(
            f"\n--- Starting research (thread: {thread_id[:8]}...) ---", "info")

        try:
            # Stream node updates
            for chunk in graph.stream(initial_state, config, stream_mode="updates"):
                for node_name, update in chunk.items():
                    if node_name == "__interrupt__":
                        # Clarification needed
                        interrupt_val = update[0].value if isinstance(
                            update, list) else update
                        question = interrupt_val.get("question", str(interrupt_val)) if isinstance(
                            interrupt_val, dict) else str(interrupt_val)
                        _print_step(
                            f"\n[Clarification Needed] {question}", "warning")
                        try:
                            user_input = input(
                                "\033[33mYour response > \033[0m").strip()
                        except (EOFError, KeyboardInterrupt):
                            _print_step("Research cancelled.", "error")
                            break

                        for resume_chunk in graph.stream(
                            Command(resume=user_input), config, stream_mode="updates"
                        ):
                            for rn, ru in resume_chunk.items():
                                if rn == "__interrupt__":
                                    int_val = ru[0].value if isinstance(
                                        ru, list) else ru
                                    q = int_val.get("question", str(int_val)) if isinstance(
                                        int_val, dict) else str(int_val)
                                    _print_step(
                                        f"\n[Clarification Needed] {q}", "warning")
                                    try:
                                        user_input = input(
                                            "\033[33mYour response > \033[0m").strip()
                                    except (EOFError, KeyboardInterrupt):
                                        _print_step(
                                            "Research cancelled.", "error")
                                        break
                                else:
                                    _print_step(f"  [{rn}] completed", "info")
                    else:
                        _print_step(f"  [{node_name}] completed", "info")
            final_state = graph.get_state(config)
            final_answer = final_state.values.get("final_answer", "")

            if final_answer:
                _print_step("\n" + "=" * 60, "success")
                _print_step("FINAL ANSWER:", "bold")
                _print_step("=" * 60, "success")
                print(final_answer)
                _print_step("=" * 60, "success")
            else:
                _print_step(
                    "\nNo final answer produced. Check errors above.", "warning")

        except Exception as e:
            _print_step(
                f"\nError during research: {type(e).__name__}: {e}", "error")

        print()


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "serve":
        import uvicorn
        uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
    else:
        run_terminal()
