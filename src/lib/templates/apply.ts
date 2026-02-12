import { SupabaseClient } from "@supabase/supabase-js";
import type { TemplateJson } from "./seed-data";

/**
 * Apply a template to an org:
 * 1. Creates a new org_config version
 * 2. Creates message_templates from defaults
 * 3. Creates followup_rules from defaults
 * 4. Logs the template_applies record
 */
export async function applyTemplate(
  supabase: SupabaseClient,
  orgId: string,
  templateId: string,
  templateJson: TemplateJson,
  brandOverrides?: Record<string, string>
) {
  // 1. Get current max version for this org
  const { data: existing } = await supabase
    .from("org_configs")
    .select("version")
    .eq("org_id", orgId)
    .order("version", { ascending: false })
    .limit(1);

  const nextVersion = existing && existing.length > 0 ? existing[0].version + 1 : 1;

  // Deactivate old configs
  await supabase
    .from("org_configs")
    .update({ is_active: false })
    .eq("org_id", orgId);

  // 2. Create new org_config
  const configJson = {
    ...templateJson.org_config,
    intake_schema: templateJson.intake_schema,
    slot_strategy: templateJson.slot_strategy,
  };

  const { data: orgConfig, error: configError } = await supabase
    .from("org_configs")
    .insert({
      org_id: orgId,
      version: nextVersion,
      config_json: configJson,
      is_active: true,
    })
    .select()
    .single();

  if (configError) throw configError;

  // 3. Create message_templates
  const messageTpls = templateJson.message_templates.map((mt) => ({
    org_id: orgId,
    channel: mt.channel,
    name: mt.name,
    body: applyBrandOverrides(mt.body, brandOverrides),
    variables_json: mt.variables,
  }));

  if (messageTpls.length > 0) {
    const { error: mtError } = await supabase
      .from("message_templates")
      .insert(messageTpls);
    if (mtError) throw mtError;
  }

  // 4. Create followup_rules
  const followups = templateJson.followup_rules.map((fr) => ({
    org_id: orgId,
    trigger: fr.trigger,
    steps_json: fr.steps,
    enabled: true,
  }));

  if (followups.length > 0) {
    const { error: frError } = await supabase
      .from("followup_rules")
      .insert(followups);
    if (frError) throw frError;
  }

  // 5. Log template application
  const { error: applyError } = await supabase
    .from("template_applies")
    .insert({ org_id: orgId, template_id: templateId });
  if (applyError) throw applyError;

  return orgConfig;
}

function applyBrandOverrides(
  body: string,
  overrides?: Record<string, string>
): string {
  if (!overrides) return body;
  let result = body;
  for (const [key, value] of Object.entries(overrides)) {
    result = result.replace(new RegExp(`{{${key}}}`, "g"), value);
  }
  return result;
}
