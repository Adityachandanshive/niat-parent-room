import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const gnaniApiKey = process.env.GNANI_API_KEY;
    const gnaniAgentId = process.env.GNANI_AGENT_ID;

    // Demo mode if credentials are not set
    if (!gnaniApiKey || !gnaniAgentId) {
      return NextResponse.json({
        demo_mode: true,
        message:
          "Voice integration is in demo mode. Set GNANI_API_KEY and GNANI_AGENT_ID to enable.",
      });
    }

    const body = await req.json();

    // Start a Gnani voice session
    const gnaniResponse = await fetch(
      "https://api.gnani.ai/v1/sessions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gnaniApiKey}`,
        },
        body: JSON.stringify({
          agent_id: gnaniAgentId,
          ...body,
        }),
      },
    );

    if (!gnaniResponse.ok) {
      const errText = await gnaniResponse.text();
      console.error("[Gnani API error]", gnaniResponse.status, errText);
      return NextResponse.json(
        { error: "Failed to start voice session", details: errText },
        { status: gnaniResponse.status },
      );
    }

    const sessionData = await gnaniResponse.json();
    return NextResponse.json(sessionData);
  } catch (err: unknown) {
    console.error("[POST /api/voice/start]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
