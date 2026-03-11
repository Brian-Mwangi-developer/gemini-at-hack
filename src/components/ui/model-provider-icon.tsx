import { BlendIcon } from "lucide-react";
import { ClaudeIcon } from "./claude-icon";
import { GeminiIcon } from "./gemini-icon";
import { OpenAIIcon } from "./openai-icon";


export function ModelProviderIcon({
    provider,
    className

}: { provider: string; className?: string }) {
    if (provider === "google") {
        return <GeminiIcon className={className} />;
    }
    if (provider === "openai") {
        return <OpenAIIcon className={className} />;
    }
    if (provider === "anthropic") {
        return <ClaudeIcon className={className} />;
    }
    return <BlendIcon className={className} />;
}