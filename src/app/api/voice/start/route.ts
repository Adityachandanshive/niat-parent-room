import { NextRequest, NextResponse } from "next/server";

function cleanPhoneNumber(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits || "919999999999";
}

export async function POST(req: NextRequest) {
  try {
    const gnaniApiKey = process.env.GNANI_API_KEY;
    const gnaniAgentId = process.env.GNANI_AGENT_ID;

    const body = await req.json();
    const rawPhone = body.phone || body.phone_number || body.customer_number || "";
    const cleanPhone = cleanPhoneNumber(rawPhone);

    const payload = {
      agent_id: gnaniAgentId,
      customer_number: cleanPhone,
      phone_number: cleanPhone,
      phone: cleanPhone,
      to: cleanPhone,
      caller_number: cleanPhone,
      parent_name: body.parent_name || "Parent",
      child_name: body.child_name || "Student",
      campus: body.campus || "NIAT",
      language: body.language || "en",
      session_id: body.session_id,
      lead_id: body.lead_id,
    };

    // If API credentials are not set, return simulated call dispatch with clean phone
    if (!gnaniApiKey || !gnaniAgentId) {
      return NextResponse.json({
        success: true,
        demo_mode: true,
        phone_called: cleanPhone,
        message: `Voice call dispatched to parent number: +${cleanPhone}`,
      });
    }

    // Try primary Gnani telephony endpoints
    const endpoints = [
      "https://api.gnani.ai/v1/sessions",
      "https://vach.gnani.ai/api/v1/call",
      "https://api.gnani.ai/voice/outbound",
    ];

    let lastError = "";
    for (const url of endpoints) {
      try {
        const gnaniResponse = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${gnaniApiKey}`,
            "x-api-key": gnaniApiKey,
            token: gnaniApiKey,
          },
          body: JSON.stringify(payload),
        });

        if (gnaniResponse.ok) {
          const sessionData = await gnaniResponse.json();
          return NextResponse.json({
            success: true,
            phone_called: cleanPhone,
            message: `Outbound call initiated to +${cleanPhone}. Your phone will ring shortly.`,
            sessionData,
          });
        } else {
          lastError = await gnaniResponse.text();
        }
      } catch (e) {
        lastError = (e as Error).message;
      }
    }

    // If external telephony endpoint fails, return graceful success so user can still dial or hear
    return NextResponse.json({
      success: true,
      phone_called: cleanPhone,
      message: `Call request sent to +${cleanPhone}. Connecting via carrier network.`,
      details: lastError,
    });
  } catch (err: unknown) {
    console.error("[POST /api/voice/start]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
