import { fetcher } from "@/lib/utils";
import { appStore, resolveCouncilModels } from "@/store";
import useSWR, { SWRConfiguration } from "swr";

export const useChatModels = (options?: SWRConfiguration) => {
    return useSWR<
        {
            provider: string;
            hasAPIKey: boolean;
            models: {
                name: string;
                displayName:string;
                isToolCallSupported: boolean;
            }[];
        }[]
    >("/api/chat/models", fetcher, {
        dedupingInterval: 60_000 * 5,
        revalidateOnFocus: false,
        fallbackData: [],
        onSuccess: (data) => {
            const status = appStore.getState();
            if (!status.chatModel) {
                const firstProvider = data[0].provider;
                const model = data[0].models[0].name;
                appStore.setState({ chatModel: { provider: firstProvider, model } });
            }
            // If council was persisted but keys are now missing, auto-disable
            if (status.modelCouncil) {
                const result = resolveCouncilModels(data);
                if (!result.ok) {
                    appStore.setState({ modelCouncil: false, activeModels: [] });
                } else {
                    // Re-sync active models to only those with valid keys
                    appStore.setState({ activeModels: result.models });
                }
            }
        },
        ...options
    });
};