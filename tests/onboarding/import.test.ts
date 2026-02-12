import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  onboardingSchema,
  deepMerge,
  buildOrgConfig,
  resolveMessageTemplates,
  resolveFollowupRules,
  processOnboardingImport,
  OnboardingError,
  type OnboardingPayload,
} from "@/lib/onboarding/import";

// ─── Sample payload fixture ────────────────────────────────────────
// Represents what Make/Zapier sends after mapping 100+ Google Form answers.
// There is NO Google Form parsing code in this repo.

const SAMPLE_FIXTURE: OnboardingPayload = {
  company_name: "Acme Fencing Co",
  owner_email: "john@acmefencing.com",
  contact_name: "John Smith",
  contact_phone: "+15551234567",
  org_slug: "acme-fencing",

  niches: ["fencing"],

  brand: {
    primary_color: "#1a5f2a",
    accent_color: "#facc15",
    logo_url: "https://acmefencing.com/logo.png",
    reply_to: "support@acmefencing.com",
    support_phone: "+15551234567",
  },

  integrations: {
    twilio: {
      sid: "AC1234567890abcdef1234567890abcdef",
      token: "test_auth_token_1234567890abcdef",
      from_number: "+15559876543",
    },
    calendar_provider: "google",
    payment_provider: "stripe",
  },

  org_config: {
    pricing: {
      labor_per_lf: 3000, // override template default of 2500
      materials: {
        wood_6ft: { cost_per_lf: 2000, markup: 1.5 },
      },
    },
    measurement_thresholds: {
      auto_quote_confidence: 0.85,
    },
    booking: {
      deposit_percent: 30,
      deposit_required: true,
      payment_timing: "before_booking",
    },
  },
};

// Minimal valid payload (only required fields)
const MINIMAL_FIXTURE = {
  company_name: "Quick Fence LLC",
  owner_email: "jane@quickfence.com",
  niches: ["fencing" as const],
};

// ─── Mock helpers for Supabase ─────────────────────────────────────

function createMockSupabase() {
  const insertedRows: Record<string, any[]> = {};
  const mockOrg = {
    id: "org-uuid-123",
    slug: "acme-fencing",
    name: "Acme Fencing Co",
    status: "PENDING",
  };

  const chainable = (tableName: string) => {
    const chain: any = {
      _table: tableName,
      _isInsert: false,
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(() => {
        if (tableName === "orgs" && chain._isInsert) {
          return Promise.resolve({ data: mockOrg, error: null });
        }
        // slug uniqueness check: return empty (no conflict)
        return Promise.resolve({ data: null, error: { code: "PGRST116" } });
      }),
      insert: vi.fn().mockImplementation((rows: any) => {
        chain._isInsert = true;
        const arr = Array.isArray(rows) ? rows : [rows];
        if (!insertedRows[tableName]) insertedRows[tableName] = [];
        insertedRows[tableName].push(...arr);
        return chain;
      }),
    };
    return chain;
  };

  const supabase = {
    from: vi.fn().mockImplementation((table: string) => chainable(table)),
    _inserted: insertedRows,
  };

  return supabase as any;
}

// ─── Schema Validation Tests (B) ───────────────────────────────────

