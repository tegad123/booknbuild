import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LeadsTable } from "@/components/leads/leads-table";

export default async function LeadsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Get active org
  const { data: userOrg } = await supabase
    .from("user_orgs")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  if (!userOrg) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Leads</h1>
        <p className="text-muted-foreground">No organization selected.</p>
      </div>
    );
  }

  const { data: leads } = await supabase
    .from("leads")
    .select("id, name, phone, email, address, niche, status, created_at, last_contact_at")
    .eq("org_id", userOrg.org_id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Leads</h1>
        <p className="text-muted-foreground">Manage your incoming leads</p>
      </div>
      <LeadsTable leads={leads || []} />
    </div>
  );
}
