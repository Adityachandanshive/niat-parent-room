import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    // Auth check
    const key = req.nextUrl.searchParams.get("key");
    const dashboardKey = process.env.DASHBOARD_KEY;

    if (!dashboardKey || key !== dashboardKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Optional filters
    const campusFilter = req.nextUrl.searchParams.get("campus");
    const languageFilter = req.nextUrl.searchParams.get("language");

    // Build leads query
    let leadsQuery = supabaseAdmin
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (campusFilter) leadsQuery = leadsQuery.eq("campus", campusFilter);
    if (languageFilter) leadsQuery = leadsQuery.eq("language", languageFilter);

    const { data: leads, error: leadsErr } = await leadsQuery;
    if (leadsErr) throw leadsErr;

    const allLeads = leads || [];

    // Compute funnel stats
    const total = allLeads.length;
    const report_completed = allLeads.filter((l) => l.report_completed).length;
    const voice_call_done = allLeads.filter((l) => l.voice_call_done).length;
    const counselor_booked = allLeads.filter((l) => l.counselor_booked).length;
    const conversion_pct =
      total > 0 ? Math.round((counselor_booked / total) * 100) : 0;

    // Fetch objection ledger counts grouped by category
    let objectionQuery = supabaseAdmin
      .from("objection_ledger")
      .select("objection_category");

    if (campusFilter) objectionQuery = objectionQuery.eq("campus", campusFilter);
    if (languageFilter)
      objectionQuery = objectionQuery.eq("language", languageFilter);

    const { data: objections, error: objErr } = await objectionQuery;
    if (objErr) throw objErr;

    const objection_counts: Record<string, number> = {};
    for (const row of objections || []) {
      const cat = row.objection_category || "uncategorized";
      objection_counts[cat] = (objection_counts[cat] || 0) + 1;
    }

    return NextResponse.json({
      leads: allLeads,
      funnel: {
        total,
        report_completed,
        voice_call_done,
        counselor_booked,
        conversion_pct,
      },
      objection_counts,
    });
  } catch (err: unknown) {
    console.error("[GET /api/dashboard]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
