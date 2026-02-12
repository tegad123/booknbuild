import { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { encryptJson } from "@/lib/encryption";
import {
  FENCE_TEMPLATE,
  ROOF_TEMPLATE,
  CONCRETE_TEMPLATE,
  type TemplateJson,
} from "@/lib/templates/seed-data";
import crypto from "crypto";

// ─── Zod schema: EXACT contract from spec ──────────────────────────

const brandSchema = z.object({
  logo_url: z.string().optional(),
  primary_color: z.string().optional(),
  accent_color: z.string().optional(),
  reply_to: z.string().optional(),
  support_phone: z.string().optional(),
});

const twilioSchema = z.object({
  sid: z.string().min(1, "Twilio SID is required"),
  token: z.string().min(1, "Twilio auth token is required"),
  from_number: z.string().min(1, "Twilio from number is required"),
});

const integrationsSchema = z.object({
  twilio: twilioSchema.optional(),
  calendar_provider: z.enum(["google", "microsoft", "unknown"]).optional(),
  payment_provider: z.enum(["stripe", "square", "either"]).optional(),
});

export const onboardingSchema = z.object({
  company_name: z.string().trim(),
  owner_email: z.string().trim().email("Valid owner email is required"),
  contact_name: z.string().trim().optional(),
  contact_phone: z.string().trim().optional(),
  org_slug: z.string().min(1).optional(),
  niches: z
    .union([
      z.array(z.string()),
      z.string(),
    ])
    .transform((val) => {
      // Handle comma-separated string from forms: "Fencing, Roofing" → ["fencing","roofing"]
      const arr = typeof val === "string" ? val.split(",").map((s) => s.trim()) : val;
      return arr.map((s) => s.toLowerCase());
    })
    .pipe(
      z.array(z.enum(["fencing", "roofing", "concrete"])).min(1, "At least one niche is required")
    ),
  brand: brandSchema.default({}),
  integrations: integrationsSchema.optional(),
  org_config: z.record(z.string(), z.unknown()).default({}),
});

export type OnboardingPayload = z.infer<typeof onboardingSchema>;

// ─── Helpers ────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const TEMPLATE_MAP: Record<string, TemplateJson> = {
  fencing: FENCE_TEMPLATE,
  roofing: ROOF_TEMPLATE,
  concrete: CONCRETE_TEMPLATE,
};

const TEMPLATE_ID_MAP: Record<string, string> = {
  fencing: "a0000000-0000-0000-0000-000000000001",
  roofing: "a0000000-0000-0000-0000-000000000002",
  concrete: "a0000000-0000-0000-0000-000000000003",
};

/**
 * Deep merge: target values override source values.
 * For objects, recurse. For arrays and primitives, target wins.
 */
export function deepMerge(
  source: Record<string, unknown>,
  target: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...source };
  for (const key of Object.keys(target)) {
    const sv = source[key];
    const tv = target[key];
    if (
      tv !== null &&
      tv !== undefined &&
      typeof tv === "object" &&
      !Array.isArray(tv) &&
      sv !== null &&
      sv !== undefined &&
      typeof sv === "object" &&
      !Array.isArray(sv)
    ) {
      result[key] = deepMerge(
        sv as Record<string, unknown>,
        tv as Record<string, unknown>
      );
    } else if (tv !== undefined) {
      result[key] = tv;
    }
  }
  return result;
}

/**
 * Build the template defaults from the primary niche.
 * Returns a flat config object with all template sections.
 */
function templateDefaultsFor(niches: string[]): Record<string, unknown> {
  const primaryNiche = niches[0];
  const template = TEMPLATE_MAP[primaryNiche];

  return {
    pricing: template.org_config.pricing,
    measurement_thresholds: template.org_config.measurement_thresholds,
    booking: template.org_config.booking,
    intake_schema: template.intake_schema,
    slot_strategy: template.slot_strategy,
  };
}

/**
 * Build the final org_config by merging template defaults with payload overrides.
 */
