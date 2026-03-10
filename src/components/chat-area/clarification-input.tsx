"use client";

import { cn } from "@/lib/utils";
import { CornerRightUp } from "lucide-react";
import { memo, useState } from "react";

interface ClarificationInputProps {
    question: string;
    toolCallId: string;
    onSubmit: (toolCallId: string, output: string) => void;
}

export const ClarificationInput = memo(function ClarificationInput({
    question,
    toolCallId,
    onSubmit,
}: ClarificationInputProps) {
    const [value, setValue] = useState("");
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = () => {
        const trimmed = value.trim();
        if (!trimmed || submitted) return;
        setSubmitted(true);
        onSubmit(toolCallId, trimmed);
    };

    return (
        <div className="flex flex-col gap-3 p-4 rounded-xl border border-border bg-muted/30">
            <p className="text-sm text-foreground font-medium leading-relaxed">
                {question}
            </p>

            {submitted ? (
                <p className="text-sm text-muted-foreground italic">
                    Response submitted — continuing research…
                </p>
            ) : (
                <div className="flex items-end gap-2">
                    <textarea
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder="Type your clarification…"
                        rows={2}
                        className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit();
                            }
                        }}
                    />
                    <button
                        onClick={handleSubmit}
                        disabled={!value.trim()}
                        className={cn(
                            "rounded-full p-2 transition-all duration-200 flex items-center justify-center shrink-0",
                            value.trim()
                                ? "bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                                : "bg-secondary text-muted-foreground cursor-not-allowed",
                        )}
                    >
                        <CornerRightUp size={16} />
                    </button>
                </div>
            )}
        </div>
    );
});
