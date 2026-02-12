import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { LeadDetail } from "@/components/leads/lead-detail";
import { QuoteApproval } from "@/components/leads/quote-approval";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  if (!userOrg) redirect("/app");

  // Fetch lead
  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .eq("org_id", userOrg.org_id)
    .single();

  if (!lead) notFound();

  // Fetch related data
  const [
    { data: intake },
    { data: measurements },
    { data: quotes },
    { data: events },
    { data: messages },
  ] = await Promise.all([
    supabase
      .from("intake_submissions")
      .select("*")
      .eq("lead_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("measurements")
      .select("*")
      .eq("lead_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("quotes")
      .select("*")
      .eq("lead_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("events")
      .select("*")
      .eq("lead_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("messages")
      .select("*")
      .eq("lead_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <div className="space-y-6">
      <LeadDetail
        lead={lead}
        intake={intake}
        measurements={measurements || []}
        events={events || []}
        messages={messages || []}
      />

      {quotes && quotes.length > 0 && (
        <QuoteApproval quotes={quotes} orgId={userOrg.org_id} />
      )}
    </div>
  );
}
