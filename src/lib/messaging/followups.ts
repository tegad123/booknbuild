import { SupabaseClient } from "@supabase/supabase-js";

interface FollowupStep {
  delay_hours: number;
  channel: "sms" | "email";
  template_name: string;
}

interface FollowupRule {
  id: string;
  trigger: string;
  steps_json: FollowupStep[];
  enabled: boolean;
}

/**
 * Stop conditions: don't send follow-ups if any of these are true.
 */
async function shouldStopFollowups(
  supabase: SupabaseClient,
  orgId: string,
  leadId: string
): Promise<{ stop: boolean; reason?: string }> {
  // Check if lead has booked
  const { data: appointment } = await supabase
    .from("appointments")
    .select("id")
    .eq("org_id", orgId)
    .eq("lead_id", leadId)
    .in("status", ["confirmed", "pending_payment", "pending_hold"])
    .limit(1)
    .single();

  if (appointment) return { stop: true, reason: "booking_exists" };

  // Check if payment received
  const { data: payment } = await supabase
    .from("payments")
    .select("id")
    .eq("org_id", orgId)
    .eq("lead_id", leadId)
    .eq("status", "paid")
    .limit(1)
    .single();

  if (payment) return { stop: true, reason: "payment_received" };

  // Check if lead opted out (STOP)
  const { data: stopMessage } = await supabase
    .from("messages")
    .select("id")
    .eq("org_id", orgId)
    .eq("lead_id", leadId)
    .eq("direction", "inbound")
    .ilike("body", "%stop%")
    .limit(1)
    .single();

  if (stopMessage) return { stop: true, reason: "opt_out" };

  // Check if lead is marked lost
  const { data: lead } = await supabase
    .from("leads")
    .select("status")
    .eq("id", leadId)
    .single();

  if (lead?.status === "lost") return { stop: true, reason: "lead_lost" };

  return { stop: false };
}

/**
 * Evaluate and schedule follow-up tasks based on a trigger event.
 */
export async function scheduleFollowups(
  supabase: SupabaseClient,
  orgId: string,
  leadId: string,
  trigger: string,
  context: Record<string, string>
) {
  // Check stop conditions
  const { stop, reason } = await shouldStopFollowups(supabase, orgId, leadId);
  if (stop) {
    await supabase.from("events").insert({
      org_id: orgId,
      type: "followup_stopped",
      lead_id: leadId,
      metadata_json: { trigger, reason },
    });
    return;
  }

  // Get active follow-up rules for this trigger
  const { data: rules } = await supabase
    .from("followup_rules")
    .select("id, trigger, steps_json, enabled")
    .eq("org_id", orgId)
    .eq("trigger", trigger)
    .eq("enabled", true);

  if (!rules || rules.length === 0) return;

  for (const rule of rules as FollowupRule[]) {
    const steps = rule.steps_json;
    if (!steps || steps.length === 0) continue;

    for (const step of steps) {
      const runAt = new Date(
        Date.now() + step.delay_hours * 60 * 60 * 1000
      ).toISOString();

      await supabase.from("tasks").insert({
        org_id: orgId,
        lead_id: leadId,
        type: "send_followup",
        run_at: runAt,
        payload_json: {
          channel: step.channel,
          template_name: step.template_name,
          context,
          rule_id: rule.id,
        },
        status: "queued",
      });
    }
  }

  await supabase.from("events").insert({
    org_id: orgId,
    type: "followups_scheduled",
    lead_id: leadId,
    metadata_json: {
      trigger,
      rule_count: rules.length,
    },
  });
}