describe("onboardingSchema (B)", () => {
  it("accepts the full SAMPLE_FIXTURE", () => {
    const result = onboardingSchema.safeParse(SAMPLE_FIXTURE);
    expect(result.success).toBe(true);
  });

  it("accepts minimal payload with defaults", () => {
    const result = onboardingSchema.safeParse(MINIMAL_FIXTURE);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.brand).toBeDefined();
      expect(result.data.org_config).toBeDefined();
      expect(result.data.integrations).toBeUndefined();
    }
  });

  it("rejects missing company_name", () => {
    const invalid = { ...MINIMAL_FIXTURE, company_name: undefined };
    const result = onboardingSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects missing owner_email", () => {
    const invalid = { ...MINIMAL_FIXTURE, owner_email: undefined };
    const result = onboardingSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects invalid owner_email", () => {
    const invalid = { ...MINIMAL_FIXTURE, owner_email: "not-an-email" };
    const result = onboardingSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects empty niches array", () => {
    const invalid = { ...MINIMAL_FIXTURE, niches: [] };
    const result = onboardingSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects invalid niche value", () => {
    const invalid = { ...MINIMAL_FIXTURE, niches: ["plumbing"] };
    const result = onboardingSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("accepts multiple valid niches", () => {
    const multi = { ...MINIMAL_FIXTURE, niches: ["fencing", "roofing", "concrete"] };
    const result = onboardingSchema.safeParse(multi);
    expect(result.success).toBe(true);
  });

  it("accepts contact_name and contact_phone as optional", () => {
    const withContact = {
      ...MINIMAL_FIXTURE,
      contact_name: "Jane Doe",
      contact_phone: "+15559999999",
    };
    const result = onboardingSchema.safeParse(withContact);
    expect(result.success).toBe(true);
  });

  it("accepts brand with accent_color, reply_to, support_phone", () => {
    const withBrand = {
      ...MINIMAL_FIXTURE,
      brand: {
        primary_color: "#ff0000",
        accent_color: "#00ff00",
        reply_to: "reply@test.com",
        support_phone: "+15551111111",
      },
    };
    const result = onboardingSchema.safeParse(withBrand);
    expect(result.success).toBe(true);
  });

  it("rejects invalid reply_to email in brand", () => {
    const invalid = {
      ...MINIMAL_FIXTURE,
      brand: { reply_to: "bad-email" },
    };
    const result = onboardingSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("accepts integrations.twilio with sid/token/from_number", () => {
    const withTwilio = {
      ...MINIMAL_FIXTURE,
      integrations: {
        twilio: {
          sid: "AC123",
          token: "tok123",
          from_number: "+15550001111",
        },
      },
    };
    const result = onboardingSchema.safeParse(withTwilio);
    expect(result.success).toBe(true);
  });

  it("accepts integrations.calendar_provider", () => {
    const result = onboardingSchema.safeParse({
      ...MINIMAL_FIXTURE,
      integrations: { calendar_provider: "google" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts integrations.payment_provider", () => {
    const result = onboardingSchema.safeParse({
      ...MINIMAL_FIXTURE,
      integrations: { payment_provider: "either" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid calendar_provider", () => {
    const result = onboardingSchema.safeParse({
      ...MINIMAL_FIXTURE,
      integrations: { calendar_provider: "yahoo" },
    });
    expect(result.success).toBe(false);
  });

  it("org_config is Record<string, any> — accepts anything", () => {
    const result = onboardingSchema.safeParse({
      ...MINIMAL_FIXTURE,
      org_config: {
        pricing: { labor: 9999 },
        custom_field: "anything",
        deeply: { nested: { value: true } },
      },
    });
    expect(result.success).toBe(true);
  });
});

// ─── deepMerge Tests ───────────────────────────────────────────────

describe("deepMerge", () => {
  it("merges flat objects (target wins)", () => {
    const result = deepMerge({ a: 1, b: 2 }, { b: 99, c: 3 });
    expect(result).toEqual({ a: 1, b: 99, c: 3 });
  });

  it("deep merges nested objects", () => {
    const source = { pricing: { labor: 2500, materials: { wood: 1200 } } };
    const target = { pricing: { labor: 3000 } };
    const result = deepMerge(source, target);
    expect((result.pricing as any).labor).toBe(3000);
    expect((result.pricing as any).materials).toEqual({ wood: 1200 });
  });

  it("target arrays replace source arrays", () => {
    const result = deepMerge({ items: [1, 2, 3] }, { items: [4, 5] });
    expect(result.items).toEqual([4, 5]);
  });

  it("handles undefined target values (preserves source)", () => {
    const result = deepMerge({ a: 1, b: 2 }, { a: undefined });
    expect(result.a).toBe(1);
    expect(result.b).toBe(2);
  });

  it("handles null target values (target wins)", () => {
    const result = deepMerge({ a: 1 }, { a: null });
    expect(result.a).toBe(null);
  });

  it("handles deeply nested merge (3+ levels)", () => {
    const source = { l1: { l2: { l3: { val: "source" } } } };
    const target = { l1: { l2: { l3: { val: "target" } } } };
    const result = deepMerge(source, target);
    expect((result.l1 as any).l2.l3.val).toBe("target");
  });

  it("adds new keys from target at nested level", () => {
    const result = deepMerge(
      { config: { existing: true } },
      { config: { newKey: "hello" } }
    );
    expect((result.config as any).existing).toBe(true);
    expect((result.config as any).newKey).toBe("hello");
  });
});

// ─── buildOrgConfig Tests (C) ──────────────────────────────────────

describe("buildOrgConfig (C)", () => {
  it("uses template defaults when no overrides", () => {
    const parsed = onboardingSchema.parse(MINIMAL_FIXTURE);
    const config = buildOrgConfig(parsed);

    expect(config.pricing).toBeDefined();
    expect((config.pricing as any).labor_per_lf).toBe(2500);
    expect((config.booking as any).deposit_percent).toBe(25);
  });

  it("overrides template defaults with payload values", () => {
    const parsed = onboardingSchema.parse(SAMPLE_FIXTURE);
    const config = buildOrgConfig(parsed);

    expect((config.pricing as any).labor_per_lf).toBe(3000);
    expect((config.pricing as any).gates).toBeDefined();
    expect((config.pricing as any).tearout_per_lf).toBe(800);
    expect((config.booking as any).deposit_percent).toBe(30);
  });

  it("deep merges materials (partial override preserves others)", () => {
    const parsed = onboardingSchema.parse(SAMPLE_FIXTURE);
    const config = buildOrgConfig(parsed);

    const materials = (config.pricing as any).materials;
    expect(materials.wood_6ft.cost_per_lf).toBe(2000);
    expect(materials.wood_6ft.markup).toBe(1.5);
    expect(materials.wood_4ft).toBeDefined();
    expect(materials.vinyl_4ft).toBeDefined();
  });

  it("injects metadata with owner_email", () => {
    const parsed = onboardingSchema.parse(SAMPLE_FIXTURE);
    const config = buildOrgConfig(parsed);

    expect((config.metadata as any).owner_email).toBe("john@acmefencing.com");
    expect((config.metadata as any).contact_name).toBe("John Smith");
  });

  it("generates intake_links from slug and niches", () => {
    const parsed = onboardingSchema.parse(SAMPLE_FIXTURE);
    const config = buildOrgConfig(parsed);

    const links = config.intake_links as string[];
    expect(links.length).toBe(1);
    expect(links[0]).toContain("/i/acme-fencing/fencing");
  });

  it("generates intake_links for multiple niches", () => {
    const multi = onboardingSchema.parse({
      ...MINIMAL_FIXTURE,
      niches: ["fencing", "roofing"],
    });
    const config = buildOrgConfig(multi);

    const links = config.intake_links as string[];
    expect(links.length).toBe(2);
    expect(links[0]).toContain("/fencing");
    expect(links[1]).toContain("/roofing");
  });

  it("auto-generates slug from company_name when org_slug is missing", () => {
    const parsed = onboardingSchema.parse(MINIMAL_FIXTURE);
    const config = buildOrgConfig(parsed);

    const links = config.intake_links as string[];
    expect(links[0]).toContain("/i/quick-fence-llc/");
  });
});

// ─── resolveMessageTemplates Tests ────────────────────────────────

describe("resolveMessageTemplates", () => {
  it("returns template defaults when no overrides in org_config", () => {
    const parsed = onboardingSchema.parse(MINIMAL_FIXTURE);
    const templates = resolveMessageTemplates(parsed);

    expect(templates.length).toBeGreaterThan(0);
    const hasCompanyName = templates.some((t) =>
      t.body.includes("Quick Fence LLC")
    );
    expect(hasCompanyName).toBe(true);
  });

  it("replaces {{company}} in default templates", () => {
    const parsed = onboardingSchema.parse(MINIMAL_FIXTURE);
    const templates = resolveMessageTemplates(parsed);

    const hasPlaceholder = templates.some((t) =>
      t.body.includes("{{company}}")
    );
    expect(hasPlaceholder).toBe(false);
  });

  it("overrides templates from org_config by channel:name key", () => {
    const withOverrides = onboardingSchema.parse({
      ...MINIMAL_FIXTURE,
      org_config: {
        message_templates: [
          {
            channel: "sms",
            name: "booking_confirmed",
            body: "Custom booking msg for {{name}}",
            variables: ["name"],
          },
        ],
      },
    });
    const templates = resolveMessageTemplates(withOverrides);

    const booking = templates.find(
      (t) => t.channel === "sms" && t.name === "booking_confirmed"
    );
    expect(booking).toBeDefined();
    expect(booking!.body).toContain("Custom booking msg");
  });

  it("preserves non-overridden default templates", () => {
    const withOverrides = onboardingSchema.parse({
      ...MINIMAL_FIXTURE,
      org_config: {
        message_templates: [
          {
            channel: "sms",
            name: "booking_confirmed",
            body: "Override",
            variables: [],
          },
        ],
      },
    });
    const templates = resolveMessageTemplates(withOverrides);
    expect(templates.length).toBeGreaterThan(1);
  });

  it("adds custom templates not in defaults", () => {
    const withCustom = onboardingSchema.parse({
      ...MINIMAL_FIXTURE,
      org_config: {
        message_templates: [
          {
            channel: "sms",
            name: "custom_welcome",
            body: "Welcome, {{name}}!",
            variables: ["name"],
          },
        ],
      },
    });
    const templates = resolveMessageTemplates(withCustom);

    const custom = templates.find(
      (t) => t.channel === "sms" && t.name === "custom_welcome"
    );
    expect(custom).toBeDefined();
  });
});

// ─── resolveFollowupRules Tests ────────────────────────────────────

describe("resolveFollowupRules", () => {
  it("returns template defaults when no overrides", () => {
    const parsed = onboardingSchema.parse(MINIMAL_FIXTURE);
    const rules = resolveFollowupRules(parsed);

    expect(rules.length).toBeGreaterThan(0);
    expect(rules[0].trigger).toBeDefined();
    expect(rules[0].steps.length).toBeGreaterThan(0);
  });

  it("uses org_config.followup_rules when provided", () => {
    const withRules = onboardingSchema.parse({
      ...MINIMAL_FIXTURE,
      org_config: {
        followup_rules: [
          {
            trigger: "quote_sent",
            steps: [
              { delay_hours: 4, channel: "sms", template_name: "followup_1" },
            ],
          },
        ],
      },
    });
    const rules = resolveFollowupRules(withRules);

    expect(rules.length).toBe(1);
    expect(rules[0].steps[0].delay_hours).toBe(4);
  });
});

// ─── processOnboardingImport (C+D integration) ───────────────────

describe("processOnboardingImport (C)", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.booknbuild.com";
  });

  it("creates org with PENDING status", async () => {
    const supabase = createMockSupabase();
    const parsed = onboardingSchema.parse(SAMPLE_FIXTURE);

    await processOnboardingImport(supabase, parsed);

    expect(supabase.from).toHaveBeenCalledWith("orgs");
    const orgInserts = supabase._inserted["orgs"];
    expect(orgInserts).toBeDefined();
    expect(orgInserts[0].status).toBe("PENDING");
    expect(orgInserts[0].slug).toBe("acme-fencing");
    expect(orgInserts[0].approved_at).toBeNull();
    expect(orgInserts[0].approval_token).toBeDefined();
  });

  it("creates org_configs v1 with merged config", async () => {
    const supabase = createMockSupabase();
    const parsed = onboardingSchema.parse(SAMPLE_FIXTURE);

    await processOnboardingImport(supabase, parsed);

    const configInserts = supabase._inserted["org_configs"];
    expect(configInserts).toBeDefined();
    expect(configInserts[0].version).toBe(1);
    expect(configInserts[0].is_active).toBe(true);

    const config = configInserts[0].config_json;
    expect(config.pricing.labor_per_lf).toBe(3000);
    expect(config.pricing.gates).toBeDefined();
    expect(config.pricing.tearout_per_lf).toBe(800);
  });

  it("encrypts Twilio creds (not stored as plaintext)", async () => {
    const supabase = createMockSupabase();
    const parsed = onboardingSchema.parse(SAMPLE_FIXTURE);

    await processOnboardingImport(supabase, parsed);

    const channelInserts = supabase._inserted["org_channels"];
    expect(channelInserts).toBeDefined();
    expect(channelInserts[0].channel_type).toBe("sms");
    expect(channelInserts[0].provider).toBe("twilio");

    const encrypted = channelInserts[0].config_encrypted;
    expect(typeof encrypted).toBe("string");
    expect(encrypted).not.toContain("AC1234567890");
    expect(encrypted).not.toContain("test_auth_token");

    const phoneInserts = supabase._inserted["org_phone_numbers"];
    expect(phoneInserts).toBeDefined();
    expect(phoneInserts[0].e164).toBe("+15559876543");
  });

  it("seeds message_templates", async () => {
    const supabase = createMockSupabase();
    const parsed = onboardingSchema.parse(SAMPLE_FIXTURE);

    await processOnboardingImport(supabase, parsed);

    const mtInserts = supabase._inserted["message_templates"];
    expect(mtInserts).toBeDefined();
    expect(mtInserts.length).toBeGreaterThan(0);
    expect(mtInserts[0].org_id).toBe("org-uuid-123");
  });

  it("seeds followup_rules", async () => {
    const supabase = createMockSupabase();
    const parsed = onboardingSchema.parse(SAMPLE_FIXTURE);

    await processOnboardingImport(supabase, parsed);

    const frInserts = supabase._inserted["followup_rules"];
    expect(frInserts).toBeDefined();
    expect(frInserts.length).toBeGreaterThan(0);
    expect(frInserts[0].org_id).toBe("org-uuid-123");
    expect(frInserts[0].enabled).toBe(true);
  });

  it("returns intake_links and integration_links", async () => {
    const supabase = createMockSupabase();
    const parsed = onboardingSchema.parse(SAMPLE_FIXTURE);

    const result = await processOnboardingImport(supabase, parsed);

    expect(result.intake_links).toEqual([
      "https://app.booknbuild.com/i/acme-fencing/fencing",
    ]);
    expect(result.integration_links.calendar).toContain("google-calendar");
    expect(result.integration_links.payment).toContain("stripe");
    expect(result.approval_token).toBeDefined();
  });

  it("does not insert org_channels when twilio is absent", async () => {
    const supabase = createMockSupabase();
    const parsed = onboardingSchema.parse(MINIMAL_FIXTURE);

    await processOnboardingImport(supabase, parsed);

    expect(supabase._inserted["org_channels"]).toBeUndefined();
    expect(supabase._inserted["org_phone_numbers"]).toBeUndefined();
  });

  it("stores brand_json with accent_color and reply_to", async () => {
    const supabase = createMockSupabase();
    const parsed = onboardingSchema.parse(SAMPLE_FIXTURE);

    await processOnboardingImport(supabase, parsed);

    const orgInserts = supabase._inserted["orgs"];
    const brand = orgInserts[0].brand_json;
    expect(brand.primary_color).toBe("#1a5f2a");
    expect(brand.accent_color).toBe("#facc15");
    expect(brand.reply_to).toBe("support@acmefencing.com");
    expect(brand.support_phone).toBe("+15551234567");
  });

  it("auto-generates slug when org_slug not provided", async () => {
    const supabase = createMockSupabase();
    const parsed = onboardingSchema.parse(MINIMAL_FIXTURE);

    await processOnboardingImport(supabase, parsed);

    const orgInserts = supabase._inserted["orgs"];
    expect(orgInserts[0].slug).toBe("quick-fence-llc");
  });
});

// ─── Fixture sanity ────────────────────────────────────────────────

describe("fixture sanity", () => {
  it("SAMPLE_FIXTURE round-trips through schema parse", () => {
    const result = onboardingSchema.parse(SAMPLE_FIXTURE);
    expect(result.company_name).toBe("Acme Fencing Co");
    expect(result.org_slug).toBe("acme-fencing");
    expect(result.niches).toEqual(["fencing"]);
    expect(result.integrations?.twilio?.sid).toBe(
      "AC1234567890abcdef1234567890abcdef"
    );
  });

  it("full end-to-end config merge on SAMPLE_FIXTURE", () => {
    const parsed = onboardingSchema.parse(SAMPLE_FIXTURE);
    const config = buildOrgConfig(parsed);
    const templates = resolveMessageTemplates(parsed);
    const rules = resolveFollowupRules(parsed);

    expect((config.pricing as any).labor_per_lf).toBe(3000);
    expect((config.booking as any).deposit_percent).toBe(30);
    expect(templates.length).toBeGreaterThan(0);
    expect(rules.length).toBeGreaterThan(0);
  });

  it("MINIMAL_FIXTURE gets full config from template defaults", () => {
    const parsed = onboardingSchema.parse(MINIMAL_FIXTURE);
    const config = buildOrgConfig(parsed);
    const templates = resolveMessageTemplates(parsed);
    const rules = resolveFollowupRules(parsed);

    expect((config.pricing as any).labor_per_lf).toBe(2500);
    expect((config.pricing as any).minimum_fee).toBe(150000);
    expect((config.booking as any).deposit_percent).toBe(25);
    expect(templates.length).toBeGreaterThan(0);
    expect(rules.length).toBeGreaterThan(0);
  });
});
