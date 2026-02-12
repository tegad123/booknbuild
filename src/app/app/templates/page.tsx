import { createClient } from "@/lib/supabase/server";
import { TemplateList } from "@/components/templates/template-list";

export default async function TemplatesPage() {
  const supabase = await createClient();

  const { data: templates } = await supabase
    .from("templates")
    .select("*")
    .order("niche");

  // Get user's active org
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let orgId: string | null = null;
  if (user) {
    const { data: userOrg } = await supabase
      .from("user_orgs")
      .select("org_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();
    orgId = userOrg?.org_id ?? null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Templates</h1>
        <p className="text-muted-foreground">
          Manage niche templates for your organization
        </p>
      </div>
      <TemplateList
        templates={templates ?? []}
        orgId={orgId}
      />
    </div>
  );
}
