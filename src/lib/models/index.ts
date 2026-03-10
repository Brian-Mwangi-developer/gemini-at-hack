import { ChatModel } from "@/types/chat";

/**
 * Static model metadata used by the frontend model selector.
 * Actual inference happens on the FastAPI backend — this list is
 * purely for the UI picker and the /api/chat/models endpoint.
 */
export const defaultModel: ChatModel = {
  provider: "google",
  model: "gemini-3.1-pro-preview",
};

