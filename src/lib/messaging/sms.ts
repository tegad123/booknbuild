import { SupabaseClient } from "@supabase/supabase-js";
import { decryptJson } from "@/lib/encryption";

interface TwilioConfig {
  account_sid: string;
  auth_token: string;
  phone_number: string;
}

export interface SendSmsParams {
  to: string;
  body: string;
  orgId: string;
  supabase: SupabaseClient;
}

async function getOrgTwilioConfig(
  supabase: SupabaseClient,
  orgId: string
): Promise<TwilioConfig> {
  const { data: channel } = await supabase
    .from("org_channels")
    .select("config_encrypted")
    .eq("org_id", orgId)
    .eq("channel_type", "sms")
    .eq("is_active", true)
    .single();

  if (!channel?.config_encrypted) {
    throw new Error("No SMS channel configured for org");
  }

  return decryptJson<TwilioConfig>(channel.config_encrypted);
}

export async function sendSms(params: SendSmsParams): Promise<string> {
  const config = await getOrgTwilioConfig(params.supabase, params.orgId);

  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.account_sid}/Messages.json`;

  const body = new URLSearchParams({
    To: params.to,
    From: config.phone_number,
    Body: params.body,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(`${config.account_sid}:${config.auth_token}`).toString(
          "base64"
        ),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Twilio SMS failed: ${response.status} - ${error}`);
  }

  const result = await response.json();
  return result.sid;
}

export function renderTemplate(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || "");
}
