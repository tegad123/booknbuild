import { SupabaseClient } from "@supabase/supabase-js";
import { decryptJson } from "@/lib/encryption";

interface MicrosoftCalendarConfig {
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
): Promise<MicrosoftCalendarConfig & { connectionId: string }> {
  const { data: connection } = await supabase
    .from("org_calendar_connections")
    .select("id, config_encrypted, calendar_id")
    .eq("org_id", orgId)
    .eq("provider", "microsoft")
    .eq("is_active", true)
    .single();

  if (!connection?.config_encrypted) {
    throw new Error("No Microsoft Calendar connection found");
  }

  const config = decryptJson<Omit<MicrosoftCalendarConfig, "calendar_id">>(
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
  config: MicrosoftCalendarConfig & { connectionId: string }
): Promise<string> {
  if (new Date(config.token_expiry) > new Date()) {
    return config.access_token;
  }

  const response = await fetch(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID || "",
        client_secret: process.env.MICROSOFT_CLIENT_SECRET || "",
        refresh_token: config.refresh_token,
        grant_type: "refresh_token",
        scope: "Calendars.ReadWrite offline_access",
      }),
    }
  );

  if (!response.ok) throw new Error("Failed to refresh Microsoft token");

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
        refresh_token: data.refresh_token || config.refresh_token,
        token_expiry: newExpiry,
      }),
    })
    .eq("id", config.connectionId);

  return data.access_token;
}

export async function getMicrosoftFreeBusy(
  supabase: SupabaseClient,
  orgId: string,
  timeMin: string,
  timeMax: string
): Promise<FreeBusySlot[]> {
  const config = await getConfig(supabase, orgId);
  const accessToken = await refreshTokenIfNeeded(supabase, config);

  const response = await fetch(
    "https://graph.microsoft.com/v1.0/me/calendar/getSchedule",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schedules: ["me"],
        startTime: { dateTime: timeMin, timeZone: "UTC" },
        endTime: { dateTime: timeMax, timeZone: "UTC" },
      }),
    }
  );

  if (!response.ok) throw new Error("Microsoft Calendar getSchedule failed");

  const data = await response.json();
  const schedule = data.value?.[0]?.scheduleItems || [];

  return schedule.map((item: any) => ({
    start: item.start.dateTime,
    end: item.end.dateTime,
  }));
}

export async function createMicrosoftEvent(
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
    "https://graph.microsoft.com/v1.0/me/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subject: event.summary,
        body: { contentType: "text", content: event.description },
        location: { displayName: event.location },
        start: { dateTime: event.start, timeZone: "UTC" },
        end: { dateTime: event.end, timeZone: "UTC" },
      }),
    }
  );

  if (!response.ok) throw new Error("Failed to create Microsoft event");

  const data = await response.json();
  return data.id;
}
