"""Node functions for the research agent graph."""

import json
import re
from typing import Literal

from langchain_core.messages import (AIMessage, HumanMessage, SystemMessage,
                                     ToolMessage)
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.types import Command, interrupt

from research_agent.state import ResearchState
from research_agent.tools import ALL_TOOLS, TOOLS_BY_NAME


def _get_llm() -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(
        model="gemini-3.1-pro-preview",
        temperature=0.2,
    )


def _extract_text(content: object) -> str:
    """Extract plain text from LLM response content (handles str or list of blocks)."""
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
    """Parse JSON from LLM text, stripping markdown fences if present."""
    # Strip markdown code fences like ```json ... ```
    cleaned = re.sub(r"```(?:json)?\s*", "", text).strip()
    cleaned = re.sub(r"```\s*$", "", cleaned).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Try finding the first JSON object
        start = cleaned.find("{")
        end = cleaned.rfind("}") + 1
        if start != -1 and end > start:
            return json.loads(cleaned[start:end])
        raise


# ---------------------------------------------------------------------------
# Intake Node
# ---------------------------------------------------------------------------

def intake_node(state: ResearchState) -> Command[Literal["plan_search", "clarify", "council_dispatch"]]:
    """Analyze the user's research query and decide whether to search or clarify."""
    llm = _get_llm()

    # If council mode, skip clarification — always search. Then route to council_dispatch.
    council_on = state.get("council_mode")
    print(f"[intake] council_mode={council_on}  council_models={[m.get('model','?') for m in state.get('council_models', [])]}")
    if council_on:
        system = SystemMessage(content=(
            "You are a research planning assistant. Analyze the user's research query. "
            "Produce 3-5 focused search queries that will help answer it comprehensively. "
            "Respond ONLY with a JSON object:\n"
            '{"queries": ["query1", "query2", ...]}\n'
            "Respond with valid JSON only, no markdown."
        ))
        messages = [system] + state["messages"]
        response = llm.invoke(messages)
        content = _extract_text(response.content)

        try:
            parsed = _parse_json_response(content)
            queries = parsed.get("queries", [state["research_query"]])
        except (json.JSONDecodeError, ValueError):
            queries = [state["research_query"]]

        return Command(
            update={
                "search_queries": queries,
                "messages": [AIMessage(content=f"Council mode: planning search with queries: {queries}")],
            },
            goto="council_dispatch",
        )

    system = SystemMessage(content=(
        "You are a research planning assistant. Analyze the user's research query. "
        "If the query is clear enough to begin research, produce 2-5 focused search "
        "queries that will help answer it comprehensively. Respond ONLY with a JSON object:\n"
        '{"action": "search", "queries": ["query1", "query2", ...]}\n\n'
        "If the query is too vague or ambiguous and you need more details, respond with:\n"
        '{"action": "clarify", "question": "your clarification question"}\n\n'
        "Respond with valid JSON only, no markdown."
    ))

    messages = [system] + state["messages"]
    response = llm.invoke(messages)
    content = _extract_text(response.content)

    try:
        parsed = _parse_json_response(content)
    except (json.JSONDecodeError, ValueError):
        parsed = {"action": "search", "queries": [state["research_query"]]}

    if parsed.get("action") == "clarify":
        return Command(
            update={
                "messages": [AIMessage(content=parsed["question"])],
            },
            goto="clarify",
        )

    return Command(
        update={
            "search_queries": parsed.get("queries", [state["research_query"]]),
            "messages": [AIMessage(content=f"Planning search with queries: {parsed.get('queries', [])}")],
            "iteration_count": 0,
            "max_iterations": 3,
        },
        goto="plan_search",
    )


# ---------------------------------------------------------------------------
# Clarify Node (Human-in-the-Loop)
# ---------------------------------------------------------------------------

def clarify_node(state: ResearchState) -> Command[Literal["intake"]]:
    """Pause execution and ask the user for clarification."""
    # Find the last AI message to use as the clarification question
    last_ai_msg = None
    for msg in reversed(state["messages"]):
        if isinstance(msg, AIMessage):
            last_ai_msg = msg
            break

    question = last_ai_msg.content if last_ai_msg else "Could you provide more details about your research question?"

    # Interrupt and wait for user input
    user_response = interrupt({
        "type": "clarification",
        "question": question,
    })

    return Command(
        update={
            "messages": [HumanMessage(content=user_response)],
            "research_query": f"{state.get('research_query', '')} — Additional context: {user_response}",
        },
        goto="intake",
    )


# ---------------------------------------------------------------------------
# Plan Search Node
# ---------------------------------------------------------------------------

