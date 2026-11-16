import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const { data: lead, error } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !lead) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ lead, report_text: lead.report_text });
  } catch (err: unknown) {
    console.error("[GET /api/report/:id]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
