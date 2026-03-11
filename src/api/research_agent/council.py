"""Council mode: run multiple LLM agents in parallel, then synthesize."""

import json
import os
import re
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from research_agent.state import ResearchState
from research_agent.tools import TOOLS_BY_NAME

# ── LLM factories per provider ──────────────────────────────────────────────

_LLM_FACTORIES = {
    "google": lambda model: ChatGoogleGenerativeAI(model=model, temperature=0.2),
    "openai": lambda model: ChatOpenAI(model=model, temperature=0.2),
    "anthropic": lambda model: ChatAnthropic(model_name=model, temperature=0.2), # type: ignore[call-arg]
}

# Human-readable display names for council models
MODEL_DISPLAY_NAMES = {
    "gemini-3.1-pro-preview": "Gemini 3 Pro",
    "gpt-5.2": "GPT-5.2 Thinking",
    "claude-sonnet-4-6": "Claude Sonnet 4.6",
    "claude-opus-4-6": "Claude Opus 4.6",
}

# Provider icons (frontend identifiers)
PROVIDER_ICONS = {
    "google": "G",
    "openai": "O",
    "anthropic": "A",
}


def _get_llm(provider: str, model: str):
    factory = _LLM_FACTORIES.get(provider)
    if not factory:
        raise ValueError(f"Unknown provider: {provider}")
    return factory(model)


def _extract_text(content: object) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict) and "text" in block:
                parts.append(block["text"])
            elif isinstance(block, str):
                parts.append(block)
        return "\n".join(parts)
    return str(content)


def _parse_json_response(text: str) -> dict:
    cleaned = re.sub(r"```(?:json)?\s*", "", text).strip()
    cleaned = re.sub(r"```\s*$", "", cleaned).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}") + 1
        if start != -1 and end > start:
            return json.loads(cleaned[start:end])
        raise


