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

  const { org_id } = await request.json();

  // Verify membership
  const { data: membership } = await supabase
    .from("user_orgs")
    .select("role")
    .eq("user_id", user.id)
    .eq("org_id", org_id)
    .single();

  if (!membership || membership.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check org is approved
  const { data: org } = await supabase
    .from("orgs")
    .select("approved_at, status")
    .eq("id", org_id)
    .single();

  if (!org) {
    return NextResponse.json({ error: "Org not found" }, { status: 404 });
  }

  if (!org.approved_at) {
    return NextResponse.json(
      { error: "Org must be approved before activation" },
      { status: 400 }
    );
  }

  if (org.status === "ACTIVE") {
    return NextResponse.json({ error: "Org is already active" }, { status: 400 });
  }

  // Activate
  const { error } = await supabase
    .from("orgs")
    .update({ status: "ACTIVE" })
    .eq("id", org_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
