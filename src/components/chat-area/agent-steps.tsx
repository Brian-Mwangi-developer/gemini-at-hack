"use client";

import { cn } from "@/lib/utils";
import { Check, ChevronDown, LoaderIcon } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";

export interface AgentStep {
  node: string;
  label: string;
  status: "running" | "completed";
  detail?: string;
}

interface AgentStepsProps {
  steps: AgentStep[];
}

export const AgentSteps = memo(function AgentSteps({ steps }: AgentStepsProps) {
  if (steps.length === 0) return null;
// eslint-disable-next-line react-hooks/rules-of-hooks
  const completedCount = useMemo(
    () => steps.filter((s) => s.status === "completed").length,
    [steps],
  );
    // eslint-disable-next-line react-hooks/rules-of-hooks
  const isRunning = useMemo(
    () => steps.some((s) => s.status === "running"),
    [steps],
  );
  const allDone = completedCount === steps.length && !isRunning;
    // eslint-disable-next-line react-hooks/rules-of-hooks
  const [open, setOpen] = useState(!allDone);

    // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (isRunning) setOpen(true);
    if (allDone) setOpen(false);
  }, [isRunning, allDone]);

  // Current activity label for the header
  const headerLabel = isRunning
    ? steps.find((s) => s.status === "running")?.label ?? "Processing…"
    : "Research complete";

  return (
    <div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full px-4 py-2.5 text-left hover:bg-muted/50 transition-colors"
      >
        {isRunning ? (
          <LoaderIcon className="size-4 animate-spin text-primary shrink-0" />
        ) : (
          <Check className="size-4 text-primary shrink-0" />
        )}

        <span className="flex-1 text-sm font-medium text-foreground truncate">
          {headerLabel}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
          {completedCount}/{steps.length}
        </span>

        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3 flex flex-col">
          {steps.map((step, index) => {
            const isLast = index === steps.length - 1;
            const stepRunning = step.status === "running";
            const stepDone = step.status === "completed";

            return (
              <div
                key={`${step.node}-${index}`}
                className="flex items-start gap-3"
              >
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "flex items-center justify-center size-5 rounded-full border-2 shrink-0 transition-colors duration-300",
                      stepDone &&
                        "border-primary bg-primary text-primary-foreground",
                      stepRunning && "border-primary/50 bg-background",
                    )}
                  >
                    {stepDone && <Check className="size-3" />}
                    {stepRunning && (
                      <LoaderIcon className="size-3 animate-spin text-primary" />
                    )}
                  </div>
                  {!isLast && (
                    <div
                      className={cn(
                        "w-0.5 min-h-5",
                        stepDone ? "bg-primary/40" : "bg-border",
                      )}
                    />
                  )}
                </div>

                <div className="flex flex-col pt-0.5 min-w-0 pb-1.5">
                  <span
                    className={cn(
                      "text-sm leading-tight",
                      stepDone
                        ? "text-foreground font-medium"
                        : "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </span>
                  {step.detail && (
                    <span className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {step.detail}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
