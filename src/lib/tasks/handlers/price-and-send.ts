import { SupabaseClient } from "@supabase/supabase-js";
import { calculatePrice } from "@/lib/pricing/engine";
import { registerHandler } from "../runner";

async function handlePriceAndSend(supabase: SupabaseClient, task: any) {
  const { quote_id, niche, measurement, measurement_type, normalized_fields } =
    task.payload_json;

  // 1. Get org config for pricing
  const { data: orgConfig } = await supabase
    .from("org_configs")
    .select("config_json")
    .eq("org_id", task.org_id)
    .eq("is_active", true)
    .single();

  if (!orgConfig) throw new Error("No active org config found");

  const config = orgConfig.config_json as any;

  // 2. Run deterministic pricing engine
  const pricingResult = calculatePrice({
    niche,
    measurement,
    measurement_type,
    normalized_fields,
    config: config.pricing || {},
  });

  // 3. Update quote with packages and totals
  const { error: updateErr } = await supabase
    .from("quotes")
    .update({
      packages_json: pricingResult.packages,
      totals_json: pricingResult.totals,
      verification_clause: pricingResult.verification_clause,
      status: "draft",
    })
    .eq("id", quote_id);

  if (updateErr) throw updateErr;

  // 4. Enqueue send task
  await supabase.from("tasks").insert({
    org_id: task.org_id,
    lead_id: task.lead_id,
    type: "send_quote",
    run_at: new Date().toISOString(),
    payload_json: { quote_id },
    status: "queued",
  });

  // 5. Log event
  await supabase.from("events").insert({
    org_id: task.org_id,
    type: "quote_priced",
    lead_id: task.lead_id,
    metadata_json: {
      quote_id,
      package_count: pricingResult.packages.length,
      total: pricingResult.totals.mid_total,
    },
  });
}

registerHandler("price_and_send_quote", handlePriceAndSend);
