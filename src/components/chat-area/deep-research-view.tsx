"use client";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useChatModels } from "@/hooks/use-chat-models";
import { appStore, COUNCIL_MODELS } from "@/store";
import { IconAlertTriangle, IconMessageForward, IconPlus, IconSparkles } from '@tabler/icons-react';
import { useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/shallow";
import { PhoneLookupInput } from "./phone-lookup-input";

export function DeepResearchdropdown({ hasMessages }: { hasMessages?: boolean }) {
    const [modelCouncil, toggleModelCouncil] = appStore(
        useShallow((s) => [s.modelCouncil, s.toggleModelCouncil])
    );
    const { data: providers } = useChatModels();
    const [errorOpen, setErrorOpen] = useState(false);
    const [missingProviders, setMissingProviders] = useState<string[]>([]);
    const [smsDialogOpen, setSmsDialogOpen] = useState(false);

    const handleToggle = () => {
        const result = toggleModelCouncil(providers);
        if (result && !result.ok) {
            setMissingProviders(result.missing);
            setErrorOpen(true);
        } else {
            setErrorOpen(false);
            setMissingProviders([]);
        }
    };

    return (
        <div className="relative flex items-center gap-1.5">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="size-8 rounded-lg">
                        <IconPlus className="size-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-60" align="start">
                    <DropdownMenuGroup>
                        <DropdownMenuLabel>Deep Research</DropdownMenuLabel>
                        <DropdownMenuItem
                            onClick={handleToggle}
                            className="cursor-pointer"
                        >
                            <IconSparkles className={modelCouncil ? "text-primary" : ""} />
                            Model Council
                            {modelCouncil && (
                                <span className="ml-auto text-xs text-primary">Active</span>
                            )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Share</DropdownMenuLabel>
                        <DropdownMenuItem
                            onClick={() => {
                                if (!hasMessages) {
                                    toast.error(
                                        "You can only send SMS of a completed research",
                                    );
                                    return;
                                }
                                setSmsDialogOpen(true);
                            }}
                            className="cursor-pointer"
                        >
                            <IconMessageForward className={hasMessages ? "" : "text-muted-foreground"} />
                            Send via SMS
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>

            {errorOpen && missingProviders.length > 0 && (
                <Popover open={errorOpen} onOpenChange={setErrorOpen}>
                    <PopoverTrigger asChild>
                        <span className="absolute inset-0 pointer-events-none" />
                    </PopoverTrigger>
                    <PopoverContent
                        className="w-72 p-4"
                        align="start"
                        side="top"
                    >
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-2 text-destructive">
                                <IconAlertTriangle className="size-4" />
                                <span className="text-sm font-medium">Cannot enable Model Council</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Model Council requires at least 2 providers with API keys.
                                You are missing:
                            </p>
                            <ul className="text-xs space-y-1">
                                {missingProviders.map((p) => {
                                    const cm = COUNCIL_MODELS.find((m) => m.provider === p);
                                    return (
                                        <li key={p} className="flex items-center gap-2 text-muted-foreground">
                                            <span className="size-1.5 rounded-full bg-destructive inline-block" />
                                            <span className="capitalize font-medium">{p}</span>
                                            <span className="text-muted-foreground/60">— {cm?.model}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                            <p className="text-xs text-muted-foreground">
                                Add the missing API keys in your <code className="bg-muted px-1 rounded">.env.local</code> file and restart.
                            </p>
                        </div>
                    </PopoverContent>
                </Popover>
            )}

            {modelCouncil && (
                <button
                    onClick={handleToggle}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors cursor-pointer"
                >
                    <IconSparkles className="size-3" />
                    Model council
                </button>
            )}

            <Dialog open={smsDialogOpen} onOpenChange={setSmsDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Send Research via SMS</DialogTitle>
                    </DialogHeader>
                    <PhoneLookupInput onClose={() => setSmsDialogOpen(false)} />
                </DialogContent>
            </Dialog>
        </div>
    );
}
