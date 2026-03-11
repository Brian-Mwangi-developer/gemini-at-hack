
export async function GET() {
    const providers = [
        {
            provider: "google",
            hasAPIKey: !!process.env.GOOGLE_API_KEY,
            models: [
                { name: "gemini-3.1-pro", displayName: "Gemini 3.1 Pro", isToolCallSupported: true },
                { name: "gemini-3-flash-preview", displayName: "Gemini 3 Flash", isToolCallSupported: true },
                { name: "gemini-2.5-flash", displayName: "Gemini 2.5 Flash", isToolCallSupported: true },
                { name: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro", isToolCallSupported: true },
            ],
        },
        {
            provider: "openai",
            hasAPIKey: !!process.env.OPENAI_API_KEY,
            models: [
                { name: "gpt-4o", displayName: "GPT-4o", isToolCallSupported: true },
                { name: "gpt-4-turbo", displayName: "GPT-4 Turbo", isToolCallSupported: true },
                { name: "gpt-4", displayName: "GPT-4", isToolCallSupported: true },
                { name: "gpt-3.5-turbo", displayName: "GPT-3.5 Turbo", isToolCallSupported: true },
            ],
        },
       
        {
            provider: "anthropic",
            hasAPIKey: !!process.env.ANTHROPIC_API_KEY,
            models: [
                { name: "claude-opus-4-5", displayName: "Claude Opus 4.5", isToolCallSupported: true },
                { name: "claude-sonnet-4.5", displayName: "Claude Sonnet 4.5", isToolCallSupported: true },
                { name: "claude-haiku-4.5", displayName: "Claude Haiku 4.5", isToolCallSupported: true },
            ],
        },
    ];

    return Response.json(providers);
}
