import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const {
      parent_name,
      child_name,
      phone,
      city,
      campus,
      budget_range,
      language,
      primary_concern,
    } = await req.json();

    if (!parent_name || !child_name) {
      return NextResponse.json(
        { error: "parent_name and child_name are required" },
        { status: 400 },
      );
    }

    // Generate unique session id
    const session_id = `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Build the user message requesting a personalized NIAT Decision Report
    const userMessage = [
      `Generate a personalized NIAT Decision Report for:`,
      `Parent: ${parent_name}, Child: ${child_name}`,
      `City: ${city || "Not specified"}, Campus preference: ${campus || "Not specified"}`,
      `Budget range: ${budget_range || "Not sure"}, Language: ${language || "en"}`,
      `Primary concern: ${primary_concern || "General inquiry"}`,
      ``,
      `Include the following structured sections:`,
      `1. degree_and_upskilling — Clarify that the university degree is awarded by NIAT's collaborating university (not NxtWave) and NIAT provides the industry upskilling layer.`,
      `2. campus_fit — Why the preferred campus is appropriate and hostel details.`,
      `3. fee_context — Fee context noting transparent EMI and scholarship options (state that a counselor will confirm exact figures).`,
      `4. your_concern — Honest response directly addressing the primary concern.`,
      `5. career_path — Placement support access through NxtWave's 1000+ hiring network. Emphasize that placement is NOT guaranteed and depends on student performance.`,
      `6. next_step — Recommendation to book a 15-minute alignment call with a senior counselor.`,
    ].join("\n");

    // Run agent with tool loop
    const { reply, trace, toolResults } = await runAgent([
      { role: "user", content: userMessage },
    ]);

    // Compute intent score: prefer tool result if available, otherwise heuristic
    let intent_score = 30; // base for report completion
    if (budget_range && budget_range !== "Not sure") intent_score += 20;
    if (campus) intent_score += 25;

    const scoreTool = toolResults?.score_intent as
      | { intent_score?: number }
      | undefined;
    if (typeof scoreTool?.intent_score === "number") {
      intent_score = scoreTool.intent_score;
    }

    // Determine objection category from classifier tool or fallback
    let objection_category = primary_concern || "placement_anxiety";
    const classifyTool = toolResults?.classify_objection as
      | { category?: string }
      | undefined;
    if (classifyTool?.category) {
      objection_category = classifyTool.category;
    }

    // Insert lead
    const { data: lead, error: leadErr } = await supabaseAdmin
      .from("leads")
      .insert({
        parent_name,
        child_name,
        phone,
        city,
        campus,
        budget_range,
        language: language || "en",
        primary_concern,
        objection_category,
        report_completed: true,
        report_text: reply,
        intent_score,
        session_id,
      })
      .select("id")
      .single();

    if (leadErr) throw leadErr;
    const lead_id = lead.id;

    // Insert objection ledger row
    await supabaseAdmin.from("objection_ledger").insert({
      lead_id,
      objection_category,
      campus,
      language: language || "en",
    });

    // Insert outbox message with report link
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    await supabaseAdmin.from("outbox").insert({
      lead_id,
      phone,
      message_type: "report_link",
      message_text: `Hi ${parent_name}, your NIAT Decision Report for ${child_name} is ready: ${appUrl}/report/${lead_id}`,
      delivered: true,
    });

    return NextResponse.json({ lead_id, report: reply, trace, session_id });
  } catch (err: unknown) {
    console.error("[POST /api/report]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
