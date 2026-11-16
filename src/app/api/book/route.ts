import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { lead_id, session_id, slot } = await req.json();

    if (!lead_id) {
      return NextResponse.json(
        { error: "lead_id is required" },
        { status: 400 },
      );
    }

    // Mark counselor as booked and bump intent score
    const { error: updateErr } = await supabaseAdmin
      .from("leads")
      .update({ counselor_booked: true, intent_score: 95 })
      .eq("id", lead_id);

    if (updateErr) throw updateErr;

    // Fetch lead data to build counselor brief
    const { data: lead, error: fetchErr } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("id", lead_id)
      .single();

    if (fetchErr || !lead) throw fetchErr || new Error("Lead not found");

    // Build summary for counselor brief generation
    const summaryMessage = [
      `Generate a concise counselor brief for an upcoming call. Include key talking points.`,
      `Parent: ${lead.parent_name}, Child: ${lead.child_name}`,
      `City: ${lead.city || "N/A"}, Campus: ${lead.campus || "N/A"}`,
      `Budget: ${lead.budget_range || "N/A"}, Language: ${lead.language || "en"}`,
      `Primary concern: ${lead.primary_concern || "General"}`,
      `Intent score: 95 (booked counselor)`,
      `Preferred slot: ${slot || "Not specified"}`,
      `Session ID: ${session_id || "N/A"}`,
    ].join("\n");

    const { reply: counselor_brief } = await runAgent([
      { role: "user", content: summaryMessage },
    ]);

    // Update lead with counselor brief
    await supabaseAdmin
      .from("leads")
      .update({ counselor_brief })
      .eq("id", lead_id);

    // Build WhatsApp link
    const counselorPhone =
      process.env.COUNSELOR_WHATSAPP_NUMBER || "919999999999";
    const waText = encodeURIComponent(
      `Hi, I'm ${lead.parent_name}. I've booked a counseling session for ${lead.child_name} (slot: ${slot || "flexible"}). Lead ID: ${lead_id}`,
    );
    const whatsappLink = `https://wa.me/${counselorPhone}?text=${waText}`;

    // Insert outbox confirmation message
    await supabaseAdmin.from("outbox").insert({
      lead_id,
      phone: lead.phone,
      message_type: "call_confirmation",
      message_text: `Hi ${lead.parent_name}, your counselor call for ${lead.child_name} is confirmed. Slot: ${slot || "We'll contact you shortly"}. WhatsApp: ${whatsappLink}`,
    });

    return NextResponse.json({
      success: true,
      whatsappLink,
      counselor_brief,
    });
  } catch (err: unknown) {
    console.error("[POST /api/book]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
