"use client";

import { ChatAreaView } from "@/components/chat-area/chat-area-view";
import { Spinner } from "@/components/ui/spinner";
import { UIMessage } from "ai";
import { use, useEffect, useState } from "react";

interface Props {
    params: Promise<{ id: string }>;
}

const ChatByIdPage = ({ params }: Props) => {
    const { id } = use(params);
    const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(null);

    useEffect(() => {
        fetch(`/api/chats/${id}`)
            .then((res) => {
                if (!res.ok) return [];
                return res.json().then((data) => data.messages ?? []);
            })
            .then((msgs) => setInitialMessages(msgs))
            .catch(() => setInitialMessages([]));
    }, [id]);

    if (initialMessages === null) {
        return (
            <div className="h-screen flex items-center justify-center">
                <Spinner className="size-6" />
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col">
            <ChatAreaView initialMessages={initialMessages} threadId={id} key={id} />
        </div>
    );
};

export default ChatByIdPage;
