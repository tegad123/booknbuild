import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const from = formData.get("From") as string;
    const to = formData.get("To") as string;
    const body = (formData.get("Body") as string) || "";
    const messageSid = formData.get("MessageSid") as string;

    if (!from || !to) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = await createServiceClient();

    // Find the org by the receiving phone number
    const { data: phoneNumber } = await supabase
      .from("org_phone_numbers")
      .select("org_id")
      .eq("e164", to)
      .single();

    if (!phoneNumber) {
      // Try finding by org_channels
      const { data: channel } = await supabase
        .from("org_channels")
        .select("org_id")
        .eq("channel_type", "sms")
        .eq("is_active", true);

      // Can't determine org - log and return OK
      console.warn(`No org found for phone number: ${to}`);
      return new Response("<Response></Response>", {
        headers: { "Content-Type": "text/xml" },
      });
    }

    const orgId = phoneNumber.org_id;

    // Find the lead by phone number
    const { data: lead } = await supabase
      .from("leads")
      .select("id")
      .eq("org_id", orgId)
      .eq("phone", from)
      .single();

    // Store the inbound message
    await supabase.from("messages").insert({
      org_id: orgId,
      lead_id: lead?.id || null,
      channel: "sms",
      direction: "inbound",
      body,
      provider_id: messageSid,
    });

    // Handle STOP keyword
    if (body.trim().toUpperCase() === "STOP") {
      if (lead) {
        await supabase.from("events").insert({
          org_id: orgId,
          type: "sms_opt_out",
          lead_id: lead.id,
          metadata_json: { phone: from },
        });
      }
    }

    // Log event
    await supabase.from("events").insert({
      org_id: orgId,
      type: "sms_inbound",
      lead_id: lead?.id || null,
      metadata_json: {
        from,
        body: body.substring(0, 200),
        message_sid: messageSid,
      },
    });

    // Return empty TwiML response
    return new Response("<Response></Response>", {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (err) {
    console.error("Twilio webhook error:", err);
    return new Response("<Response></Response>", {
      headers: { "Content-Type": "text/xml" },
    });
  }
}
