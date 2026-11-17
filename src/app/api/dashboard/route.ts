import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, memoryStore, isSupabaseConfigured } from "@/lib/supabase";

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

    let allLeads: any[] = [];
    let objections: any[] = [];

    try {
      let leadsQuery = supabaseAdmin
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (campusFilter) leadsQuery = leadsQuery.eq("campus", campusFilter);
      if (languageFilter) leadsQuery = leadsQuery.eq("language", languageFilter);

      const { data: leads, error: leadsErr } = await leadsQuery;
      if (!leadsErr && leads) {
        allLeads = leads;
      }
    } catch {
      // Fallback
    }

    if (allLeads.length === 0 && memoryStore.leads.length > 0) {
      allLeads = memoryStore.leads.filter((l) => {
        if (campusFilter && l.campus !== campusFilter) return false;
        if (languageFilter && l.language !== languageFilter) return false;
        return true;
      });
    }

    // Deduplicate leads by id so frontend never receives duplicate keys
    const seenLeadIds = new Set<string>();
    allLeads = allLeads.filter((l) => {
      if (!l || !l.id || seenLeadIds.has(l.id)) return false;
      seenLeadIds.add(l.id);
      return true;
    });

    // Compute funnel stats
    const total = allLeads.length;
    const report_completed = allLeads.filter((l) => l.report_completed).length;
    const voice_call_done = allLeads.filter((l) => l.voice_call_done).length;
    const counselor_booked = allLeads.filter((l) => l.counselor_booked).length;
    const conversion_pct =
      total > 0 ? Math.round((counselor_booked / total) * 100) : 0;

    // Fetch objection ledger counts grouped by category
    try {
      let objectionQuery = supabaseAdmin
        .from("objection_ledger")
        .select("objection_category");

      if (campusFilter) objectionQuery = objectionQuery.eq("campus", campusFilter);
      if (languageFilter)
        objectionQuery = objectionQuery.eq("language", languageFilter);

      const { data: objData, error: objErr } = await objectionQuery;
      if (!objErr && objData) {
        objections = objData;
      }
    } catch {
      // Fallback
    }

    if (objections.length === 0 && allLeads.length > 0) {
      objections = allLeads.map((l) => ({
        objection_category: l.objection_category || l.primary_concern,
      }));
    }

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
      database_mode: isSupabaseConfigured() ? "supabase" : "in_memory",
    });
  } catch (err: unknown) {
    console.error("[GET /api/dashboard]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
