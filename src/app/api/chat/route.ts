import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";
import { supabaseAdmin, memoryStore } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { session_id, message } = await req.json();

    if (!session_id || !message) {
      return NextResponse.json(
        { error: "session_id and message are required" },
        { status: 400 },
      );
    }

    // Fetch existing chat history for this session (graceful fallback)
    let history: Array<{ role: string; content: string }> = [];
    try {
      const { data, error: histErr } = await supabaseAdmin
        .from("chat_messages")
        .select("role, content")
        .eq("session_id", session_id)
        .order("created_at", { ascending: true });

      if (!histErr && data) {
        history = data;
      }
    } catch {
      // Fall back to memoryStore
      history = (memoryStore.chat_messages || [])
        .filter((m: any) => m.session_id === session_id)
        .sort(
          (a: any, b: any) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        )
        .map((m: any) => ({ role: m.role, content: m.content }));
    }

    // Save the incoming user message (non-blocking)
    const userMsgId = `cm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    try {
      await supabaseAdmin.from("chat_messages").insert({
        id: userMsgId,
        session_id,
        role: "user",
        content: message,
      });
    } catch {
      // safe fallback handled below
    }
    if (!memoryStore.chat_messages.some((m: any) => m.id === userMsgId)) {
      memoryStore.chat_messages.push({
        id: userMsgId,
        session_id,
        role: "user",
        content: message,
        created_at: new Date().toISOString(),
      });
    }

    // Build typed messages array from history + new message
    const messages: Array<{ role: "user" | "assistant"; content: string }> = [
      ...history.map((h) => ({
        role: (h.role === "assistant" ? "assistant" : "user") as
          | "user"
          | "assistant",
        content: String(h.content || ""),
      })),
      { role: "user", content: String(message) },
    ];

    // Also inject lead context if available from memoryStore
    const leadContext = memoryStore.leads.find(
      (l: any) => l.session_id === session_id,
    );
    if (leadContext) {
      // Prepend context about the parent so agent has richer info
      messages.unshift({
        role: "user",
        content: `[Context — Parent: ${leadContext.parent_name}, Child: ${leadContext.child_name}, Campus: ${leadContext.campus}, Concern: ${leadContext.primary_concern}, Language: ${leadContext.language}]`,
      });
    }

    // Run agent
    const { reply, trace } = await runAgent(messages);

    // Save assistant reply (non-blocking)
    const assistantMsgId = `cm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    try {
      await supabaseAdmin.from("chat_messages").insert({
        id: assistantMsgId,
        session_id,
        role: "assistant",
        content: reply,
      });
    } catch {
      // safe fallback handled below
    }
    if (!memoryStore.chat_messages.some((m: any) => m.id === assistantMsgId)) {
      memoryStore.chat_messages.push({
        id: assistantMsgId,
        session_id,
        role: "assistant",
        content: reply,
        created_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ reply, trace });
  } catch (err: unknown) {
    console.error("[POST /api/chat]", err);

    // Even on error, return a helpful reply so the UI doesn't go blank
    const fallbackReply =
      "Thank you for your question. The NIAT program combines an accredited university degree with industry-focused upskilling. Placement support is provided through NxtWave's 1000+ hiring partners, though outcomes depend on student performance. I'd recommend booking a call with a senior campus counselor for detailed answers. Would you like to schedule one?";

    return NextResponse.json({
      reply: fallbackReply,
      trace: [],
      fallback: true,
    });
  }
}
