import { ChatModel } from "@/types/chat";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AppState{
    chatModel?:ChatModel;
}

export interface AppDispatch {
    mutate:(state:Mutate<AppState>) => void;
}

const initialState: AppState ={

}

export const appStore = create<AppState & AppDispatch>()(
    persist(
        (set) =>({
            ...initialState,
            mutate:set
        }),
        {
            name:"gemigraph-app",
            partialize:(state) =>({
                chatModel: state.chatModel
            })
        }
    )
)