export function buildOrgConfig(
  payload: OnboardingPayload
): Record<string, unknown> {
  const defaults = templateDefaultsFor(payload.niches);
  const overrides = payload.org_config as Record<string, unknown>;
  const merged = deepMerge(defaults, overrides);

  // Inject metadata
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const slug = payload.org_slug || slugify(payload.company_name);
  merged.metadata = {
    owner_email: payload.owner_email,
    contact_name: payload.contact_name || null,
    contact_phone: payload.contact_phone || null,
  };
  merged.intake_links = payload.niches.map(
    (niche) => `${appUrl}/i/${slug}/${niche}`
  );

  return merged;
}

/**
 * Resolve message templates: org_config overrides win, else template defaults.
 * Looks for org_config.message_templates in the merged config.
 */
export function resolveMessageTemplates(
  payload: OnboardingPayload
): Array<{ channel: string; name: string; body: string; variables: string[] }> {
  const primaryNiche = payload.niches[0];
  const template = TEMPLATE_MAP[primaryNiche];

  // Check if org_config has message_templates override
  const configOverrides = (payload.org_config as any)?.message_templates as
    | Array<{ channel: string; name: string; body: string; variables: string[] }>
    | undefined;

  if (configOverrides && configOverrides.length > 0) {
    // Merge: org_config templates override by channel+name key, fallback to defaults
    const overrideMap = new Map(
      configOverrides.map((mt) => [`${mt.channel}:${mt.name}`, mt])
    );
    const result = template.message_templates.map((defaultMt) => {
      const key = `${defaultMt.channel}:${defaultMt.name}`;
      return overrideMap.get(key) || defaultMt;
    });
    // Add any override templates not present in defaults
    for (const mt of configOverrides) {
      const key = `${mt.channel}:${mt.name}`;
      if (
        !template.message_templates.some(
          (d) => `${d.channel}:${d.name}` === key
        )
      ) {
        result.push(mt);
      }
    }
    return result;
  }

  // Replace {{company}} in default templates with actual company name
  return template.message_templates.map((mt) => ({
    ...mt,
    body: mt.body.replace(/\{\{company\}\}/g, payload.company_name),
  }));
}

/**
 * Resolve follow-up rules: org_config overrides win, else template defaults.
 */
export function resolveFollowupRules(
  payload: OnboardingPayload
): Array<{
  trigger: string;
  steps: Array<{ delay_hours: number; channel: string; template_name: string }>;
}> {
  const configOverrides = (payload.org_config as any)?.followup_rules as
    | Array<{
        trigger: string;
        steps: Array<{ delay_hours: number; channel: string; template_name: string }>;
      }>
    | undefined;

  if (configOverrides && configOverrides.length > 0) {
    return configOverrides;
  }

  const primaryNiche = payload.niches[0];
  const template = TEMPLATE_MAP[primaryNiche];
  return template.followup_rules;
}

// ─── Main processor ─────────────────────────────────────────────────

