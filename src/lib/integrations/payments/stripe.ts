import { SupabaseClient } from "@supabase/supabase-js";
import { decryptJson } from "@/lib/encryption";

interface StripeConfig {
  secret_key: string;
  publishable_key: string;
  account_id?: string; // Stripe Connect account
}

async function getConfig(
  supabase: SupabaseClient,
  orgId: string
): Promise<StripeConfig> {
  const { data: connection } = await supabase
    .from("org_payment_connections")
    .select("config_encrypted")
    .eq("org_id", orgId)
    .eq("provider", "stripe")
    .eq("is_active", true)
    .single();

  if (!connection?.config_encrypted) {
    throw new Error("No Stripe connection found");
  }

  return decryptJson<StripeConfig>(connection.config_encrypted);
}

export async function createPaymentIntent(
  supabase: SupabaseClient,
  orgId: string,
  params: {
    amount: number; // cents
    currency?: string;
    description: string;
    metadata: Record<string, string>;
  }
): Promise<{ client_secret: string; payment_intent_id: string }> {
  const config = await getConfig(supabase, orgId);

  const body: Record<string, string> = {
    amount: String(params.amount),
    currency: params.currency || "usd",
    description: params.description,
    "automatic_payment_methods[enabled]": "true",
  };

  // Add metadata
  for (const [key, value] of Object.entries(params.metadata)) {
    body[`metadata[${key}]`] = value;
  }

  const response = await fetch("https://api.stripe.com/v1/payment_intents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.secret_key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Stripe PaymentIntent failed: ${error}`);
  }

  const data = await response.json();
  return {
    client_secret: data.client_secret,
    payment_intent_id: data.id,
  };
}

export async function getPublishableKey(
  supabase: SupabaseClient,
  orgId: string
): Promise<string> {
  const config = await getConfig(supabase, orgId);
  return config.publishable_key;
}
