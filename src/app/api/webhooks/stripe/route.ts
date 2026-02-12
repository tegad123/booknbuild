import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const sig = request.headers.get("stripe-signature");

    // In production, verify the webhook signature
    // For now, parse the event directly
    const event = JSON.parse(body);

    const supabase = await createServiceClient();

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      const leadId = paymentIntent.metadata?.lead_id;
      const orgId = paymentIntent.metadata?.org_id;
      const quoteId = paymentIntent.metadata?.quote_id;

      if (!leadId || !orgId) {
        return NextResponse.json({ received: true });
      }

      // Update payment record
      await supabase
        .from("payments")
        .update({ status: "paid" })
        .eq("external_id", paymentIntent.id);

      // Update appointment status
      await supabase
        .from("appointments")
        .update({ status: "confirmed" })
        .eq("lead_id", leadId)
        .eq("org_id", orgId)
        .eq("status", "pending_payment");

      // Update lead status
      await supabase
        .from("leads")
        .update({ status: "booked" })
        .eq("id", leadId);

      // Update quote status
      if (quoteId) {
        await supabase
          .from("quotes")
          .update({ status: "accepted", accepted_at: new Date().toISOString() })
          .eq("id", quoteId);
      }

      // Create calendar event
      await supabase.from("tasks").insert({
        org_id: orgId,
        lead_id: leadId,
        type: "create_calendar_event",
        run_at: new Date().toISOString(),
        payload_json: { lead_id: leadId, quote_id: quoteId },
        status: "queued",
      });

      // Schedule reminders
      await supabase.from("tasks").insert({
        org_id: orgId,
        lead_id: leadId,
        type: "schedule_reminders",
        run_at: new Date().toISOString(),
        payload_json: { lead_id: leadId },
        status: "queued",
      });

      await supabase.from("events").insert({
        org_id: orgId,
        type: "payment_succeeded",
        lead_id: leadId,
        metadata_json: {
          payment_intent_id: paymentIntent.id,
          amount: paymentIntent.amount,
        },
      });
    } else if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object;
      const leadId = paymentIntent.metadata?.lead_id;
      const orgId = paymentIntent.metadata?.org_id;

      if (leadId && orgId) {
        await supabase
          .from("payments")
          .update({ status: "failed" })
          .eq("external_id", paymentIntent.id);

        // Release hold
        await supabase
          .from("appointments")
          .update({ status: "cancelled" })
          .eq("lead_id", leadId)
          .eq("org_id", orgId)
          .eq("status", "pending_payment");

        await supabase.from("events").insert({
          org_id: orgId,
          type: "payment_failed",
          lead_id: leadId,
          metadata_json: { payment_intent_id: paymentIntent.id },
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Stripe webhook error:", err);
    return NextResponse.json({ error: "Webhook error" }, { status: 400 });
  }
}
