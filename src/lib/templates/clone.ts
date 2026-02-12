import { SupabaseClient } from "@supabase/supabase-js";
import type { TemplateJson } from "./seed-data";

/**
 * Clone the current org's config/messages/followups into a new template.
 * Useful for creating org-specific templates from a running configuration.
 */
export async function cloneFromOrg(
  supabase: SupabaseClient,
  orgId: string,
  templateName: string,
  niche: string
): Promise<{ id: string }> {
  // 1. Get active org_config
  const { data: config, error: configErr } = await supabase
    .from("org_configs")
    .select("config_json")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .single();

  if (configErr || !config) throw new Error("No active org config found");

  // 2. Get message_templates
  const { data: messages } = await supabase
    .from("message_templates")
    .select("channel, name, body, variables_json")
    .eq("org_id", orgId);

  // 3. Get followup_rules
  const { data: followups } = await supabase
    .from("followup_rules")
    .select("trigger, steps_json")
    .eq("org_id", orgId)
    .eq("enabled", true);

  // 4. Assemble template_json
  const templateJson: TemplateJson = {
    org_config: {
      pricing: config.config_json.pricing || {},
      measurement_thresholds: config.config_json.measurement_thresholds || {},
      booking: config.config_json.booking || {},
    },
    intake_schema: config.config_json.intake_schema || { questions: [] },
    message_templates: (messages || []).map((m) => ({
      channel: m.channel,
      name: m.name,
      body: m.body,
      variables: m.variables_json || [],
    })),
    followup_rules: (followups || []).map((f) => ({
      trigger: f.trigger,
      steps: f.steps_json || [],
    })),
    slot_strategy: config.config_json.slot_strategy || {
      duration_minutes: 120,
      lead_time_hours: 48,
      buffer_minutes: 30,
      max_per_day: 3,
      working_hours: { start: 8, end: 17 },
    },
  };

  // 5. Insert as new template
  const { data: template, error: insertErr } = await supabase
    .from("templates")
    .insert({
      niche,
      name: templateName,
      template_json: templateJson,
    })
    .select("id")
    .single();

  if (insertErr) throw insertErr;
  return template;
}
