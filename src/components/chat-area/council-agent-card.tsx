"use client";

import { cn } from "@/lib/utils";
import { ModelProviderIcon } from "@/components/ui/model-provider-icon";
import { Check, ChevronRight, LoaderIcon } from "lucide-react";
import { memo, useState } from "react";
import { MarkdownContent } from "./markdown-content";

export interface CouncilAgentStep {
    node: string;
    label: string;
    detail?: string;
}

export interface CouncilAgentData {
    model_key: string;
    display_name: string;
    provider: string;
    icon: string;
    status: "running" | "completed";
    steps: CouncilAgentStep[];
    step_count: number;
    draft_answer: string;
    citations: Array<{ source_number: number; title: string; url: string }>;
    errors: string[];
}

interface CouncilAgentCardProps {
    agent: CouncilAgentData;
}

export const CouncilAgentCard = memo(function CouncilAgentCard({
    agent,
}: CouncilAgentCardProps) {
    const [expanded, setExpanded] = useState(false);
    const isCompleted = agent.status === "completed";
    const isRunning = agent.status === "running";

    // Get the agent's description from the first step (intake)
    const agentDescription = agent.steps.length > 0
        ? agent.steps[0]?.detail || ""
        : "";

    return (
        <div className="rounded-xl border border-border bg-background overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-muted/50">
                        <ModelProviderIcon
                            provider={agent.provider}
                            className="size-3.5 text-muted-foreground"
                        />
                        <span className="text-sm font-medium text-foreground">
                            {agent.display_name}
                        </span>
                    </div>
                </div>

                {isCompleted && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                        {agent.step_count} steps
                    </span>
                )}

                <div className="flex-1" />

                {isCompleted && (
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    >
                        {expanded ? "Hide response" : "View response"}
                        <ChevronRight
                            className={cn(
                                "size-3 transition-transform duration-200",
                                expanded && "rotate-90",
                            )}
                        />
                    </button>
                )}
            </div>

            {/* Status + description */}
            <div className="px-4 pb-3 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                    {isRunning ? (
                        <>
                            <LoaderIcon className="size-3.5 animate-spin text-primary" />
                            <span className="text-xs text-muted-foreground">
                                {agent.steps.length > 0
                                    ? agent.steps[agent.steps.length - 1].label
                                    : "Processing..."}
                            </span>
                        </>
                    ) : (
                        <>
                            <Check className="size-3.5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Completed</span>
                        </>
                    )}
                </div>
                {agentDescription && (
                    <p className="text-xs text-muted-foreground/80 line-clamp-2 ml-5.5">
                        {agentDescription}
                    </p>
                )}
            </div>

            {/* Expanded view */}
            {expanded && isCompleted && (
                <div className="border-t border-border px-4 py-4 flex flex-col gap-3">
                    <div className="text-sm leading-relaxed text-foreground">
                        <MarkdownContent content={agent.draft_answer} />
                    </div>
                </div>
            )}
        </div>
    );
});

/* Synthesis loading card (shown while synthesizing) */
export const CouncilSynthesisCard = memo(function CouncilSynthesisCard({
    isRunning,
}: {
    isRunning: boolean;
}) {
    if (!isRunning) return null;

    return (
        <div className="rounded-xl border border-dashed border-border bg-background/50 px-4 py-3 flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-muted/50">
                <LoaderIcon className="size-3.5 animate-spin text-primary" />
                <span className="text-sm font-medium text-foreground">
                    Synthesizing responses...
                </span>
            </div>
        </div>
    );
});
