"use client";

import { appStore } from "@/store";
import { ChatModel } from "@/types/chat";
import { UIMessage, UseChatHelpers } from "@ai-sdk/react";
import { ChevronDown, CornerRightUp, Square } from "lucide-react";
import { useCallback } from "react";
import { useShallow } from "zustand/shallow";
import { Button } from "../ui/button";
import { GeminiIcon } from "../ui/gemini-icon";
import { SelectModel } from "./select-model";
import { DeepResearchdropdown } from "./deep-research-view";


interface ChatboxProps {
    input: string;
    setInput: (value: string) => void;
    onStop: () => void;
    isLoading?: boolean;
    hasMessages?: boolean;
    sendMessage: UseChatHelpers<UIMessage>["sendMessage"];
}


export const PromptInputArea = ({ input, setInput, isLoading, onStop, sendMessage, hasMessages }: ChatboxProps) => {
    const [globalModel, appStoreMutate, modelCouncil, activeModels] = appStore(
        useShallow((state) => [
            state.chatModel,
            state.mutate,
            state.modelCouncil,
            state.activeModels,
        ])
    )
    const chatModel = globalModel;
    const setChatModel = useCallback(
        (model: ChatModel) => {
            appStoreMutate({ chatModel: model })
        },
        [appStoreMutate]
    );

    const submit = () => {
        if (isLoading) return;
        const userMessage = input?.trim() || "";
        if (userMessage.length === 0) return;
        setInput("");
        sendMessage({ text: userMessage });
    }
    return (
        <div className="w-full fade-in animate-in mb-20 min-h-60">
            <div className="mx-auto w-full max-w-3xl relative px-4">
                <fieldset className="flex w-full min-w-0 max-w-full flex-col">
                    <div className="shadow-xl border-2 border-border rounded-2xl overflow-hidden  backdrop-blur-sm transition-all duration-200 bg-background/95 relative flex w-full flex-col cursor-text z-10 items-stretch focus-within:bg-background/98 focus-within:border-primary hover:border-muted-foreground/50">
                        <div className="flex flex-col gap-2 px-4 py-3">
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Type your message here..."
                                rows={3}
                                className="w-full bg-transparent text-foreground placeholder-muted-foreground outline-none resize-none text-base leading-relaxed"
                            />
                            <div className="flex w-full items-center gap-1 z-30">
                                {
                                    <>
                                        <DeepResearchdropdown hasMessages={hasMessages}/>
                                    </>
                                }
                                <div className="flex-1" />
                                <SelectModel onSelect={setChatModel} currentModel={chatModel}>
                                    <Button
                                        variant={"ghost"}
                                        size={"sm"}
                                        className="rounded-full group data-[state=open]:bg-muted hover:bg-muted gap-1.5 px-2"
                                        data-testid="model-selector-button"
                                    >
                                        {modelCouncil && activeModels.length > 0 ? (
                                            <>
                                                <GeminiIcon className="size-3 text-primary" />
                                                <span
                                                    className="text-sm text-foreground"
                                                    data-testid="selected-model-name"
                                                >
                                                    {activeModels.length} models
                                                </span>
                                            </>
                                        ) : chatModel?.model ? (
                                            <>
                                                <GeminiIcon className="size-3" />
                                                <span
                                                    className="text-sm text-foreground"
                                                    data-testid="selected-model-name"
                                                >
                                                    {chatModel.model}
                                                </span>
                                            </>
                                        ) : (
                                            <span className="text-muted-foreground text-sm">model</span>
                                        )}
                                        <ChevronDown className="size-3" />
                                    </Button>
                                </SelectModel>
                                <button
                                    onClick={() => {
                                        if (isLoading || input.trim().length === 0) {
                                            onStop()
                                        } else {
                                            submit();
                                        }
                                    }}
                                    className={`rounded-full p-2 transition-all duration-200 flex items-center justify-center ${isLoading || input.trim().length === 0
                                        ? "bg-secondary text-muted-foreground cursor-not-allowed"
                                        : "bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                                        }`}
                                    disabled={isLoading || input.trim().length === 0}
                                    type="button"
                                >
                                    {isLoading ? (
                                        <Square
                                            size={16}
                                            className="fill-current"
                                        />
                                    ) : (
                                        <CornerRightUp size={16} />
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </fieldset>
            </div>
        </div>
    )
}