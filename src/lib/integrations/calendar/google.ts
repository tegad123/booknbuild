import { SupabaseClient } from "@supabase/supabase-js";
import { decryptJson } from "@/lib/encryption";

interface GoogleCalendarConfig {
  access_token: string;
  refresh_token: string;
  token_expiry: string;
  calendar_id: string;
}

interface FreeBusySlot {
  start: string;
  end: string;
}

async function getConfig(
  supabase: SupabaseClient,
  orgId: string
): Promise<GoogleCalendarConfig & { connectionId: string }> {
  const { data: connection } = await supabase
    .from("org_calendar_connections")
    .select("id, config_encrypted, calendar_id")
    .eq("org_id", orgId)
    .eq("provider", "google")
    .eq("is_active", true)
    .single();

  if (!connection?.config_encrypted) {
    throw new Error("No Google Calendar connection found");
  }

  const config = decryptJson<Omit<GoogleCalendarConfig, "calendar_id">>(
    connection.config_encrypted
  );

  return {
    ...config,
    calendar_id: connection.calendar_id || "primary",
    connectionId: connection.id,
  };
}

async function refreshTokenIfNeeded(
  supabase: SupabaseClient,
  config: GoogleCalendarConfig & { connectionId: string }
): Promise<string> {
  if (new Date(config.token_expiry) > new Date()) {
    return config.access_token;
  }

  // Refresh the token
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      refresh_token: config.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) throw new Error("Failed to refresh Google token");

  const data = await response.json();
  const { encryptJson } = await import("@/lib/encryption");

  const newExpiry = new Date(
    Date.now() + data.expires_in * 1000
  ).toISOString();

  await supabase
    .from("org_calendar_connections")
    .update({
      config_encrypted: encryptJson({
        access_token: data.access_token,
        refresh_token: config.refresh_token,
        token_expiry: newExpiry,
      }),
    })
    .eq("id", config.connectionId);

  return data.access_token;
}

export async function getGoogleFreeBusy(
  supabase: SupabaseClient,
  orgId: string,
  timeMin: string,
  timeMax: string
): Promise<FreeBusySlot[]> {
  const config = await getConfig(supabase, orgId);
  const accessToken = await refreshTokenIfNeeded(supabase, config);

  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/freeBusy",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin,
        timeMax,
        items: [{ id: config.calendar_id }],
      }),
    }
  );

  if (!response.ok) throw new Error("Google Calendar freeBusy failed");

  const data = await response.json();
  const calendar =
    data.calendars?.[config.calendar_id] || {};

  return (calendar.busy || []).map((slot: any) => ({
    start: slot.start,
    end: slot.end,
  }));
}

export async function createGoogleEvent(
  supabase: SupabaseClient,
  orgId: string,
  event: {
    summary: string;
    description: string;
    location: string;
    start: string;
    end: string;
  }
): Promise<string> {
  const config = await getConfig(supabase, orgId);
  const accessToken = await refreshTokenIfNeeded(supabase, config);

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendar_id)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: { dateTime: event.start },
        end: { dateTime: event.end },
      }),
    }
  );

  if (!response.ok) throw new Error("Failed to create Google Calendar event");

  const data = await response.json();
  return data.id;
}
