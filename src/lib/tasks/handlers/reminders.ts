import { SupabaseClient } from "@supabase/supabase-js";
import { registerHandler } from "../runner";
import { getGoogleFreeBusy, createGoogleEvent } from "@/lib/integrations/calendar/google";
import { createMicrosoftEvent } from "@/lib/integrations/calendar/microsoft";

/**
 * Schedule reminder tasks when a booking is confirmed.
 * Customer: 24h + 2h before.
 * Internal: configurable (default 24h before).
 */
async function handleScheduleReminders(supabase: SupabaseClient, task: any) {
  const { lead_id } = task.payload_json;

  // Get appointment info
  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, start_at, end_at")
    .eq("lead_id", lead_id)
    .eq("org_id", task.org_id)
    .eq("status", "confirmed")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!appointment) return;

  const startAt = new Date(appointment.start_at);

  // Customer reminder: 24h before
  const reminder24h = new Date(startAt.getTime() - 24 * 60 * 60 * 1000);
  if (reminder24h > new Date()) {
    await supabase.from("tasks").insert({
      org_id: task.org_id,
      lead_id,
      type: "send_reminder",
      run_at: reminder24h.toISOString(),
      payload_json: {
        appointment_id: appointment.id,
        type: "customer_24h",
      },
      status: "queued",
    });
  }

  // Customer reminder: 2h before
  const reminder2h = new Date(startAt.getTime() - 2 * 60 * 60 * 1000);
  if (reminder2h > new Date()) {
    await supabase.from("tasks").insert({
      org_id: task.org_id,
      lead_id,
      type: "send_reminder",
      run_at: reminder2h.toISOString(),
      payload_json: {
        appointment_id: appointment.id,
        type: "customer_2h",
      },
      status: "queued",
    });
  }

  // Internal reminder: 24h before
  if (reminder24h > new Date()) {
    await supabase.from("tasks").insert({
      org_id: task.org_id,
      lead_id,
      type: "send_reminder",
      run_at: reminder24h.toISOString(),
      payload_json: {
        appointment_id: appointment.id,
        type: "internal_24h",
      },
      status: "queued",
    });
  }

  await supabase.from("events").insert({
    org_id: task.org_id,
    type: "reminders_scheduled",
    lead_id,
    metadata_json: { appointment_id: appointment.id },
  });
}

/**
 * Send a specific reminder (customer or internal).
 */
async function handleSendReminder(supabase: SupabaseClient, task: any) {
  const { appointment_id, type } = task.payload_json;

  // Verify appointment still exists and is confirmed
  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, start_at, status")
    .eq("id", appointment_id)
    .single();

  if (!appointment || appointment.status !== "confirmed") return;

  const { data: lead } = await supabase
    .from("leads")
    .select("name, phone, email")
    .eq("id", task.lead_id)
    .single();

  if (!lead) return;

  const { data: org } = await supabase
    .from("orgs")
    .select("name")
    .eq("id", task.org_id)
    .single();

  const startAt = new Date(appointment.start_at);
  const dateStr = startAt.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const timeStr = startAt.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const companyName = org?.name || "Your contractor";

  if (type === "customer_24h" || type === "customer_2h") {
    // Send customer reminder via SMS
    const { sendSms, renderTemplate } = await import("@/lib/messaging/sms");

    // Get booking_confirmed template
    const { data: template } = await supabase
      .from("message_templates")
      .select("body")
      .eq("org_id", task.org_id)
      .eq("channel", "sms")
      .eq("name", "booking_confirmed")
      .single();

    if (template && lead.phone) {
      const body = renderTemplate(template.body, {
        name: lead.name,
        date: dateStr,
        time: timeStr,
        company: companyName,
      });

      try {
        await sendSms({
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
        });
      } catch (err) {
        console.error("Reminder SMS failed:", err);
      }
    }
  } else if (type === "internal_24h") {
    // Send internal notification
    const { data: orgConfig } = await supabase
      .from("org_configs")
      .select("config_json")
      .eq("org_id", task.org_id)
      .eq("is_active", true)
      .single();

    const config = orgConfig?.config_json as any;
    const notificationEmail = config?.notification_email;

    if (notificationEmail) {
      const { sendEmail } = await import("@/lib/messaging/email");
      await sendEmail({
        to: notificationEmail,
        subject: `Tomorrow: ${lead.name} - ${dateStr}`,
        html: `
          <h2>Appointment Reminder</h2>
          <p><strong>Customer:</strong> ${lead.name}</p>
          <p><strong>Phone:</strong> ${lead.phone || "N/A"}</p>
          <p><strong>Date:</strong> ${dateStr} at ${timeStr}</p>
        `,
      });
    }
  }

  await supabase.from("events").insert({
    org_id: task.org_id,
    type: "reminder_sent",
    lead_id: task.lead_id,
    metadata_json: { appointment_id, reminder_type: type },
  });
}

