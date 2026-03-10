
export async function GET() {
  return Response.json([
    {
      provider: "google",
      hasAPIKey: true,
      models: [
        { name: "gemini-3.1-pro-preview", isToolCallSupported: true },
        { name: "gemini-2.5-flash", isToolCallSupported: true },
        { name: "gemini-2.5-pro", isToolCallSupported: true },
      ],
    },
  ]);
}
