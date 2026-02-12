import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generateSlots } from "@/lib/integrations/calendar/slots";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const quoteId = url.searchParams.get("quote_id");

  if (!quoteId) {
    return NextResponse.json({ error: "quote_id required" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  // Get quote and org config
  const { data: quote } = await supabase
    .from("quotes")
    .select("org_id, niche")
    .eq("id", quoteId)
    .single();

  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  // Get slot strategy from org config
  const { data: orgConfig } = await supabase
    .from("org_configs")
    .select("config_json")
    .eq("org_id", quote.org_id)
    .eq("is_active", true)
    .single();

  const config = orgConfig?.config_json as any;
  const defaultStrategy = {
    duration_minutes: 120,
    lead_time_hours: 48,
    buffer_minutes: 30,
    max_per_day: 3,
    working_hours: { start: 8, end: 17 },
  };

  const strategy = config?.slot_strategy || defaultStrategy;

  try {
    const slots = await generateSlots(supabase, quote.org_id, strategy);
    return NextResponse.json({ slots });
  } catch (err) {
    console.error("Slot generation error:", err);
    return NextResponse.json({ error: "Failed to load slots" }, { status: 500 });
  }
}
