import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, memoryStore } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    let list: any[] = [];
    try {
      const { data: messages, error } = await supabaseAdmin
        .from("outbox")
        .select("*, leads(parent_name, child_name, campus, phone)")
        .order("created_at", { ascending: false })
        .limit(50);

      if (!error && messages) {
        list = messages;
      } else {
        const { data: rawMessages, error: rawErr } = await supabaseAdmin
          .from("outbox")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50);
        if (!rawErr && rawMessages) list = rawMessages;
      }
    } catch {
      // Fallback
    }

    if (list.length === 0 && memoryStore.outbox.length > 0) {
      list = memoryStore.outbox;
    }

    return NextResponse.json({ messages: list });
  } catch (err: unknown) {
    console.error("[GET /api/inbox]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { lead_id, phone, message_type, message_text, sender } =
      await req.json();

    if (!message_text) {
      return NextResponse.json(
        { error: "message_text is required" },
        { status: 400 },
      );
    }

    const newRecord = {
      id: `outbox-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      created_at: new Date().toISOString(),
      lead_id: lead_id || null,
      phone: phone || "+91 98765 43210",
      message_type: message_type || (sender === "parent" ? "parent_inquiry" : "counselor_reply"),
      message_text,
      delivered: true,
      sender: sender || "counselor",
    };

    try {
      await supabaseAdmin.from("outbox").insert({
        lead_id: newRecord.lead_id,
        phone: newRecord.phone,
        message_type: newRecord.message_type,
        message_text: newRecord.message_text,
        delivered: true,
      });
    } catch {
      // Non-blocking fallback
    }

    // Only add to in-memory store if not already present
    const existingOutboxIdx = memoryStore.outbox.findIndex(
      (m: any) => m.id === newRecord.id
    );
    if (existingOutboxIdx === -1) {
      memoryStore.outbox.unshift(newRecord);
    } else {
      memoryStore.outbox[existingOutboxIdx] = newRecord;
    }

    return NextResponse.json({ success: true, message: newRecord });
  } catch (err: unknown) {
    console.error("[POST /api/inbox]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
