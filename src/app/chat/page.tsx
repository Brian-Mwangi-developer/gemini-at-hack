"use client";

import { ChatAreaView } from "@/components/chat-area/chat-area-view";
import { generateUUID } from "@/lib/utils";
import { useState } from "react";


const ChatPage = () => {
    const [id] = useState(() => generateUUID());
    return (
        <div className="h-screen flex flex-col">
            <ChatAreaView initialMessages={[]} threadId={id} key={id} />
        </div>
    )
}

export default ChatPage;