def _run_single_agent(
    provider: str,
    model: str,
    research_query: str,
    on_step: Any = None,
) -> dict:
    """Run a full research pipeline for one model. Returns the result dict.

    on_step(model_key, node_name, label, detail) is called for progress updates.
    """
    display_name = MODEL_DISPLAY_NAMES.get(model, model)
    model_key = f"{provider}/{model}"
    llm = _get_llm(provider, model)

    steps_log = []

    def _emit(node: str, label: str, detail: str = ""):
        steps_log.append({"node": node, "label": label, "detail": detail})
        if on_step:
            on_step(model_key, node, label, detail)

    _emit("intake", "Analyzing Query")

    agent_description = ""
    try:
        intake_sys = SystemMessage(content=(
            "You are a research planning assistant. Analyze the user's research query. "
            "Produce 3-5 focused search queries that will help answer it comprehensively. "
            "Also produce a brief one-sentence description of your research approach. "
            "Respond ONLY with a JSON object:\n"
            '{"queries": ["query1", "query2", ...], "description": "brief one-sentence research plan"}\n'
            "Respond with valid JSON only, no markdown."
        ))
        intake_resp = llm.invoke(
            [intake_sys, HumanMessage(content=research_query)])
        intake_text = _extract_text(intake_resp.content)
        parsed = _parse_json_response(intake_text)
        search_queries = parsed.get("queries", [research_query])
        agent_description = parsed.get("description", "")
    except Exception:
        search_queries = [research_query]
    _emit("intake", "Analyzing Query", agent_description or "Query understood")

    all_results = []
    all_citations = []
    all_errors = []
    draft_answer = ""
    reflection = ""
    max_iterations = 2

    for iteration in range(max_iterations):
        if iteration > 0:
            _emit("plan_search", "Refining Search Strategy")
            try:
                refine_sys = SystemMessage(content=(
                    "You are a research assistant refining search. Based on reflection, "
                    "produce 2-3 NEW targeted queries. Respond ONLY with JSON:\n"
                    '{"queries": ["query1", "query2", ...]}\n'
                    "Respond with valid JSON only."
                ))
                refine_resp = llm.invoke([
                    refine_sys,
                    HumanMessage(content=(
                        f"Question: {research_query}\n\n"
                        f"Current draft:\n{draft_answer}\n\n"
                        f"Reflection:\n{reflection}\n\n"
                        "Produce new queries to fill gaps."
                    )),
                ])
                new_qs = _parse_json_response(
                    _extract_text(refine_resp.content))
                search_queries = new_qs.get("queries", [research_query])
            except Exception:
                search_queries = [research_query]
            _emit("plan_search", "Refining Search Strategy",
                  f"{len(search_queries)} queries planned")
        else:
            _emit("plan_search", "Planning Search Strategy",
                  f"{len(search_queries)} queries planned")

        _emit("execute_search", "Searching the Web")
        iter_results = []
        for q in search_queries:
            try:
                results = TOOLS_BY_NAME["exa_search"].invoke(
                    {"query": q, "num_results": 5}
                )
                if isinstance(results, list):
                    iter_results.extend(results)
                else:
                    iter_results.append(
                        {"title": "Search result",
                            "url": "", "text": str(results)}
                    )
            except Exception as e:
                all_errors.append(
                    f"Search error for '{q}': {type(e).__name__}: {e}")
        all_results.extend(iter_results)
        _emit("execute_search", "Searching the Web",
              f"{len(iter_results)} results found")

        _emit("analyze_results", "Analyzing Results")
        formatted_sources = []
        for i, r in enumerate(all_results, 1):
            formatted_sources.append(
                f"[Source {i}] {r.get('title', 'Untitled')}\n"
                f"URL: {r.get('url', 'N/A')}\n"
                f"Content: {r.get('text', 'No content')[:1500]}"
            )
        sources_text = "\n---\n".join(
            formatted_sources) if formatted_sources else "No results."

        analyze_sys = SystemMessage(content=(
            "You are a research analyst. Analyze search results and produce a comprehensive "
            "draft answer with inline citations using [Source N] notation. "
            "Include specific data, statistics, and findings. Be thorough."
        ))
        analyze_resp = llm.invoke([
            analyze_sys,
            HumanMessage(content=(
                f"Research question: {research_query}\n\n"
                f"Search results:\n{sources_text}\n\n"
                f"Previous draft: {draft_answer or 'None'}\n\n"
                "Produce a comprehensive draft answer with [Source N] citations."
            )),
        ])
        draft_answer = _extract_text(analyze_resp.content)

        citations = []
        for i, r in enumerate(all_results, 1):
            citations.append({
                "source_number": i,
                "title": r.get("title", "Untitled"),
                "url": r.get("url", ""),
            })
        all_citations = citations
        _emit("analyze_results", "Analyzing Results",
              f"{len(citations)} sources extracted")

        _emit("reflect", "Evaluating Answer Quality")
        try:
            reflect_sys = SystemMessage(content=(
                "You are a critical research reviewer. Evaluate the draft answer. "
                "Respond ONLY with JSON:\n"
                '{"quality": "good" | "needs_improvement",\n'
                ' "reflection": "your assessment"}\n'
                "Respond with valid JSON only."
            ))
            reflect_resp = llm.invoke([
                reflect_sys,
                HumanMessage(content=(
                    f"Question: {research_query}\n\n"
                    f"Draft:\n{draft_answer}\n\n"
                    f"Iteration: {iteration + 1} of {max_iterations}\n"
                )),
            ])
            reflect_parsed = _parse_json_response(
                _extract_text(reflect_resp.content))
            quality = reflect_parsed.get("quality", "good")
            reflection = reflect_parsed.get("reflection", "")
        except Exception:
            quality = "good"
            reflection = ""
        _emit("reflect", "Evaluating Answer Quality", reflection[:120])

        if quality == "good":
            break

    return {
        "model_key": model_key,
        "provider": provider,
        "model": model,
        "display_name": display_name,
        "draft_answer": draft_answer,
        "citations": all_citations,
        "errors": all_errors,
        "steps": steps_log,
        "search_results_count": len(all_results),
    }


# ── Council dispatch node ────────────────────────────────────────────────────

def council_dispatch_node(state: ResearchState) -> dict:
    """Run all council agents in parallel after intake."""
    council_models = state.get("council_models", [])
    research_query = state.get("research_query", "")
    model_keys = [f"{m.get('provider')}/{m.get('model')}" for m in council_models]
    print(f"[council_dispatch] models={model_keys}  query={research_query[:80]}")

    if not council_models:
        return {
            "council_results": {},
            "errors": ["No council models configured"],
            "messages": [AIMessage(content="No council models configured.")],
        }

    # Shared step events collected per model
    step_events: dict[str, list] = {}

    def on_step(model_key: str, node: str, label: str, detail: str = ""):
        if model_key not in step_events:
            step_events[model_key] = []
        step_events[model_key].append({
            "node": node, "label": label, "detail": detail,
        })

    results = {}
    # Run agents in parallel —
    with ThreadPoolExecutor(max_workers=len(council_models)) as pool:
        futures = {}
        for cm in council_models:
            future = pool.submit(
                _run_single_agent,
                cm["provider"],
                cm["model"],
                research_query,
                on_step,
            )
            futures[future] = f"{cm['provider']}/{cm['model']}"

        for future in as_completed(futures):
            model_key = futures[future]
            try:
                result = future.result()
                results[model_key] = result
            except Exception as e:
                results[model_key] = {
                    "model_key": model_key,
                    "provider": model_key.split("/")[0],
                    "model": model_key.split("/")[1],
                    "display_name": model_key,
                    "draft_answer": f"Agent failed: {type(e).__name__}: {e}",
                    "citations": [],
                    "errors": [traceback.format_exc()],
                    "steps": [],
                    "search_results_count": 0,
                }

    return {
        "council_results": results,
        "messages": [AIMessage(content=f"Council agents completed. {len(results)} models responded.")],
    }


