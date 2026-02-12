import { SupabaseClient } from "@supabase/supabase-js";
import { decryptJson } from "@/lib/encryption";

interface SquareConfig {
  access_token: string;
  location_id: string;
  application_id: string;
}

async function getConfig(
  supabase: SupabaseClient,
  orgId: string
): Promise<SquareConfig> {
  const { data: connection } = await supabase
    .from("org_payment_connections")
    .select("config_encrypted")
    .eq("org_id", orgId)
    .eq("provider", "square")
    .eq("is_active", true)
    .single();

  if (!connection?.config_encrypted) {
    throw new Error("No Square connection found");
  }

  return decryptJson<SquareConfig>(connection.config_encrypted);
}

export async function createSquarePayment(
  supabase: SupabaseClient,
  orgId: string,
  params: {
    amount: number; // cents
    currency?: string;
    sourceId: string; // nonce from Square Web SDK
    description: string;
    metadata: Record<string, string>;
  }
): Promise<{ payment_id: string; status: string }> {
  const config = await getConfig(supabase, orgId);

  const idempotencyKey = crypto.randomUUID();

  const response = await fetch(
    "https://connect.squareup.com/v2/payments",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.access_token}`,
        "Content-Type": "application/json",
        "Square-Version": "2024-01-18",
      },
      body: JSON.stringify({
        idempotency_key: idempotencyKey,
        source_id: params.sourceId,
        amount_money: {
          amount: params.amount,
          currency: params.currency?.toUpperCase() || "USD",
        },
        location_id: config.location_id,
        note: params.description,
        reference_id: params.metadata.lead_id || "",
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Square payment failed: ${error}`);
  }

  const data = await response.json();
  return {
    payment_id: data.payment.id,
    status: data.payment.status,
  };
}

export async function getSquareAppId(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ application_id: string; location_id: string }> {
  const config = await getConfig(supabase, orgId);
  return {
    application_id: config.application_id,
    location_id: config.location_id,
  };
}
