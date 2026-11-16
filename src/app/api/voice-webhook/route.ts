import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    // Verify shared secret
    const webhookSecret = req.headers.get("x-webhook-secret");
    const expectedSecret = process.env.GNANI_API_KEY;

    if (!expectedSecret || webhookSecret !== expectedSecret) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { session_id, transcript, language, duration } = await req.json();

    if (!session_id || !transcript) {
      return NextResponse.json(
        { error: "session_id and transcript are required" },
        { status: 400 },
      );
    }

    // Use agent to summarize transcript and classify objection
    const { reply: call_summary, toolResults } = await runAgent([
      {
        role: "user",
        content: [
          `Summarize this voice call transcript into a concise counselor-ready note.`,
          `Use classify_objection to classify the parent's primary concern.`,
          `Language: ${language || "en"}, Duration: ${duration || "unknown"}s`,
          ``,
          `Transcript:`,
          transcript,
        ].join("\n"),
      },
    ]);

    // Update lead: mark voice call done and save summary
    const { error: updateErr } = await supabaseAdmin
      .from("leads")
      .update({ voice_call_done: true, call_summary })
      .eq("session_id", session_id);

    if (updateErr) throw updateErr;

    // Re-classify objection from transcript if tool provided a category
    const classifyTool = toolResults?.classify_objection as
      | { category?: string }
      | undefined;
    const category = classifyTool?.category;

    if (category) {
      // Fetch lead_id for ledger update
      const { data: lead } = await supabaseAdmin
        .from("leads")
        .select("id, campus, language")
        .eq("session_id", session_id)
        .single();

      if (lead) {
        await supabaseAdmin
          .from("leads")
          .update({ objection_category: category })
          .eq("id", lead.id);

        await supabaseAdmin.from("objection_ledger").insert({
          lead_id: lead.id,
          objection_category: category,
          campus: lead.campus,
          language: lead.language,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[POST /api/voice-webhook]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
