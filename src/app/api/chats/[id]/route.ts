import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const chat = await prisma.chat.findUnique({ where: { id } });

    if (!chat) {
        return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    return NextResponse.json(chat);
}

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const body = await req.json();
    const { messages, title } = body as {
        messages: unknown[];
        title?: string;
    };

    if (!Array.isArray(messages)) {
        return NextResponse.json(
            { error: "messages must be an array" },
            { status: 400 },
        );
    }

    // Derive a title from the first user message if not provided
    let chatTitle = title;
    if (!chatTitle) {
        const firstUser = messages.find(
            (m) => (m as Record<string, unknown>).role === "user",
        ) as Record<string, unknown> | undefined;

        if (firstUser) {
            const parts = firstUser.parts as Array<Record<string, unknown>> | undefined;
            const textPart = parts?.find((p) => p.type === "text");
            const text = (textPart?.text as string) ?? "";
            chatTitle = text.slice(0, 100) || "New Chat";
        }
    }

    const chat = await prisma.chat.upsert({
        where: { id },
        create: {
            id,
            title: chatTitle ?? "New Chat",
            messages: JSON.parse(JSON.stringify(messages)),
        },
        update: {
            title: chatTitle,
            messages: JSON.parse(JSON.stringify(messages)),
        },
    });

    return NextResponse.json(chat);
}

export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;

    await prisma.chat.delete({ where: { id } }).catch(() => null);

    return NextResponse.json({ ok: true });
}
