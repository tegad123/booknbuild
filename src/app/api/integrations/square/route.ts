import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptJson } from "@/lib/encryption";

const SQUARE_AUTH_URL = "https://connect.squareup.com/oauth2/authorize";
const SQUARE_TOKEN_URL = "https://connect.squareup.com/oauth2/token";

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
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/square`;
    const params = new URLSearchParams({
      client_id: process.env.SQUARE_APPLICATION_ID || "",
      scope: "PAYMENTS_WRITE PAYMENTS_READ",
      session: "false",
      redirect_uri: redirectUri,
    });
    return NextResponse.redirect(`${SQUARE_AUTH_URL}?${params.toString()}`);
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/square`;
  const tokenResponse = await fetch(SQUARE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Square-Version": "2024-01-18",
    },
    body: JSON.stringify({
      client_id: process.env.SQUARE_APPLICATION_ID || "",
      client_secret: process.env.SQUARE_ACCESS_TOKEN || "",
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/app/org?error=square_auth_failed`
    );
  }

  const tokens = await tokenResponse.json();

  const configEncrypted = encryptJson({
    access_token: tokens.access_token,
    location_id: tokens.merchant_id || "",
    application_id: process.env.SQUARE_APPLICATION_ID || "",
  });

  await supabase
    .from("org_payment_connections")
    .update({ is_active: false })
    .eq("org_id", userOrg.org_id)
    .eq("provider", "square");

  await supabase.from("org_payment_connections").insert({
    org_id: userOrg.org_id,
    provider: "square",
    config_encrypted: configEncrypted,
    is_active: true,
  });

  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_APP_URL}/app/org?success=square_connected`
  );
}