/**
 * Create a calendar event after payment confirmation.
 */
async function handleCreateCalendarEvent(supabase: SupabaseClient, task: any) {
  const { lead_id, quote_id } = task.payload_json;

  // Get appointment
  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, start_at, end_at")
    .eq("lead_id", lead_id)
    .eq("org_id", task.org_id)
    .eq("status", "confirmed")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!appointment) return;

  // Get lead info
  const { data: lead } = await supabase
    .from("leads")
    .select("name, address, phone, niche")
    .eq("id", lead_id)
    .single();

  if (!lead) return;

  // Get quote info for package details
  let packageInfo = "";
  if (quote_id) {
    const { data: quote } = await supabase
      .from("quotes")
      .select("packages_json, totals_json")
      .eq("id", quote_id)
      .single();

    if (quote) {
      packageInfo = `Package total: $${((quote.totals_json as any)?.mid_total || 0) / 100}`;
    }
  }

  const eventDetails = {
    summary: `${lead.niche} - ${lead.name}`,
    description: `Customer: ${lead.name}\nPhone: ${lead.phone}\n${packageInfo}`,
    location: lead.address || "",
    start: appointment.start_at,
    end: appointment.end_at,
  };

  // Check which calendar provider is connected
  const { data: calConnection } = await supabase
    .from("org_calendar_connections")
    .select("provider")
    .eq("org_id", task.org_id)
    .eq("is_active", true)
    .single();

  let calendarEventId = "";

  if (calConnection?.provider === "google") {
    try {
      calendarEventId = await createGoogleEvent(
        supabase,
        task.org_id,
        eventDetails
      );
    } catch (err) {
      console.error("Failed to create Google Calendar event:", err);
    }
  } else if (calConnection?.provider === "microsoft") {
    try {
      calendarEventId = await createMicrosoftEvent(
        supabase,
        task.org_id,
        eventDetails
      );
    } catch (err) {
      console.error("Failed to create Microsoft Calendar event:", err);
    }
  }

  // Update appointment with calendar event ID
  if (calendarEventId) {
    await supabase
      .from("appointments")
      .update({ calendar_event_id: calendarEventId })
      .eq("id", appointment.id);
  }

  // Generate and email job sheet PDF
  try {
    const { data: org } = await supabase
      .from("orgs")
      .select("name")
      .eq("id", task.org_id)
      .single();

    const { data: orgConfig } = await supabase
      .from("org_configs")
      .select("config_json")
      .eq("org_id", task.org_id)
      .eq("is_active", true)
      .single();

    const config = orgConfig?.config_json as any;
    const notificationEmail = config?.notification_email;

    if (notificationEmail) {
      const React = await import("react");
      const { JobSheetDocument } = await import("@/lib/pdf/job-sheet");
      const { renderPdfToBuffer } = await import("@/lib/pdf/generator");
      const { sendEmail } = await import("@/lib/messaging/email");

      const startAt = new Date(appointment.start_at);

      const pdf = await renderPdfToBuffer(
        React.createElement(JobSheetDocument, {
          companyName: org?.name || "",
          customerName: lead.name,
          customerAddress: lead.address || "",
          customerPhone: lead.phone || "",
          customerEmail: "",
          niche: lead.niche || "",
          packageName: "Selected Package",
          lineItems: [],
          subtotal: 0,
          depositPaid: 0,
          balanceDue: 0,
          appointmentDate: startAt.toLocaleDateString(),
          appointmentTime: startAt.toLocaleTimeString(),
        })
      );

      await sendEmail({
        to: notificationEmail,
        subject: `Job Sheet: ${lead.name} - ${startAt.toLocaleDateString()}`,
        html: `<p>Job sheet attached for ${lead.name} on ${startAt.toLocaleDateString()}.</p>`,
        attachments: [{ filename: "job-sheet.pdf", content: pdf }],
      });
    }
  } catch (err) {
    console.error("Failed to generate/send job sheet:", err);
  }

  await supabase.from("events").insert({
    org_id: task.org_id,
    type: "calendar_event_created",
    lead_id: lead_id,
    metadata_json: {
      calendar_event_id: calendarEventId,
      appointment_id: appointment.id,
    },
  });
}

registerHandler("schedule_reminders", handleScheduleReminders);
registerHandler("send_reminder", handleSendReminder);
registerHandler("create_calendar_event", handleCreateCalendarEvent);
