import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { IntakeForm } from "@/components/intake/intake-form";

export default async function IntakePage({
  params,
}: {
  params: Promise<{ orgSlug: string; niche: string }>;
}) {
  const { orgSlug, niche } = await params;

  // Use service role — public page, no auth
  const supabase = await createServiceClient();

  // Fetch org (only safe fields)
  const { data: org } = await supabase
    .from("orgs")
    .select("id, slug, name, status, brand_json")
    .eq("slug", orgSlug)
    .eq("status", "ACTIVE")
    .single();

  if (!org) notFound();

  // Fetch active config (only safe fields)
  const { data: config } = await supabase
    .from("org_configs")
    .select("config_json")
    .eq("org_id", org.id)
    .eq("is_active", true)
    .single();

  if (!config) notFound();

  const intakeSchema = (config.config_json as any)?.intake_schema;
  const brandJson = org.brand_json as any;

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: brandJson?.color ? `${brandJson.color}10` : "#f8fafc" }}
    >
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8 text-center">
          {brandJson?.logo_url && (
            <img
              src={brandJson.logo_url}
              alt={org.name}
              className="mx-auto mb-4 h-16 w-auto"
            />
          )}
          <h1 className="text-3xl font-bold">{org.name}</h1>
          <p className="mt-2 text-muted-foreground">
            Get your free {niche} estimate
          </p>
        </div>
        <IntakeForm
          orgId={org.id}
          orgSlug={org.slug}
          niche={niche}
          questions={intakeSchema?.questions || []}
          brandColor={brandJson?.color || "#2563eb"}
        />
      </div>
    </div>
  );
}
