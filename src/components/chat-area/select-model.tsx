"use client";

import { useChatModels } from "@/hooks/use-chat-models";
import { cn } from "@/lib/utils";
import { appStore } from "@/store";
import { ChatModel } from "@/types/chat";
import { ChevronDown } from "lucide-react";
import { Fragment, memo, PropsWithChildren, useCallback, useState } from "react";
import { useShallow } from "zustand/shallow";
import { Button } from "../ui/button";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList, CommandSeparator } from "../ui/command";
import { ModelProviderIcon } from "../ui/model-provider-icon";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Switch } from "../ui/switch";

interface Props {
    onSelect: (model: ChatModel) => void;
    currentModel?: ChatModel;
}

export const SelectModel = (props: PropsWithChildren<Props>) => {
    const [open, setOpen] = useState(false);
    const { data: providers } = useChatModels();
    const [model, setModel] = useState(props.currentModel);
    const [activeModels, mutate] = appStore(
        useShallow((s) => [s.activeModels, s.mutate])
    );

    const isModelActive = useCallback(
        (provider: string, name: string) =>
            activeModels.some((m) => m.provider === provider && m.model === name),
        [activeModels]
    );

    const handleModelToggle = useCallback(
        (provider: string, name: string, checked: boolean) => {
            const updated = checked
                ? [...activeModels, { provider, model: name }]
                : activeModels.filter((m) => !(m.provider === provider && m.model === name));
            mutate({ activeModels: updated });
        },
        [activeModels, mutate]
    );

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
                className="p-0 w-80"
                align={"end"}
                data-testid="model-selector-popover">
                <Command
                    className="rounded-lg relative shadow-md"
                    value={JSON.stringify(model)}
                    onClick={(e) => e.stopPropagation()}
                >
                    <CommandList className="p-2 max-h-96 overflow-y-auto">
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
                                    {provider.models.map((item) => {
                                        const active = isModelActive(provider.provider, item.name);
                                        return (
                                            <CommandItem
                                                key={item.name}
                                                disabled={!provider.hasAPIKey}
                                                className="cursor-pointer flex items-center px-3 py-2 h-auto gap-2"
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
                                                <span className={cn(
                                                    "text-sm flex-1 truncate",
                                                    active ? "text-foreground" : "text-muted-foreground"
                                                )}>
                                                    {item.displayName || item.name}
                                                </span>
                                                <div
                                                    className="shrink-0"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <Switch
                                                        checked={active}
                                                        onCheckedChange={(checked) =>
                                                            handleModelToggle(provider.provider, item.name, checked)
                                                        }
                                                        disabled={!provider.hasAPIKey}
                                                    />
                                                </div>
                                            </CommandItem>
                                        );
                                    })}
                                </CommandGroup>
                                {i < providers?.length - 1 && <CommandSeparator />}
                            </Fragment>
                        ))}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

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
            <span className="capitalize">{provider}</span>
            {!hasAPIKey && (
                <span className="text-xs ml-auto text-muted-foreground">
                    No API Key
                </span>
            )}
        </div>
    );
});
