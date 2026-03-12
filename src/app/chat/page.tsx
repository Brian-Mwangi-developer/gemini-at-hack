"use client";

import { generateUUID } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const ChatPage = () => {
    const router = useRouter();
    const [id] = useState(() => generateUUID());

    useEffect(() => {
        router.replace(`/chat/${id}`);
    }, [id, router]);

    return null;
}

export default ChatPage;