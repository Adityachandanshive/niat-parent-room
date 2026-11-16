import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const { data: messages, error } = await supabaseAdmin
      .from("outbox")
      .select("*, leads(parent_name, child_name, campus, phone)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      // Fallback if relation not defined or simple select
      const { data: rawMessages, error: rawErr } = await supabaseAdmin
        .from("outbox")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (rawErr) throw rawErr;
      return NextResponse.json({ messages: rawMessages || [] });
    }

    return NextResponse.json({ messages: messages || [] });
  } catch (err: unknown) {
    console.error("[GET /api/inbox]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
