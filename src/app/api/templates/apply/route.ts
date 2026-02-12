import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyTemplate } from "@/lib/templates/apply";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { org_id, template_id } = await request.json();
  if (!org_id || !template_id) {
    return NextResponse.json(
      { error: "org_id and template_id required" },
      { status: 400 }
    );
  }

  // Verify user belongs to org
  const { data: membership } = await supabase
    .from("user_orgs")
    .select("role")
    .eq("user_id", user.id)
    .eq("org_id", org_id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Not a member of this org" }, { status: 403 });
  }

  // Get template
  const { data: template, error: tplErr } = await supabase
    .from("templates")
    .select("*")
    .eq("id", template_id)
    .single();

  if (tplErr || !template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  try {
    const config = await applyTemplate(
      supabase,
      org_id,
      template_id,
      template.template_json
    );
    return NextResponse.json({ success: true, config });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
