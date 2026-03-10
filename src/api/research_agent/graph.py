"""Graph construction for the research agent with subgraphs."""

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import RetryPolicy

from research_agent.nodes import (
    analyze_results_node,
    clarify_node,
    execute_search_node,
    intake_node,
    plan_search_node,
    reflect_node,
    synthesize_node,
)
from research_agent.state import ResearchState, SearchSubgraphState


# ---------------------------------------------------------------------------
# Search Subgraph
# ---------------------------------------------------------------------------

def _build_search_subgraph() -> StateGraph:
    """Build the search subgraph: plan -> execute -> analyze."""
    builder = StateGraph(SearchSubgraphState)

    # Nodes with retry policy for network resilience
    retry = RetryPolicy(max_attempts=3)

    builder.add_node("plan_search", plan_search_node)
    builder.add_node("execute_search", execute_search_node)
    builder.add_node("analyze_results", analyze_results_node)

    # Edges
    builder.add_edge(START, "plan_search")
    builder.add_edge("plan_search", "execute_search")
    # execute_search uses Command to go to analyze_results
    builder.add_edge("analyze_results", END)

    return builder.compile()


# ---------------------------------------------------------------------------
# Main Research Graph
# ---------------------------------------------------------------------------

def build_research_graph():
    """Build and compile the full research agent graph."""
    builder = StateGraph(ResearchState)

    retry = RetryPolicy(max_attempts=3)

    # Add nodes
    builder.add_node("intake", intake_node)
    builder.add_node("clarify", clarify_node)
    builder.add_node("plan_search", plan_search_node)
    builder.add_node("execute_search", execute_search_node)
    builder.add_node("analyze_results", analyze_results_node)
    builder.add_node("reflect", reflect_node)
    builder.add_node("synthesize", synthesize_node)

    # Entry point
    builder.add_edge(START, "intake")
    # intake uses Command routing → plan_search or clarify
    # clarify uses Command routing → intake

    # Search flow
    builder.add_edge("plan_search", "execute_search")
    # execute_search uses Command → analyze_results
    builder.add_edge("analyze_results", "reflect")
    # reflect uses Command → plan_search, synthesize, or clarify

    # Terminal
    builder.add_edge("synthesize", END)

    # Compile with checkpointer for interrupt support
    checkpointer = MemorySaver()
    graph = builder.compile(checkpointer=checkpointer)
    return graph
