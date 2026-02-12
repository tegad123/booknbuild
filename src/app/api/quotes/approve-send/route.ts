import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { quote_id } = await request.json();
  if (!quote_id) {
    return NextResponse.json({ error: "quote_id required" }, { status: 400 });
  }

  // Get user's active org
  const { data: userOrg } = await supabase
    .from("user_orgs")
    .select("org_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  if (!userOrg) {
    return NextResponse.json({ error: "No active org" }, { status: 403 });
  }

  // Get quote and verify ownership
  const { data: quote } = await supabase
    .from("quotes")
    .select("id, org_id, lead_id, status, needs_approval")
    .eq("id", quote_id)
    .eq("org_id", userOrg.org_id)
    .single();

  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  if (quote.status !== "draft" && quote.status !== "needs_approval") {
    return NextResponse.json(
      { error: `Quote is already ${quote.status}` },
      { status: 400 }
    );
  }

  // Approve: clear needs_approval flag and enqueue send
  await supabase
    .from("quotes")
    .update({ needs_approval: false, status: "draft" })
    .eq("id", quote_id);

  // Enqueue send_quote task
  await supabase.from("tasks").insert({
    org_id: userOrg.org_id,
    lead_id: quote.lead_id,
    type: "send_quote",
    run_at: new Date().toISOString(),
    payload_json: { quote_id },
    status: "queued",
  });

  // Log event
  await supabase.from("events").insert({
    org_id: userOrg.org_id,
    type: "quote_approved",
    lead_id: quote.lead_id,
    metadata_json: {
      quote_id,
      approved_by: user.id,
    },
  });

  return NextResponse.json({ success: true });
}
