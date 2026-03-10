"use client";

import { ChatAreaView } from "@/components/chat-area/chat-area-view";
import { use } from "react";

interface Props {
    params: Promise<{ id: string }>;
}

const ChatByIdPage = ({ params }: Props) => {
    const { id } = use(params);
    return (
        <div className="h-screen flex flex-col">
            <ChatAreaView initialMessages={[]} threadId={id} key={id} />
        </div>
    );
};

export default ChatByIdPage;
