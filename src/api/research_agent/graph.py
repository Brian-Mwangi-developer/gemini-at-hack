"""Graph construction for the research agent with subgraphs."""

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import RetryPolicy

from research_agent.council import (
    council_dispatch_node,
    council_synthesize_node,
)
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
# Main Research Graph
# ---------------------------------------------------------------------------

def build_research_graph():
    """Build and compile the full research agent graph."""
    builder = StateGraph(ResearchState)

    
    # Add nodes
    builder.add_node("intake", intake_node)
    builder.add_node("clarify", clarify_node)
    builder.add_node("plan_search", plan_search_node)
    builder.add_node("execute_search", execute_search_node)
    builder.add_node("analyze_results", analyze_results_node)
    builder.add_node("reflect", reflect_node)
    builder.add_node("synthesize", synthesize_node)
    builder.add_node("council_dispatch", council_dispatch_node)
    builder.add_node("council_synthesize", council_synthesize_node)

    # Entry point
    builder.add_edge(START, "intake")    
    builder.add_edge("plan_search", "execute_search")
    builder.add_edge("analyze_results", "reflect")
    builder.add_edge("synthesize", END)

    builder.add_edge("council_dispatch", "council_synthesize")
    builder.add_edge("council_synthesize", END)

    checkpointer = MemorySaver()
    graph = builder.compile(checkpointer=checkpointer)
    return graph
