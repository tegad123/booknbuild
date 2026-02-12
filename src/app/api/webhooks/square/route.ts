import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = await createServiceClient();

    if (body.type === "payment.completed") {
      const payment = body.data?.object?.payment;
      if (!payment) return NextResponse.json({ received: true });

      const referenceId = payment.reference_id;

      // Look up the payment record by external_id
      const { data: paymentRecord } = await supabase
        .from("payments")
        .select("id, org_id, lead_id")
        .eq("external_id", payment.id)
        .single();

      if (paymentRecord) {
        await supabase
          .from("payments")
          .update({ status: "paid" })
          .eq("id", paymentRecord.id);

        await supabase
          .from("appointments")
          .update({ status: "confirmed" })
          .eq("lead_id", paymentRecord.lead_id)
          .eq("org_id", paymentRecord.org_id)
          .eq("status", "pending_payment");

        await supabase
          .from("leads")
          .update({ status: "booked" })
          .eq("id", paymentRecord.lead_id);

        await supabase.from("tasks").insert({
          org_id: paymentRecord.org_id,
          lead_id: paymentRecord.lead_id,
          type: "create_calendar_event",
          run_at: new Date().toISOString(),
          payload_json: { lead_id: paymentRecord.lead_id },
          status: "queued",
        });

        await supabase.from("tasks").insert({
          org_id: paymentRecord.org_id,
          lead_id: paymentRecord.lead_id,
          type: "schedule_reminders",
          run_at: new Date().toISOString(),
          payload_json: { lead_id: paymentRecord.lead_id },
          status: "queued",
        });

        await supabase.from("events").insert({
          org_id: paymentRecord.org_id,
          type: "payment_succeeded",
          lead_id: paymentRecord.lead_id,
          metadata_json: { square_payment_id: payment.id },
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Square webhook error:", err);
    return NextResponse.json({ error: "Webhook error" }, { status: 400 });
  }
}
