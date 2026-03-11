"use client";

import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@/components/ui/hover-card";
import { ModelProviderIcon } from "@/components/ui/model-provider-icon";
import { cn, equal, truncateString } from "@/lib/utils";
import { ChatMetadata } from "@/types/chat";
import type { UseChatHelpers } from "@ai-sdk/react";
import { type UIMessage } from "ai";
import { Check, ChevronDown, ChevronUp, Copy, Info } from "lucide-react";
import { memo, useCallback, useRef, useState } from "react";
import { AgentSteps, type AgentStep } from "./agent-steps";
import { ClarificationInput } from "./clarification-input";
import {
    CouncilAgentCard,
    CouncilSynthesisCard,
    type CouncilAgentData,
} from "./council-agent-card";
import { MarkdownContent } from "./markdown-content";

// ─── Types ───────────────────────────────────────────────────────────────────

type ChatStatus = UseChatHelpers<UIMessage>["status"];

interface MessageListProps {
    messages: UIMessage[];
    status: ChatStatus;
    onClarificationSubmit: (toolCallId: string, output: string) => void;
}

interface PreviewMessageProps {
    message: UIMessage;
    isLastMessage: boolean;
    isLoading: boolean;
    messageIndex: number;
    onClarificationSubmit: (toolCallId: string, output: string) => void;
}


const CopyButton = memo(function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => setCopied(false), 2000);
        });
    }, [text]);

    return (
        <button
            onClick={handleCopy}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150 opacity-0 group-hover/message:opacity-100"
            aria-label="Copy message"
        >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
    );
});
CopyButton.displayName = "CopyButton";


const Thinking = memo(function ThinkingDots() {
    return (
        <span className="flex items-center gap-1 h-5 px-1">
            <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
            <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
            <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
        </span>
    );
});
Thinking.displayName = "Thinking";


const MAX_TEXT_LENGTH = 500;

