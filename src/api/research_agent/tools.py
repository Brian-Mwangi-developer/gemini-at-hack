"""Exa search tools for the research agent."""

import os

from exa_py import Exa
from langchain_core.tools import tool


def _get_exa_client() -> Exa:
    api_key = os.environ.get("EXA_API_KEY")
    if not api_key:
        raise RuntimeError("EXA_API_KEY environment variable is not set")
    return Exa(api_key=api_key)


@tool
def exa_search(query: str, num_results: int = 5) -> list[dict]:
    """Search the web using Exa for a given query.

    Args:
        query: The search query string.
        num_results: Number of results to return (default 5).

    Returns:
        A list of dicts with 'title', 'url', and 'text' keys.
    """
    client = _get_exa_client()
    response = client.search_and_contents(
        query=query,
        num_results=num_results,
        text=True,
    )
    results = []
    for r in response.results:
        results.append({
            "title": r.title or "",
            "url": r.url,
            "text": (r.text or "")[:2000],  # Truncate for context window
        })
    return results


@tool
def exa_find_similar(url: str, num_results: int = 3) -> list[dict]:
    """Find pages similar to a given URL using Exa.

    Args:
        url: The reference URL to find similar content for.
        num_results: Number of similar results to return.

    Returns:
        A list of dicts with 'title', 'url', and 'text' keys.
    """
    client = _get_exa_client()
    response = client.find_similar_and_contents(
        url=url,
        num_results=num_results,
        text=True,
    )
    results = []
    for r in response.results:
        results.append({
            "title": r.title or "",
            "url": r.url,
            "text": (r.text or "")[:2000],
        })
    return results


# All tools available to the agent
ALL_TOOLS = [exa_search, exa_find_similar]
TOOLS_BY_NAME = {t.name: t for t in ALL_TOOLS}
