import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createPaymentIntent } from "@/lib/integrations/payments/stripe";

export async function POST(request: Request) {
  try {
    const { quote_id, appointment_id, hold_id, amount, package_tier } =
      await request.json();

    if (!quote_id || !appointment_id || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = await createServiceClient();

    // Verify hold is still valid
    const { data: hold } = await supabase
      .from("holds")
      .select("id, expires_at")
      .eq("id", hold_id)
      .single();

    if (!hold || new Date(hold.expires_at) < new Date()) {
      return NextResponse.json({ error: "Hold expired" }, { status: 410 });
    }

    // Get quote info
    const { data: quote } = await supabase
      .from("quotes")
      .select("org_id, lead_id")
      .eq("id", quote_id)
      .single();

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    // Update appointment to pending_payment
    await supabase
      .from("appointments")
      .update({ status: "pending_payment" })
      .eq("id", appointment_id);

    // Create Stripe payment intent
    const { client_secret, payment_intent_id } = await createPaymentIntent(
      supabase,
      quote.org_id,
      {
        amount,
        description: `Deposit for booking - Quote ${quote_id}`,
        metadata: {
          quote_id,
          lead_id: quote.lead_id,
          org_id: quote.org_id,
          appointment_id,
          package_tier: package_tier || "mid",
        },
      }
    );

    // Create payment record
    await supabase.from("payments").insert({
      org_id: quote.org_id,
      lead_id: quote.lead_id,
      provider: "stripe",
      amount,
      currency: "usd",
      status: "pending",
      external_id: payment_intent_id,
    });

    await supabase.from("events").insert({
      org_id: quote.org_id,
      type: "payment_initiated",
      lead_id: quote.lead_id,
      metadata_json: {
        payment_intent_id,
        amount,
        appointment_id,
      },
    });

    return NextResponse.json({ client_secret });
  } catch (err) {
    console.error("Payment creation error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
