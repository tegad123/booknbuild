import { SupabaseClient } from "@supabase/supabase-js";
import { sendSms, renderTemplate } from "@/lib/messaging/sms";
import { sendEmail } from "@/lib/messaging/email";
import { registerHandler } from "../runner";

async function handleSendQuote(supabase: SupabaseClient, task: any) {
  const { quote_id } = task.payload_json;

  // Get quote + lead + org data
  const { data: quote } = await supabase
    .from("quotes")
    .select("*, leads(name, phone, email)")
    .eq("id", quote_id)
    .single();

  if (!quote) throw new Error(`Quote ${quote_id} not found`);

  const lead = (quote as any).leads;

  // Get org brand info
  const { data: org } = await supabase
    .from("orgs")
    .select("name, brand_json")
    .eq("id", task.org_id)
    .single();

  const quoteLink = `${process.env.NEXT_PUBLIC_APP_URL}/q/${quote_id}`;
  const companyName = org?.name || "Your contractor";

  const variables: Record<string, string> = {
    name: lead?.name || "there",
    company: companyName,
    quote_link: quoteLink,
  };

  // Get org message templates
  const { data: templates } = await supabase
    .from("message_templates")
    .select("channel, name, body")
    .eq("org_id", task.org_id)
    .eq("name", "quote_sent");

  // Send SMS
  const smsTemplate = templates?.find((t: any) => t.channel === "sms");
  if (smsTemplate && lead?.phone) {
    try {
      const smsBody = renderTemplate(smsTemplate.body, variables);
      const sid = await sendSms({
        to: lead.phone,
        body: smsBody,
        orgId: task.org_id,
        supabase,
      });

      await supabase.from("messages").insert({
        org_id: task.org_id,
        lead_id: task.lead_id,
        channel: "sms",
        direction: "outbound",
        body: smsBody,
        provider_id: sid,
      });
    } catch (err) {
      console.error("SMS send failed:", err);
      // Continue to email even if SMS fails
    }
  }

  // Send email
  const emailTemplate = templates?.find((t: any) => t.channel === "email");
  if (emailTemplate && lead?.email) {
    try {
      const emailBody = renderTemplate(emailTemplate.body, variables);
      await sendEmail({
        to: lead.email,
        subject: `Your ${quote.niche} quote from ${companyName}`,
        html: emailBody.replace(/\n/g, "<br>"),
      });

      await supabase.from("messages").insert({
        org_id: task.org_id,
        lead_id: task.lead_id,
        channel: "email",
        direction: "outbound",
        body: emailBody,
      });
    } catch (err) {
      console.error("Email send failed:", err);
    }
  }

  // Update quote status to sent
  await supabase
    .from("quotes")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
    })
    .eq("id", quote_id);

  // Log event
  await supabase.from("events").insert({
    org_id: task.org_id,
    type: "quote_sent",
    lead_id: task.lead_id,
    metadata_json: { quote_id },
  });

  // Schedule follow-ups
  const { scheduleFollowups } = await import("@/lib/messaging/followups");
  await scheduleFollowups(supabase, task.org_id, task.lead_id, "quote_sent", {
    name: lead?.name || "",
    quote_link: quoteLink,
    company: companyName,
  });
}

async function handleSendFollowup(supabase: SupabaseClient, task: any) {
  const { channel, template_name, context } = task.payload_json;

  // Check stop conditions before sending
  const { scheduleFollowups } = await import("@/lib/messaging/followups");

  // Get lead info
  const { data: lead } = await supabase
    .from("leads")
    .select("name, phone, email, status")
    .eq("id", task.lead_id)
    .single();

  if (!lead) throw new Error(`Lead ${task.lead_id} not found`);

  // Stop if lead is lost or has booked
  if (lead.status === "lost" || lead.status === "booked") return;

  // Check for STOP messages
  const { data: stopMessage } = await supabase
    .from("messages")
    .select("id")
    .eq("org_id", task.org_id)
    .eq("lead_id", task.lead_id)
    .eq("direction", "inbound")
    .ilike("body", "%stop%")
    .limit(1)
    .single();

  if (stopMessage) return;

  // Get the template
  const { data: template } = await supabase
    .from("message_templates")
    .select("body")
    .eq("org_id", task.org_id)
    .eq("name", template_name)
    .eq("channel", channel)
    .single();

  if (!template) return;

  const { renderTemplate } = await import("@/lib/messaging/sms");
  const body = renderTemplate(template.body, context || {});

  if (channel === "sms" && lead.phone) {
    const sid = await sendSms({
      to: lead.phone,
      body,
      orgId: task.org_id,
      supabase,
    });

    await supabase.from("messages").insert({
      org_id: task.org_id,
      lead_id: task.lead_id,
      channel: "sms",
      direction: "outbound",
      body,
      provider_id: sid,
    });
  } else if (channel === "email" && lead.email) {
    const { data: org } = await supabase
      .from("orgs")
      .select("name")
      .eq("id", task.org_id)
      .single();

    await sendEmail({
      to: lead.email,
      subject: `Message from ${org?.name || "Your contractor"}`,
      html: body.replace(/\n/g, "<br>"),
    });

    await supabase.from("messages").insert({
      org_id: task.org_id,
      lead_id: task.lead_id,
      channel: "email",
      direction: "outbound",
      body,
    });
  }

  await supabase.from("events").insert({
    org_id: task.org_id,
    type: "followup_sent",
    lead_id: task.lead_id,
    metadata_json: { channel, template_name },
  });
}

registerHandler("send_quote", handleSendQuote);
registerHandler("send_followup", handleSendFollowup);
