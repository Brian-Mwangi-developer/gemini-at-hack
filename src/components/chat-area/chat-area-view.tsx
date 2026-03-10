"use client";

import { cn } from "@/lib/utils";
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PromptInputArea } from "./prompt-input-area";
import { MessageList } from "./message-list";

interface Props {
    initialMessages: Array<UIMessage>;
    threadId: string;
}


export const ChatAreaView = ({ threadId, initialMessages }: Props) => {
    const [transport] = useState(
        () =>
            new DefaultChatTransport({
                api: "/api/chat",
                body: { threadId },
            }),
    );
    const {
        messages,
        sendMessage,
        status,
        stop,
        addToolOutput,
    } = useChat({
        id: threadId,
        messages: initialMessages,
        transport,
    });

    const handleClarificationSubmit = useCallback(
        (toolCallId: string, output: string) => {
            addToolOutput({
                tool: "ask_clarification" as never,
                toolCallId,
                output: output as never,
            });
          
            sendMessage();
        },
        [addToolOutput, sendMessage],
    );
    const [input, setInput] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, [messages]);
    const emptyMessage = useMemo(
        () => messages.length === 0,
        [messages.length],
    );
    const isLoading = useMemo(
        () => status === "streaming" || status === "submitted",
        [status]
    );
    return (
        <>
            <div className={cn(
                emptyMessage && "justify-center pb-24",
                "flex flex-col min-w-0 relative h-screen z-40 overflow-hidden"
            )}>
                {
                    emptyMessage ? (
                        <div className="flex flex-col items-center justify-center pb-24">
                            <div className="w-full max-w-4xl mx-auto flex flex-col items-center gap-6 px-6">
                                <div className="flex flex-col items-center text-center gap-3">
                                    <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
                                        Talk to GemiGraph Agents
                                    </h2>
                                    <p className="text-sm text-muted-foreground max-w-xl">
                                        Chat with AI for research and get citations for answers
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto" ref={scrollRef}>
                            <MessageList
                                messages={messages}
                                status={status}
                                onClarificationSubmit={handleClarificationSubmit}
                            />
                        </div>
                    )}
            </div>
            <PromptInputArea
                input={input}
                sendMessage={sendMessage}
                setInput={setInput}
                isLoading={isLoading}
                onStop={stop}
            />
        </>
    )
}