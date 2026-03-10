import { fetcher } from "@/lib/utils";
import { appStore } from "@/store";
import useSWR, { SWRConfiguration } from "swr";

export const useChatModels = (options?: SWRConfiguration) => {
    return useSWR<
        {
            provider: string;
            hasAPIKey: boolean;
            models: {
                name: string;
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
        },
        ...options
    });
};