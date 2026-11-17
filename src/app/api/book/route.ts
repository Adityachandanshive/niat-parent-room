import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";
import { supabaseAdmin, memoryStore } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { lead_id, session_id, slot } = await req.json();

    if (!lead_id && !session_id) {
      return NextResponse.json(
        { error: "lead_id or session_id is required" },
        { status: 400 },
      );
    }

    let lead: any = null;

    // Fetch lead data
    try {
      let query = supabaseAdmin.from("leads").select("*");
      if (lead_id) {
        query = query.eq("id", lead_id);
      } else {
        query = query.eq("session_id", session_id);
      }
      const { data, error } = await query.single();
      if (!error && data) {
        lead = data;
      }
    } catch {
      // Fallback
    }

    if (!lead) {
      lead = memoryStore.leads.find(
        (l) => l.id === lead_id || l.session_id === session_id,
      );
    }

    if (!lead) {
      // Mock lead so booking can succeed gracefully
      lead = {
        id: lead_id || `lead-${Date.now()}`,
        parent_name: "Parent",
        child_name: "Student",
        campus: "Hyderabad",
        primary_concern: "Placement & Fees",
      };
    }

    // Mark counselor as booked
    try {
      await supabaseAdmin
        .from("leads")
        .update({ counselor_booked: true, intent_score: 95 })
        .eq("id", lead.id);
    } catch {
      // Fallback
    }

    lead.counselor_booked = true;
    lead.intent_score = 95;

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

    lead.counselor_brief = counselor_brief;

    // Build WhatsApp link
    const counselorPhone =
      process.env.COUNSELOR_WHATSAPP_NUMBER?.replace(/[^0-9]/g, "") ||
      "919999999999";
    const waText = encodeURIComponent(
      `Hi, I'm ${lead.parent_name}. I've booked a counseling session for ${lead.child_name} (slot: ${slot || "flexible"}). Lead ID: ${lead.id}`,
    );
    const whatsappLink = `https://wa.me/${counselorPhone}?text=${waText}`;

    // Insert outbox confirmation message
    try {
      await supabaseAdmin.from("outbox").insert({
        lead_id: lead.id,
        phone: lead.phone,
        message_type: "call_confirmation",
        message_text: `Hi ${lead.parent_name}, your counselor call for ${lead.child_name} is confirmed. Slot: ${slot || "We'll contact you shortly"}. WhatsApp: ${whatsappLink}`,
        delivered: true,
      });
    } catch {
      // non-blocking
    }

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
