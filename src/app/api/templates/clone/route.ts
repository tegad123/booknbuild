import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cloneFromOrg } from "@/lib/templates/clone";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { org_id, name } = await request.json();
  if (!org_id || !name) {
    return NextResponse.json(
      { error: "org_id and name required" },
      { status: 400 }
    );
  }

  // Verify user belongs to org and get org niche
  const { data: membership } = await supabase
    .from("user_orgs")
    .select("role, orgs(id, slug)")
    .eq("user_id", user.id)
    .eq("org_id", org_id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Not a member of this org" }, { status: 403 });
  }

  // Get niche from the org's active config or template_applies
  const { data: lastApply } = await supabase
    .from("template_applies")
    .select("templates(niche)")
    .eq("org_id", org_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const niche = (lastApply?.templates as any)?.niche ?? "fencing";

  try {
    const template = await cloneFromOrg(supabase, org_id, name, niche);
    return NextResponse.json({ success: true, template_id: template.id });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