def plan_search_node(state: ResearchState) -> dict:
    """Prepare search queries. If we're iterating, the LLM refines queries based on gaps."""
    iteration = state.get("iteration_count", 0)

    if iteration == 0:
        # First pass — queries already set by intake
        return {
            "messages": [AIMessage(content=f"Executing search iteration {iteration + 1}")],
        }

    # On subsequent iterations, ask the LLM to refine queries based on reflection
    llm = _get_llm()
    reflection = state.get("reflection", "")
    draft = state.get("draft_answer", "")
    existing_results_count = len(state.get("search_results", []))

    system = SystemMessage(content=(
        "You are a research assistant refining your search strategy. Based on your "
        "reflection on gaps in the current draft, produce 2-3 NEW targeted search "
        "queries to fill those gaps. Respond ONLY with a JSON object:\n"
        '{"queries": ["query1", "query2", ...]}\n'
        "Respond with valid JSON only, no markdown."
    ))

    user_msg = HumanMessage(content=(
        f"Original research question: {state['research_query']}\n\n"
        f"Current draft answer:\n{draft}\n\n"
        f"Reflection on gaps:\n{reflection}\n\n"
        f"Results collected so far: {existing_results_count} sources\n"
        f"Produce new search queries to address the identified gaps."
    ))

    response = llm.invoke([system, user_msg])
    content = _extract_text(response.content)

    try:
        parsed = _parse_json_response(content)
        new_queries = parsed.get("queries", [state["research_query"]])
    except (json.JSONDecodeError, ValueError, KeyError):
        new_queries = [state["research_query"]]

    return {
        "search_queries": new_queries,
        "messages": [AIMessage(content=f"Refined search queries for iteration {iteration + 1}: {new_queries}")],
    }


# ---------------------------------------------------------------------------
# Execute Search Node (with error handling)
# ---------------------------------------------------------------------------

def execute_search_node(state: ResearchState) -> Command[Literal["analyze_results"]]:
    """Execute Exa searches for all planned queries. Handles errors gracefully."""
    queries = state.get("search_queries", [])
    all_results = []
    errors = []

    for query in queries:
        try:
            results = TOOLS_BY_NAME["exa_search"].invoke(
                {"query": query, "num_results": 5})
            if isinstance(results, list):
                all_results.extend(results)
            else:
                all_results.append(
                    {"title": "Search result", "url": "", "text": str(results)})
        except Exception as e:
            error_msg = f"Search error for '{query}': {type(e).__name__}: {str(e)}"
            errors.append(error_msg)

    if not all_results and errors:
        # All searches failed — store errors and let LLM see them
        return Command(
            update={
                "errors": errors,
                "messages": [AIMessage(content=f"All searches failed. Errors:\n" + "\n".join(errors))],
            },
            goto="analyze_results",
        )

    return Command(
        update={
            "search_results": all_results,
            "errors": errors if errors else [],
            "messages": [AIMessage(content=f"Found {len(all_results)} results across {len(queries)} queries.")],
        },
        goto="analyze_results",
    )


# ---------------------------------------------------------------------------
# Analyze Results Node
# ---------------------------------------------------------------------------

def analyze_results_node(state: ResearchState) -> dict:
    """LLM analyzes search results and produces a draft answer."""
    llm = _get_llm()
    results = state.get("search_results", [])
    errors = state.get("errors", [])

    # Format results for the LLM
    formatted_sources = []
    for i, r in enumerate(results, 1):
        formatted_sources.append(
            f"[Source {i}] {r.get('title', 'Untitled')}\n"
            f"URL: {r.get('url', 'N/A')}\n"
            f"Content: {r.get('text', 'No content')[:1500]}\n"
        )

    sources_text = "\n---\n".join(
        formatted_sources) if formatted_sources else "No search results available."
    errors_text = "\n".join(errors) if errors else "None"

    system = SystemMessage(content=(
        "You are a research analyst. Analyze the provided search results and produce "
        "a comprehensive draft answer to the research question. Include inline citations "
        "using [Source N] notation. If search results are insufficient, note what's missing. "
        "If there were search errors, acknowledge them and work with what you have."
    ))

    user_msg = HumanMessage(content=(
        f"Research question: {state['research_query']}\n\n"
        f"Search results:\n{sources_text}\n\n"
        f"Search errors encountered:\n{errors_text}\n\n"
        f"Previous draft (if any): {state.get('draft_answer', 'None')}\n\n"
        "Produce a comprehensive draft answer with [Source N] citations."
    ))

    response = llm.invoke([system, user_msg])

    # Extract citations from results
    citations = []
    for i, r in enumerate(results, 1):
        citations.append({
            "source_number": i,
            "title": r.get("title", "Untitled"),
            "url": r.get("url", ""),
        })

    return {
        "draft_answer": _extract_text(response.content),
        "citations": citations,
        "messages": [AIMessage(content="Draft answer produced. Moving to reflection.")],
    }


