import {z} from "zod";
import { LanguageModelUsage, UIMessage } from "ai";

export type ChatModel ={
    provider:string;
    model:string;
}

export type ChatMetadata = {
    usage?: LanguageModelUsage;
    chatModel?: ChatModel;
    toolCount?: number;
    responseTimeMs?: number;
}

export const chatApiSchemaRequestBodySchema = z.object({
    id: z.string(),
    messages: z.array(z.any()) as z.ZodType<UIMessage[]>,
    chatModel: z.object({
        provider: z.string(),
        model: z.string(),
    }).optional(),
});

export type ChatApiSchemaRequestBody = z.infer<
    typeof chatApiSchemaRequestBodySchema
>;