const UserTextPart = memo(function UserTextPart({ text }: { text: string }) {
    const [expanded, setExpanded] = useState(false);
    const isLong = text.length > MAX_TEXT_LENGTH;
    const display = expanded || !isLong ? text : truncateString(text, MAX_TEXT_LENGTH);

    return (
        <div className="flex justify-end">
            <div
                className={cn(
                    "relative max-w-[75%] px-4 py-2.5 rounded-2xl rounded-tr-sm",
                    "bg-primary text-primary-foreground",
                    "text-sm leading-relaxed whitespace-pre-wrap wrap-break-word",
                )}
            >
                {isLong && !expanded && (
                    <div className="absolute pointer-events-none bg-linear-to-t from-primary to-transparent w-full h-12 bottom-0 left-0 rounded-b-2xl" />
                )}
                {display}
                {isLong && (
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="flex items-center gap-1 text-xs mt-1.5 opacity-80 hover:opacity-100"
                    >
                        {expanded ? (
                            <><ChevronUp className="size-3" /> Show Less</>
                        ) : (
                            <><ChevronDown className="size-3" /> Show More</>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
});
UserTextPart.displayName = "UserTextPart";


const MessageInfoCard = memo(function MessageInfoCard({
    metadata,
}: {
    metadata: ChatMetadata;
}) {
    const { chatModel, usage, responseTimeMs } = metadata;
    const hasInfo = chatModel || usage || responseTimeMs;
    if (!hasInfo) return null;

    return (
        <HoverCard openDelay={200} closeDelay={100}>
            <HoverCardTrigger asChild>
                <button
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150 opacity-0 group-hover/message:opacity-100"
                    aria-label="Message info"
                >
                    <Info className="size-3.5" />
                </button>
            </HoverCardTrigger>
            <HoverCardContent
                side="top"
                align="start"
                className="w-64 p-0 overflow-hidden"
            >
                <div className="flex flex-col">
                    {chatModel && (
                        <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-border/60">
                            <ModelProviderIcon
                                provider={chatModel.provider}
                                className="size-4 shrink-0 text-muted-foreground"
                            />
                            <div className="flex flex-col min-w-0">
                                <span className="text-xs font-medium text-foreground leading-tight">
                                    {chatModel.model}
                                </span>
                                <span className="text-[11px] text-muted-foreground capitalize">
                                    {chatModel.provider}
                                </span>
                            </div>
                        </div>
                    )}
                    {usage && (
                        <div className="px-3 py-2.5 flex flex-col gap-1.5 border-b border-border/60">
                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                                Token Usage
                            </span>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                                {usage.inputTokens !== undefined && (
                                    <>
                                        <span className="text-xs text-muted-foreground">Input</span>
                                        <span className="text-xs font-mono text-foreground text-right">
                                            {usage.inputTokens.toLocaleString()}
                                        </span>
                                    </>
                                )}
                                {usage.outputTokens !== undefined && (
                                    <>
                                        <span className="text-xs text-muted-foreground">Output</span>
                                        <span className="text-xs font-mono text-foreground text-right">
                                            {usage.outputTokens.toLocaleString()}
                                        </span>
                                    </>
                                )}
                                {usage.totalTokens !== undefined && (
                                    <>
                                        <span className="text-xs font-medium text-foreground border-t border-border/60 pt-1">Total</span>
                                        <span className="text-xs font-mono font-semibold text-primary text-right border-t border-border/60 pt-1">
                                            {usage.totalTokens.toLocaleString()}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                    {responseTimeMs !== undefined && (
                        <div className="px-3 py-2.5 flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Response time</span>
                            <span className="text-xs font-mono text-foreground">
                                {responseTimeMs >= 1000
                                    ? `${(responseTimeMs / 1000).toFixed(1)}s`
                                    : `${responseTimeMs}ms`}
                            </span>
                        </div>
                    )}
                </div>
            </HoverCardContent>
        </HoverCard>
    );
});
MessageInfoCard.displayName = "MessageInfoCard";


const AssistantTextPart = memo(function AssistantTextPart({
    text,
    message,
    showActions,
    isStreaming,
}: {
    text: string;
    message: UIMessage;
    showActions: boolean;
    isStreaming: boolean;
}) {
    const isEmpty = text.length === 0;
    const metadata = message.metadata as ChatMetadata | undefined;

    return (
        <div className="flex flex-col gap-1">
            <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap wrap-break-word">
                {isEmpty && isStreaming ? <Thinking /> : <MarkdownContent content={text} />}
            </div>
            {showActions && !isEmpty && (
                <div className="flex items-center -ml-1.5 h-6">
                    <CopyButton text={text} />
                    {metadata && <MessageInfoCard metadata={metadata} />}
                </div>
            )}
        </div>
    );
});
AssistantTextPart.displayName = "AssistantTextPart";

// ─── PurePreviewMessage ───────────────────────────────────────────────────────

const PurePreviewMessage = ({
    message,
    isLastMessage,
    isLoading,
    messageIndex,
    onClarificationSubmit,
}: PreviewMessageProps) => {
    const isUser = message.role === "user";
    const isStreaming = isLastMessage && isLoading;

    const parts = message.parts.filter((p) => p.type !== "step-start");
    if (!parts.length) return null;

    // ── Collect agent-step tool invocations into a stepper ───────────────
    // Deduplicate: if the same node appears multiple times (e.g. intake runs
    // in both the initial request and after a clarification resume), keep
    // only the LAST occurrence so the UI stays clean.
    const rawSteps: AgentStep[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let clarificationPart: any = null;
    const councilAgents: CouncilAgentData[] = [];
    let hasCouncilSynthesisRunning = false;

    for (const part of parts) {
        
        if (part.type.startsWith("tool-")) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const p = part as any;
            const toolName = p.type.split("-").slice(1).join("-");
            if (toolName === "agent_step") {
                const node = (p.input?.node ?? p.args?.node ?? "") as string;
                // Track if council_synthesize is still running
                if (node === "council_synthesize" && p.state !== "output-available") {
                    hasCouncilSynthesisRunning = true;
                }
                rawSteps.push({
                    node,
                    label: (p.input?.label ?? p.args?.label ?? p.input?.node ?? "Processing") as string,
                    status: p.state === "output-available" ? "completed" : "running",
                    detail: p.state === "output-available" ? ((p.output?.detail ?? "") as string) : "",
                });
            } else if (toolName === "ask_clarification") {
                clarificationPart = p;
            } else if (toolName === "council_agent") {
                const input = p.input ?? p.args ?? {};
                const output = p.output ?? {};
                councilAgents.push({
                    model_key: (input.model_key ?? "") as string,
                    display_name: (input.display_name ?? input.model_key ?? "") as string,
                    provider: (input.provider ?? "unknown") as string,
                    icon: (input.icon ?? "?") as string,
                    status: p.state === "output-available" ? "completed" : "running",
                    steps: (output.steps ?? []) as CouncilAgentData["steps"],
                    step_count: (output.step_count ?? 0) as number,
                    draft_answer: (output.draft_answer ?? "") as string,
                    citations: (output.citations ?? []) as CouncilAgentData["citations"],
                    errors: (output.errors ?? []) as string[],
                });
            }
        }
    }

    // Deduplicate by node name — keep the last occurrence of each node
    const seen = new Map<string, number>();
    for (let i = rawSteps.length - 1; i >= 0; i--) {
        if (!seen.has(rawSteps[i].node)) seen.set(rawSteps[i].node, i);
    }
    const agentSteps = rawSteps.filter((_, i) => {
        const step = rawSteps[i];
        return seen.get(step.node) === i;
    });

    // ── Collect text parts ──────────────────────────────────────────────
    const textParts = parts.filter(
        (p): p is Extract<typeof p, { type: "text" }> => p.type === "text",
    );

    return (
        <div
            className="w-full mx-auto max-w-3xl px-4 group/message"
            data-role={message.role}
        >
            <div className="flex flex-col gap-2 w-full">
                {isUser ? (
                    textParts.map((part, i) => (
                        <UserTextPart
                            key={`msg-${messageIndex}-user-${i}`}
                            text={part.text}
                        />
                    ))
                ) : (
                    <>
                        {agentSteps.length > 0 && <AgentSteps steps={agentSteps} />}

                        {/* Council agent cards */}
                        {councilAgents.length > 0 && (
                            <div className="flex flex-col gap-3">
                                {councilAgents.map((agent) => (
                                    <CouncilAgentCard
                                        key={agent.model_key}
                                        agent={agent}
                                    />
                                ))}
                                <CouncilSynthesisCard
                                    isRunning={
                                        hasCouncilSynthesisRunning ||
                                        (councilAgents.length > 0 &&
                                            councilAgents.every(
                                                (a) => a.status === "completed"
                                            ) &&
                                            textParts.length === 0 &&
                                            isStreaming)
                                    }
                                />
                            </div>
                        )}

                        {clarificationPart &&
                            (clarificationPart.state === "output-available" ? (
                                <div className="flex flex-col gap-2 p-4 rounded-xl border border-border bg-muted/30">
                                    <p className="text-sm text-muted-foreground font-medium">
                                        {(clarificationPart.input?.question ??
                                            clarificationPart.args?.question ??
                                            "Clarification") as string}
                                    </p>
                                    <p className="text-sm text-foreground">
                                        {(clarificationPart.output as string) ?? ""}
                                    </p>
                                </div>
                            ) : (
                                <ClarificationInput
                                    question={
                                        (clarificationPart.input?.question ??
                                            clarificationPart.args?.question ??
                                            "Could you provide more details?") as string
                                    }
                                    toolCallId={clarificationPart.toolCallId}
                                    onSubmit={onClarificationSubmit}
                                />
                            ))}

                       
                        {textParts.map((part, index) => {
                            const isLastPart = index === textParts.length - 1;
                            return (
                                <AssistantTextPart
                                    key={`msg-${messageIndex}-text-${index}`}
                                    text={part.text}
                                    message={message}
                                    isStreaming={isStreaming && isLastPart}
                                    showActions={
                                        isLastMessage
                                            ? isLastPart && !isLoading
                                            : isLastPart
                                    }
                                />
                            );
                        })}
                    </>
                )}
            </div>
        </div>
    );
};

export const PreviewMessage = memo(
    PurePreviewMessage,
    function areEqual(prev: PreviewMessageProps, next: PreviewMessageProps) {
        if (prev.message.id !== next.message.id) return false;
        if (prev.isLoading !== next.isLoading) return false;
        if (prev.isLastMessage !== next.isLastMessage) return false;
        // Always re-render the last message while streaming so text updates flow through
        if (next.isLoading && next.isLastMessage) return false;
        if (prev.message.parts.length !== next.message.parts.length) return false;
        if (!equal(prev.message.parts, next.message.parts)) return false;
        if (!equal(prev.message.metadata, next.message.metadata)) return false;
        return true;
    },
);
PreviewMessage.displayName = "PreviewMessage";

// ─── MessageList (exported) ───────────────────────────────────────────────────

export const MessageList = memo(function MessageList({
    messages,
    status,
    onClarificationSubmit,
}: MessageListProps) {
    const isLoading = status === "streaming" || status === "submitted";
    const lastIndex = messages.length - 1;

    const showStandaloneThinking =
        status === "submitted" &&
        (messages.length === 0 || messages[lastIndex]?.role === "user");

    return (
        <div className="flex flex-col w-full py-6 gap-4">
            {messages.map((message, index) => (
                <PreviewMessage
                    key={message.id}
                    message={message}
                    messageIndex={index}
                    isLastMessage={index === lastIndex}
                    isLoading={isLoading}
                    onClarificationSubmit={onClarificationSubmit}
                />
            ))}
            {showStandaloneThinking && (
                <div className="w-full mx-auto max-w-3xl px-4">
                    <Thinking />
                </div>
            )}
        </div>
    );
});
MessageList.displayName = "MessageList";
