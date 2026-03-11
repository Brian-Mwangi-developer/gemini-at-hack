"""State definitions for the research agent."""

import operator
from typing import Annotated, TypedDict

from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages


class ResearchState(TypedDict):
    """Main state for the research agent graph."""

    # Core message history (LLM conversation)
    messages: Annotated[list[AnyMessage], add_messages]

    # The user's original research query
    research_query: str

    # Search queries planned by the LLM
    search_queries: list[str]

    # Raw search results from Exa
    search_results: Annotated[list[dict], operator.add]

    # Current draft answer being refined
    draft_answer: str

    # Collected citations
    citations: Annotated[list[dict], operator.add]

    # Reflection notes on quality/completeness
    reflection: str

    # Track iteration count for search loops
    iteration_count: int

    # Maximum allowed iterations
    max_iterations: int

    # Error log so the LLM can see what went wrong
    errors: Annotated[list[str], operator.add]

    # Final synthesized answer
    final_answer: str

    # ── Council mode fields ──────────────────────────────────────────────
    council_mode: bool
    # List of {"provider": str, "model": str} for each council agent
    council_models: list[dict]
    # Per-model results: {model_display_name: {draft, citations, steps, ...}}
    council_results: dict
    # The final council synthesis (agreement/disagreement/unique tables + report)
    council_synthesized_answer: str


class SearchSubgraphState(TypedDict):
    """State for the search subgraph."""

    messages: Annotated[list[AnyMessage], add_messages]
    search_queries: list[str]
    search_results: Annotated[list[dict], operator.add]
    errors: Annotated[list[str], operator.add]
    iteration_count: int
