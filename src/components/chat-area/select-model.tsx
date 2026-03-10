"use client";

import { useChatModels } from "@/hooks/use-chat-models";
import { cn } from "@/lib/utils";
import { ChatModel } from "@/types/chat";
import { CheckIcon, ChevronDown } from "lucide-react";
import { Fragment, memo, PropsWithChildren, useState } from "react";
import { Button } from "../ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "../ui/command";
import { ModelProviderIcon } from "../ui/model-provider-icon";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";




interface Props {
    onSelect: (model: ChatModel) => void;
    currentModel?: ChatModel;
}

export const SelectModel = (props: PropsWithChildren<Props>) => {
    const [open, setOpen] = useState(false);
    const { data: providers } = useChatModels();
    const [model, setModel] = useState(props.currentModel);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                {props.children || (
                    <Button
                        variant={"secondary"}
                        size={"sm"}
                        className="data-[state=open]:bg-input! hover:bg-input! "
                        data-testid="model-selector-button"
                    >
                        <div className="mr-auto flex items-center gap-1">
                            <p data-testid="selected-model-name">{model?.model || "model"}</p>
                        </div>
                        <ChevronDown className="size-3" />
                    </Button>
                )}
            </PopoverTrigger>
            <PopoverContent
                className="p-0 w-70"
                align={"end"}
                data-testid="model-selector-popover">
                <Command
                    className="rounded-lg relative shadow-md h-80"
                    value={JSON.stringify(model)}
                    onClick={(e) => e.stopPropagation()}
                >
                    <CommandList className="p-2">
                        <CommandEmpty>No results found.</CommandEmpty>
                        {providers?.map((provider, i) => (
                            <Fragment key={provider.provider}>
                                <CommandGroup
                                    heading={
                                        <ProviderHeader
                                            provider={provider.provider}
                                            hasAPIKey={provider.hasAPIKey}
                                        />
                                    }
                                    className={cn(
                                        "pb-4 group",
                                        !provider.hasAPIKey && "opacity-50",
                                    )}
                                    onWheel={(e) => {
                                        e.stopPropagation();
                                    }}
                                    data-testid={`model-provider-${provider.provider}`}
                                >
                                    {provider.models.map((item) => (
                                        <CommandItem
                                            key={item.name}
                                            disabled={!provider.hasAPIKey}
                                            className="cursor-pointer"
                                            onSelect={() => {
                                                setModel({
                                                    provider: provider.provider,
                                                    model: item.name,
                                                });
                                                props.onSelect({
                                                    provider: provider.provider,
                                                    model: item.name,
                                                });
                                                setOpen(false);
                                            }}
                                            value={item.name}
                                            data-testid={`model-option-${provider.provider}-${item.name}`}
                                        >
                                            {model?.provider === provider.provider &&
                                                model?.model === item.name ? (
                                                <CheckIcon
                                                    className="size-3"
                                                    data-testid="selected-model-check"
                                                />
                                            ) : (
                                                <div className="ml-3" />
                                            )}
                                            <span className="pr-2">{item.name}</span>
                                            {!item.isToolCallSupported && (
                                                <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                                                    No tools
                                                </div>
                                            )}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                                {i < providers?.length - 1 && <CommandSeparator />}
                            </Fragment>
                        ))}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}



const ProviderHeader = memo(function ProviderHeader({
    provider,
    hasAPIKey,
}: { provider: string; hasAPIKey: boolean }) {
    return (
        <div className="text-sm text-muted-foreground flex items-center gap-1.5 group-hover:text-foreground transition-colors duration-300">
            {provider === "openai" ? (
                <ModelProviderIcon
                    provider="openai"
                    className="size-3 text-foreground"
                />
            ) : (
                <ModelProviderIcon provider={provider} className="size-3" />
            )}
            {provider}
            {!hasAPIKey && (
                <>
                    <span className="text-xs ml-auto text-muted-foreground">
                        No API Key
                    </span>
                </>
            )}
        </div>
    );
});
