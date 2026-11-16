import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { session_id, message } = await req.json();

    if (!session_id || !message) {
      return NextResponse.json(
        { error: "session_id and message are required" },
        { status: 400 },
      );
    }

    // Fetch existing chat history for this session
    const { data: history, error: histErr } = await supabaseAdmin
      .from("chat_messages")
      .select("role, content")
      .eq("session_id", session_id)
      .order("created_at", { ascending: true });

    if (histErr) throw histErr;

    // Save the incoming user message
    await supabaseAdmin.from("chat_messages").insert({
      session_id,
      role: "user",
      content: message,
    });

    // Build typed messages array from history + new message
    const messages: Array<{ role: "user" | "assistant"; content: string }> = [
      ...(history || []).map((h) => ({
        role: (h.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
        content: String(h.content || ""),
      })),
      { role: "user", content: String(message) },
    ];

    // Run agent
    const { reply, trace } = await runAgent(messages);

    // Save assistant reply
    await supabaseAdmin.from("chat_messages").insert({
      session_id,
      role: "assistant",
      content: reply,
    });

    return NextResponse.json({ reply, trace });
  } catch (err: unknown) {
    console.error("[POST /api/chat]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
