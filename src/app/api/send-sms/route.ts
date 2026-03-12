import { NextResponse } from "next/server";

export async function POST(req: Request) {
    const body = await req.json();
    const { phoneNumber, chatUrl } = body as {
        phoneNumber?: string;
        chatUrl?: string;
    };

    if (!phoneNumber || !chatUrl) {
        return NextResponse.json(
            { message: "phoneNumber and chatUrl are required" },
            { status: 400 },
        );
    }

    const backendUrl = process.env.FASTAPI_URL ?? "http://localhost:8000";

    try {
        const upstream = await fetch(`${backendUrl}/send-sms`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phoneNumber, chatUrl }),
        });

        const data = await upstream.json();
        return NextResponse.json(data, { status: upstream.ok ? 200 : 500 });
    } catch {
        return NextResponse.json(
            { message: "Could not reach backend" },
            { status: 502 },
        );
    }
}
