import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OrgActions } from "@/components/org/org-actions";

export default async function OrgPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let org: any = null;
  let orgConfig: any = null;

  if (user) {
    const { data: userOrg } = await supabase
      .from("user_orgs")
      .select("org_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (userOrg) {
      const { data } = await supabase
        .from("orgs")
        .select("*")
        .eq("id", userOrg.org_id)
        .single();
      org = data;

      const { data: config } = await supabase
        .from("org_configs")
        .select("*")
        .eq("org_id", userOrg.org_id)
        .eq("is_active", true)
        .single();
      orgConfig = config;
    }
  }

  if (!org) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Organization</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              No organization found. Complete onboarding to set up your org.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isApproved = !!org.approved_at;
  const isActive = org.status === "ACTIVE";
  const intakeLinks = orgConfig?.config_json?.intake_links || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Organization</h1>
        <p className="text-muted-foreground">{org.name}</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Status</CardTitle>
              <CardDescription>
                Your org must be approved and activated to receive leads
              </CardDescription>
            </div>
            <Badge variant={isActive ? "default" : "secondary"}>
              {org.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Approved:</span>
              <span>{isApproved ? "Yes" : "Not yet"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Slug:</span>
              <code className="rounded bg-muted px-1">{org.slug}</code>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Timezone:</span>
              <span>{org.timezone}</span>
            </div>
          </div>
          <OrgActions
            orgId={org.id}
            isApproved={isApproved}
            isActive={isActive}
          />
        </CardContent>
      </Card>

      {intakeLinks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Public Intake Links</CardTitle>
            <CardDescription>Share these with your customers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {intakeLinks.map((link: string) => (
              <div
                key={link}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <code className="text-sm">{link}</code>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>
            Connect your calendar, payment, and messaging providers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {["Google Calendar", "Microsoft Calendar", "Stripe", "Square", "Twilio SMS"].map(
            (name) => (
              <div
                key={name}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <span className="text-sm font-medium">{name}</span>
                <Badge variant="secondary">Coming soon</Badge>
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
