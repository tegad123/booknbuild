import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptJson } from "@/lib/encryption";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: userOrg } = await supabase
    .from("user_orgs")
    .select("org_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  if (!userOrg || userOrg.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!code) {
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/stripe`;
    const params = new URLSearchParams({
      response_type: "code",
      client_id: process.env.STRIPE_CLIENT_ID || "",
      scope: "read_write",
      redirect_uri: redirectUri,
    });
    return NextResponse.redirect(
      `https://connect.stripe.com/oauth/authorize?${params.toString()}`
    );
  }

  // Exchange code for credentials
  const tokenResponse = await fetch(
    "https://connect.stripe.com/oauth/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_secret: process.env.STRIPE_SECRET_KEY || "",
      }),
    }
  );

  if (!tokenResponse.ok) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/app/org?error=stripe_auth_failed`
    );
  }

  const tokens = await tokenResponse.json();

  const configEncrypted = encryptJson({
    secret_key: tokens.access_token || process.env.STRIPE_SECRET_KEY,
    publishable_key: tokens.stripe_publishable_key || process.env.NEXT_PUBLIC_STRIPE_KEY,
    account_id: tokens.stripe_user_id,
  });

  await supabase
    .from("org_payment_connections")
    .update({ is_active: false })
    .eq("org_id", userOrg.org_id)
    .eq("provider", "stripe");

  await supabase.from("org_payment_connections").insert({
    org_id: userOrg.org_id,
    provider: "stripe",
    config_encrypted: configEncrypted,
    is_active: true,
  });

  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_APP_URL}/app/org?success=stripe_connected`
  );
}
