import { ChatModel } from "@/types/chat";
import { create } from "zustand";
import { persist } from "zustand/middleware";

// Desired council models (one per provider)
export const COUNCIL_MODELS: ChatModel[] = [
    { provider: "google", model: "gemini-3.1-pro" },
    { provider: "openai", model: "gpt-4o" },
    { provider: "anthropic", model: "claude-opus-4-5" },
];

export interface ProviderInfo {
    provider: string;
    hasAPIKey: boolean;
    models: { name: string; displayName: string; isToolCallSupported: boolean }[];
}

export interface CouncilResult {
    ok: boolean;
    models: ChatModel[];
    missing: string[];
}

export function resolveCouncilModels(providers: ProviderInfo[]): CouncilResult {
    const providerMap = new Map(providers.map((p) => [p.provider, p]));
    const available: ChatModel[] = [];
    const missing: string[] = [];

    for (const cm of COUNCIL_MODELS) {
        const info = providerMap.get(cm.provider);
        if (info?.hasAPIKey) {
            available.push(cm);
        } else {
            missing.push(cm.provider);
        }
    }

    return { ok: available.length >= 2, models: available, missing };
}

export interface AppState {
    chatModel?: ChatModel;
    modelCouncil: boolean;
    activeModels: ChatModel[];
}

export interface AppDispatch {
    mutate: (state: Mutate<AppState>) => void;
    toggleModelCouncil: (providers?: ProviderInfo[]) => CouncilResult | null;
}

const initialState: AppState = {
    modelCouncil: false,
    activeModels: [],
};

export const appStore = create<AppState & AppDispatch>()(
    persist(
        (set, get) => ({
            ...initialState,
            mutate: set,
            toggleModelCouncil: (providers) => {
                const current = get().modelCouncil;


                if (current) {
                    set({ modelCouncil: false, activeModels: [] });
                    return null;
                }

                if (!providers || providers.length === 0) {
                    return { ok: false, models: [], missing: COUNCIL_MODELS.map((m) => m.provider) };
                }

                const result = resolveCouncilModels(providers);
                if (!result.ok) {
                    return result;
                }

                set({ modelCouncil: true, activeModels: result.models });
                return result;
            },
        }),
        {
            name: "gemigraph-app",
            partialize: (state) => ({
                chatModel: state.chatModel,
                modelCouncil: state.modelCouncil,
                activeModels: state.activeModels,
            }),
        }
    )
);