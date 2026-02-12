import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { quote_id, slot_start, slot_end, package_tier } = await request.json();

    if (!quote_id || !slot_start || !slot_end) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = await createServiceClient();

    // Get quote info
    const { data: quote } = await supabase
      .from("quotes")
      .select("org_id, lead_id, niche, packages_json, totals_json")
      .eq("id", quote_id)
      .single();

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    // Check for conflicting holds/appointments
    const { data: conflicts } = await supabase
      .from("holds")
      .select("id")
      .eq("org_id", quote.org_id)
      .gte("expires_at", new Date().toISOString())
      .lt("slot_start", slot_end)
      .gt("slot_end", slot_start);

    if (conflicts && conflicts.length > 0) {
      return NextResponse.json({ error: "Slot no longer available" }, { status: 409 });
    }

    // Create 10-minute hold
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { data: hold, error: holdErr } = await supabase
      .from("holds")
      .insert({
        org_id: quote.org_id,
        lead_id: quote.lead_id,
        slot_start,
        slot_end,
        expires_at: expiresAt,
      })
      .select("id")
      .single();

    if (holdErr) throw holdErr;

    // Create appointment in pending_hold state
    const { data: appointment, error: apptErr } = await supabase
      .from("appointments")
      .insert({
        org_id: quote.org_id,
        lead_id: quote.lead_id,
        type: "install",
        start_at: slot_start,
        end_at: slot_end,
        status: "pending_hold",
      })
      .select("id")
      .single();

    if (apptErr) throw apptErr;

    // Determine deposit amount
    const { data: orgConfig } = await supabase
      .from("org_configs")
      .select("config_json")
      .eq("org_id", quote.org_id)
      .eq("is_active", true)
      .single();

    const config = orgConfig?.config_json as any;
    const depositPercent = config?.booking?.deposit_percent || 25;

    // Get the selected package total
    const packages = quote.packages_json as any[];
    const selectedPkg = packages?.find((p: any) => p.tier === package_tier);
    const total = selectedPkg?.subtotal || quote.totals_json?.mid_total || 0;
    const depositAmount = Math.round(total * (depositPercent / 100));

    await supabase.from("events").insert({
      org_id: quote.org_id,
      type: "hold_created",
      lead_id: quote.lead_id,
      metadata_json: {
        hold_id: hold.id,
        appointment_id: appointment.id,
        slot_start,
        slot_end,
        expires_at: expiresAt,
      },
    });

    return NextResponse.json({
      hold_id: hold.id,
      appointment_id: appointment.id,
      expires_at: expiresAt,
      deposit_amount: depositAmount,
      total_amount: total,
    });
  } catch (err) {
    console.error("Hold creation error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
