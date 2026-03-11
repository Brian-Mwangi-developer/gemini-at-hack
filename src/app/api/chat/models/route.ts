export async function GET() {
    const providers = [
        {
            provider: "google",
            hasAPIKey: !!process.env.GOOGLE_API_KEY,
            models: [
                { name: "gemini-3.1-pro-preview", displayName: "Gemini 3.1 Pro", isToolCallSupported: true },
                { name: "gemini-3-flash-preview", displayName: "Gemini 3 Flash", isToolCallSupported: true },
                { name: "gemini-2.5-flash", displayName: "Gemini 2.5 Flash", isToolCallSupported: true },
                { name: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro", isToolCallSupported: true },
            ],
        },
        {
            provider: "openai",
            hasAPIKey: !!process.env.OPENAI_API_KEY,
            models: [
                { name: "gpt-5.4", displayName: "GPT-5.4 Thinking", isToolCallSupported: true },
                { name: "gpt-5.3-chat-latest", displayName: "GPT-5.3 Instant", isToolCallSupported: true },
                { name: "gpt-5.2", displayName: "GPT-5.2 Thinking", isToolCallSupported: true },
                { name: "gpt-5", displayName: "GPT-5", isToolCallSupported: true },
            ],
        },
        {
            provider: "anthropic",
            hasAPIKey: !!process.env.ANTHROPIC_API_KEY,
            models: [
                { name: "claude-opus-4-6", displayName: "Claude Opus 4.6", isToolCallSupported: true },
                { name: "claude-sonnet-4-6", displayName: "Claude Sonnet 4.6", isToolCallSupported: true },
                { name: "claude-haiku-4-5-20251001", displayName: "Claude Haiku 4.5", isToolCallSupported: true },
            ],
        },
    ];

    return Response.json(providers);
}