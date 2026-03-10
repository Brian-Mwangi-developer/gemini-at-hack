
export async function POST(req: Request) {
  const body = await req.json();

  const backendUrl = process.env.FASTAPI_URL ?? "http://localhost:8000";

  const upstream = await fetch(`${backendUrl}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!upstream.ok || !upstream.body) {
    return new Response(
      JSON.stringify({ error: "Backend request failed" }),
      { status: upstream.status, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "x-vercel-ai-ui-message-stream":
        upstream.headers.get("x-vercel-ai-ui-message-stream") ?? "v1",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
