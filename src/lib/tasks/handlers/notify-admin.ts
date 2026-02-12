import { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/messaging/email";
import { registerHandler } from "../runner";

async function handleNotifyAdmin(supabase: SupabaseClient, task: any) {
  const { quote_id, reason } = task.payload_json;

  // 1. Get org config for notification settings
  const { data: orgConfig } = await supabase
    .from("org_configs")
    .select("config_json")
    .eq("org_id", task.org_id)
    .eq("is_active", true)
    .single();

  const config = orgConfig?.config_json as any;
  const notificationEmail = config?.notification_email;

  // 2. Get lead info for context
  const { data: lead } = await supabase
    .from("leads")
    .select("name, phone, email, address")
    .eq("id", task.lead_id)
    .single();

  // 3. Get org info
  const { data: org } = await supabase
    .from("orgs")
    .select("name")
    .eq("id", task.org_id)
    .single();

  if (notificationEmail) {
    await sendEmail({
      to: notificationEmail,
      subject: `Quote needs approval - ${lead?.name || "Unknown"}`,
      html: `
        <h2>Quote Needs Your Approval</h2>
        <p><strong>Customer:</strong> ${lead?.name || "Unknown"}</p>
        <p><strong>Phone:</strong> ${lead?.phone || "N/A"}</p>
        <p><strong>Email:</strong> ${lead?.email || "N/A"}</p>
        <p><strong>Address:</strong> ${lead?.address || "N/A"}</p>
        <p><strong>Reason:</strong> ${reason}</p>
        <p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/app/leads/${task.lead_id}">
            Review Quote
          </a>
        </p>
      `,
    });
  }

  // 4. Log event
  await supabase.from("events").insert({
    org_id: task.org_id,
    type: "admin_notified",
    lead_id: task.lead_id,
    metadata_json: {
      quote_id,
      reason,
      notification_email: notificationEmail || "none",
    },
  });
}

registerHandler("notify_admin_approval", handleNotifyAdmin);