# ---------------------------------------------------------------------------
# Reflect Node
# ---------------------------------------------------------------------------

def reflect_node(state: ResearchState) -> Command[Literal["plan_search", "synthesize", "clarify"]]:
    """Reflect on the draft answer quality and decide next steps."""
    llm = _get_llm()
    iteration = state.get("iteration_count", 0)
    max_iter = state.get("max_iterations", 3)

    system = SystemMessage(content=(
        "You are a critical research reviewer. Evaluate the draft answer for:\n"
        "1. Completeness — does it fully answer the research question?\n"
        "2. Accuracy — are claims well-supported by the cited sources?\n"
        "3. Gaps — what important aspects are missing?\n"
        "4. Clarity — is the answer well-organized and clear?\n\n"
        "Respond ONLY with a JSON object:\n"
        '{"quality": "good" | "needs_improvement" | "needs_clarification",\n'
        ' "reflection": "your detailed assessment",\n'
        ' "clarification_question": "question for user (only if needs_clarification)"}\n'
        "Respond with valid JSON only, no markdown."
    ))

    user_msg = HumanMessage(content=(
        f"Research question: {state['research_query']}\n\n"
        f"Draft answer:\n{state.get('draft_answer', 'No draft')}\n\n"
        f"Sources used: {len(state.get('citations', []))}\n"
        f"Iteration: {iteration + 1} of {max_iter}\n"
        f"Errors encountered: {state.get('errors', [])}\n"
    ))

    response = llm.invoke([system, user_msg])
    content = _extract_text(response.content)

    try:
        parsed = _parse_json_response(content)
    except (json.JSONDecodeError, ValueError):
        parsed = {"quality": "good", "reflection": content}

    quality = parsed.get("quality", "good")
    reflection = parsed.get("reflection", "")

    # If max iterations reached, force synthesis
    if iteration + 1 >= max_iter:
        return Command(
            update={
                "reflection": reflection,
                "iteration_count": iteration + 1,
                "messages": [AIMessage(content=f"Reflection (iteration {iteration + 1}): Max iterations reached. Synthesizing final answer.\n{reflection}")],
            },
            goto="synthesize",
        )

    if quality == "needs_clarification":
        clarification_q = parsed.get(
            "clarification_question", "Could you provide more context?")
        return Command(
            update={
                "reflection": reflection,
                "messages": [AIMessage(content=clarification_q)],
            },
            goto="clarify",
        )

    if quality == "needs_improvement":
        return Command(
            update={
                "reflection": reflection,
                "iteration_count": iteration + 1,
                "messages": [AIMessage(content=f"Reflection (iteration {iteration + 1}): Needs improvement. Iterating.\n{reflection}")],
            },
            goto="plan_search",
        )

    # Quality is good
    return Command(
        update={
            "reflection": reflection,
            "iteration_count": iteration + 1,
            "messages": [AIMessage(content=f"Reflection: Answer quality is good. Synthesizing final answer.\n{reflection}")],
        },
        goto="synthesize",
    )


# ---------------------------------------------------------------------------
# Synthesize Node
# ---------------------------------------------------------------------------

def synthesize_node(state: ResearchState) -> dict:
    """Produce the final polished answer with proper citations."""
    llm = _get_llm()
    citations = state.get("citations", [])

    # Build citation reference
    citation_list = []
    for c in citations:
        citation_list.append(
            f"[{c['source_number']}] {c['title']} — {c['url']}")
    citations_text = "\n".join(
        citation_list) if citation_list else "No citations available."

    system = SystemMessage(content=(
        "You are a research writer producing a final, polished answer. "
        "Refine the draft into a clear, well-structured response. "
        "Use numbered inline citations like [1], [2], etc. "
        "End with a '## Sources' section listing all cited sources with their URLs. "
        "Make the answer comprehensive yet concise."
    ))

    user_msg = HumanMessage(content=(
        f"Research question: {state['research_query']}\n\n"
        f"Draft answer:\n{state.get('draft_answer', '')}\n\n"
        f"Reflection notes:\n{state.get('reflection', '')}\n\n"
        f"Available citations:\n{citations_text}\n\n"
        "Produce the final polished answer with proper citations."
    ))

    response = llm.invoke([system, user_msg])
    answer = _extract_text(response.content)

    return {
        "final_answer": answer,
        "messages": [AIMessage(content=answer)],
    }