export async function processOnboardingImport(
  supabase: SupabaseClient,
  payload: OnboardingPayload
) {
  // Fallback: if company_name is empty, derive from owner_email
  if (!payload.company_name) {
    payload.company_name = payload.owner_email.split("@")[0] + "-co";
  }

  const slug = payload.org_slug || slugify(payload.company_name);

  // 1. Check slug uniqueness
  const { data: existingSlugs } = await supabase
    .from("orgs")
    .select("id")
    .eq("slug", slug)
    .limit(1);

  if (existingSlugs && existingSlugs.length > 0) {
    throw new OnboardingError(
      `Organization slug "${slug}" is already taken. Provide a unique org_slug or change the company name.`,
      "SLUG_TAKEN"
    );
  }

  // 2. Create org row
  const approvalToken = crypto.randomUUID();
  const { data: org, error: orgError } = await supabase
    .from("orgs")
    .insert({
      slug,
      name: payload.company_name,
      status: "PENDING",
      brand_json: {
        primary_color: payload.brand.primary_color || "#2563eb",
        accent_color: payload.brand.accent_color || null,
        logo_url: payload.brand.logo_url || null,
        reply_to: payload.brand.reply_to || null,
        support_phone: payload.brand.support_phone || null,
        company_name: payload.company_name,
        owner_email: payload.owner_email,
      },
      approval_token: approvalToken,
      approved_at: null,
    })
    .select()
    .single();

  if (orgError) throw orgError;

  // 3. Build merged org_config and create org_configs v1
  const mergedConfig = buildOrgConfig(payload);

  const { error: configError } = await supabase.from("org_configs").insert({
    org_id: org.id,
    version: 1,
    config_json: mergedConfig,
    is_active: true,
  });

  if (configError) throw configError;

  // 4. Log template application for primary niche
  const primaryNiche = payload.niches[0];
  const templateId = TEMPLATE_ID_MAP[primaryNiche];
  await supabase
    .from("template_applies")
    .insert({ org_id: org.id, template_id: templateId });

  // 5. Seed message templates (org_config wins, else template defaults)
  const messageTemplates = resolveMessageTemplates(payload);
  if (messageTemplates.length > 0) {
    const rows = messageTemplates.map((mt) => ({
      org_id: org.id,
      channel: mt.channel,
      name: mt.name,
      body: mt.body,
      variables_json: mt.variables,
    }));
    const { error: mtError } = await supabase
      .from("message_templates")
      .insert(rows);
    if (mtError) throw mtError;
  }

  // 6. Seed follow-up rules (org_config wins, else template defaults)
  const followupRules = resolveFollowupRules(payload);
  if (followupRules.length > 0) {
    const rows = followupRules.map((fr) => ({
      org_id: org.id,
      trigger: fr.trigger,
      steps_json: fr.steps,
      enabled: true,
    }));
    const { error: frError } = await supabase
      .from("followup_rules")
      .insert(rows);
    if (frError) throw frError;
  }

  // 7. Store Twilio creds (encrypted) + org_phone_numbers if provided
  if (payload.integrations?.twilio) {
    const twilio = payload.integrations.twilio;
    const encrypted = encryptJson({
      account_sid: twilio.sid,
      auth_token: twilio.token,
      phone_number: twilio.from_number,
    });

    await supabase.from("org_channels").insert({
      org_id: org.id,
      channel_type: "sms",
      provider: "twilio",
      config_encrypted: encrypted,
      is_active: true,
    });

    await supabase.from("org_phone_numbers").insert({
      org_id: org.id,
      e164: twilio.from_number,
    });
  }

  // 8. Build response
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const intakeLinks = payload.niches.map(
    (niche) => `${appUrl}/i/${slug}/${niche}`
  );

  const integrationLinks: Record<string, string> = {};
  if (payload.integrations?.calendar_provider && payload.integrations.calendar_provider !== "unknown") {
    integrationLinks.calendar = `${appUrl}/api/integrations/${payload.integrations.calendar_provider}-calendar`;
  }
  if (payload.integrations?.payment_provider && payload.integrations.payment_provider !== "either") {
    integrationLinks.payment = `${appUrl}/api/integrations/${payload.integrations.payment_provider}`;
  }

  return {
    org_id: org.id,
    slug,
    approval_token: approvalToken,
    intake_links: intakeLinks,
    integration_links: integrationLinks,
    config_summary: {
      niches: payload.niches,
      primary_niche: primaryNiche,
      has_twilio: !!payload.integrations?.twilio,
      message_template_count: messageTemplates.length,
      followup_rule_count: followupRules.length,
      deposit_percent:
        (mergedConfig as any).booking?.deposit_percent ?? 25,
      slot_duration_minutes:
        (mergedConfig as any).slot_strategy?.duration_minutes ?? 120,
    },
  };
}

// ─── Custom error class ─────────────────────────────────────────────

export class OnboardingError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "OnboardingError";
    this.code = code;
  }
}