# ── Council synthesize node ──────────────────────────────────────────────────

def council_synthesize_node(state: ResearchState) -> dict:
    """Synthesize findings from all council agents into agreement/disagreement/unique tables."""
    council_results = state.get("council_results", {})
    research_query = state.get("research_query", "")

    if not council_results:
        return {
            "final_answer": "No council results to synthesize.",
            "council_synthesized_answer": "No council results to synthesize.",
            "messages": [AIMessage(content="No council results to synthesize.")],
        }

    # Use Gemini 3.1 Pro for synthesis
    synth_llm = ChatGoogleGenerativeAI(
        model="gemini-3.1-pro-preview", temperature=0.1
    )

    # Build per-model summaries for the synthesizer
    model_sections = []
    all_citations = []
    citation_offset = 0
    for model_key, result in council_results.items():
        display = result.get("display_name", model_key)
        provider = result.get("provider", "unknown")
        draft = result.get("draft_answer", "No answer")
        cites = result.get("citations", [])

        # Remap citation numbers to global numbering
        remapped_cites = []
        for c in cites:
            new_num = citation_offset + c.get("source_number", 0)
            remapped_cites.append({
                "source_number": new_num,
                "title": c.get("title", ""),
                "url": c.get("url", ""),
                "from_model": display,
            })
        all_citations.extend(remapped_cites)

        model_sections.append(
            f"### {display} ({provider})\n{draft}\n\n"
            f"Sources used: {len(cites)}"
        )
        citation_offset += len(cites)

    models_text = "\n\n---\n\n".join(model_sections)

    # Build citation reference
    citation_list = []
    for c in all_citations:
        citation_list.append(
            f"[{c['source_number']}] {c['title']} — {c['url']} (from {c['from_model']})"
        )
    citations_text = "\n".join(
        citation_list) if citation_list else "No citations."

    # Get model display names for table headers
    model_names = []
    for model_key, result in council_results.items():
        model_names.append(result.get("display_name", model_key))

    system = SystemMessage(content=(
        "You are a research synthesis expert analyzing responses from multiple AI models. "
        "Your job is to produce a comprehensive synthesis report.\n\n"
        "You MUST structure your response EXACTLY as follows (use markdown):\n\n"
        "## Where Models Agree\n\n"
        "Create a markdown table with these columns:\n"
        f"| Finding | {' | '.join(model_names)} | Evidence |\n"
        "For each agreed finding, put ✓ under each model that found it, "
        "and provide specific evidence with inline source references like `source_domain +N` "
        "where domain is shortened (e.g., `usafacts +2` means usafacts.org and 2 more sources).\n\n"
        "## Where Models Disagree\n\n"
        "Create a markdown table with these columns:\n"
        f"| Topic | {' | '.join(model_names)} | Why They Differ |\n"
        "For each disagreement, summarize each model's position and explain why they differ.\n\n"
        "## Unique Findings\n\n"
        "List findings that only one model discovered, crediting the model.\n\n"
        "## Detailed Research Summary\n\n"
        "Provide a comprehensive, well-structured research report synthesizing all findings. "
        "Use inline citations like [1], [2] etc. referencing the Sources section.\n\n"
        "## Sources\n\n"
        "List all unique sources used across all models with their URLs. "
        "Deduplicate sources that appear in multiple models.\n\n"
        "IMPORTANT: Be specific with data, statistics, and facts. Do not be vague. "
        "Each table cell should contain substantive content."
    ))

    user_msg = HumanMessage(content=(
        f"Research question: {research_query}\n\n"
        f"Model responses:\n\n{models_text}\n\n"
        f"All citations:\n{citations_text}\n\n"
        "Produce the synthesis report following the exact structure specified."
    ))

    response = synth_llm.invoke([system, user_msg])
    synthesized = _extract_text(response.content)

    return {
        "final_answer": synthesized,
        "council_synthesized_answer": synthesized,
        "citations": all_citations,
        "messages": [AIMessage(content=synthesized)],
    }
