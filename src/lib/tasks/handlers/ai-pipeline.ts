import { SupabaseClient } from "@supabase/supabase-js";
import { analyzePhotos } from "@/lib/ai/gemini";
import { lookupPropertyData } from "@/lib/ai/property-data";
import { fuseAndDecide } from "@/lib/ai/fusion";
import { registerHandler } from "../runner";

async function handleAiPipeline(supabase: SupabaseClient, task: any) {
  const { lead_id, intake_id, niche } = task.payload_json;

  // 1. Gather data
  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", lead_id)
    .single();

  if (!lead) throw new Error(`Lead ${lead_id} not found`);

  const { data: intake } = await supabase
    .from("intake_submissions")
    .select("*")
    .eq("id", intake_id)
    .single();

  const { data: photos } = await supabase
    .from("media_assets")
    .select("file_url")
    .eq("lead_id", lead_id);

  // Get org config for thresholds
  const { data: orgConfig } = await supabase
    .from("org_configs")
    .select("config_json")
    .eq("org_id", task.org_id)
    .eq("is_active", true)
    .single();

  const thresholds = (orgConfig?.config_json as any)?.measurement_thresholds || {};

  // 2. Step 1: Gemini photo analysis
  const photoUrls = (photos || []).map((p) => p.file_url);
  const geminiResult = await analyzePhotos(
    photoUrls,
    intake?.answers_json || {},
    niche
  );

  // Save photo measurement
  await supabase.from("measurements").insert({
    org_id: task.org_id,
    lead_id,
    source: "photo",
    value_type: "confidence",
    value: geminiResult.confidence,
    confidence: geminiResult.confidence,
    metadata_json: geminiResult,
  });

  // Log event
  await supabase.from("events").insert({
    org_id: task.org_id,
    type: "ai_gemini_complete",
    lead_id,
    metadata_json: { confidence: geminiResult.confidence },
  });

  // 3. Step 2: Property data lookup
  const propertyResult = await lookupPropertyData(lead.address || "", niche);

  // Save address measurement
  await supabase.from("measurements").insert({
    org_id: task.org_id,
    lead_id,
    source: "address",
    value_type: propertyResult.value_type,
    value: propertyResult.value,
    confidence: propertyResult.confidence,
    metadata_json: propertyResult.metadata,
  });

  // Save customer estimate if provided
  const customerEstimate = (intake?.answers_json as any)?.customer_estimate;
  if (customerEstimate) {
    await supabase.from("measurements").insert({
      org_id: task.org_id,
      lead_id,
      source: "customer",
      value_type: "estimate_text",
      value: 0,
      confidence: 0.3,
      metadata_json: { raw: customerEstimate },
    });
  }

  await supabase.from("events").insert({
    org_id: task.org_id,
    type: "ai_property_complete",
    lead_id,
    metadata_json: { value: propertyResult.value, value_type: propertyResult.value_type },
  });

  // 4. Step 3: GPT-4o mini fusion
  const fusionResult = await fuseAndDecide(
    geminiResult,
    propertyResult,
    customerEstimate,
    niche,
    { auto_quote_confidence: thresholds.auto_quote_confidence }
  );

  // Save selected measurement
  await supabase.from("measurements").insert({
    org_id: task.org_id,
    lead_id,
    source: "selected",
    value_type: fusionResult.selected_value_type,
    value: fusionResult.selected_value,
    confidence: fusionResult.confidence,
    metadata_json: {
      decision: fusionResult.decision,
      normalized_fields: fusionResult.normalized_fields,
      explanation: fusionResult.explanation,
    },
  });

  await supabase.from("events").insert({
    org_id: task.org_id,
    type: "ai_fusion_complete",
    lead_id,
    metadata_json: {
      decision: fusionResult.decision,
      confidence: fusionResult.confidence,
    },
  });

  // 5. Create quote draft
  const { data: quote, error: quoteErr } = await supabase
    .from("quotes")
    .insert({
      org_id: task.org_id,
      lead_id,
      niche,
      quote_version: 1,
      status: fusionResult.decision === "auto_quote" ? "draft" : "needs_approval",
      packages_json: {}, // will be filled by pricing engine
      totals_json: {},
      needs_approval: fusionResult.decision === "needs_approval",
    })
    .select("id")
    .single();

  if (quoteErr) throw quoteErr;

  // 6. Route based on decision
  if (fusionResult.decision === "auto_quote") {
    // Enqueue pricing + send task
    await supabase.from("tasks").insert({
      org_id: task.org_id,
      lead_id,
      type: "price_and_send_quote",
      run_at: new Date().toISOString(),
      payload_json: {
        quote_id: quote.id,
        niche,
        measurement: fusionResult.selected_value,
        measurement_type: fusionResult.selected_value_type,
        normalized_fields: fusionResult.normalized_fields,
      },
      status: "queued",
    });
  } else if (fusionResult.decision === "needs_approval") {
    // Notify admin (enqueue notification task)
    await supabase.from("tasks").insert({
      org_id: task.org_id,
      lead_id,
      type: "notify_admin_approval",
      run_at: new Date().toISOString(),
      payload_json: {
        quote_id: quote.id,
        reason: fusionResult.explanation,
      },
      status: "queued",
    });
  } else if (fusionResult.decision === "force_booking") {
    // Update lead status to route to booking
    await supabase
      .from("leads")
      .update({ status: "qualified" })
      .eq("id", lead_id);

    await supabase.from("events").insert({
      org_id: task.org_id,
      type: "force_booking",
      lead_id,
      metadata_json: { reason: fusionResult.explanation },
    });
  }

  // Update lead status
  await supabase
    .from("leads")
    .update({
      status: "quoted",
      last_contact_at: new Date().toISOString(),
    })
    .eq("id", lead_id);
}

// Register the handler
registerHandler("run_ai_pipeline", handleAiPipeline);
