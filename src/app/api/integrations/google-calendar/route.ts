import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptJson } from "@/lib/encryption";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPES = "https://www.googleapis.com/auth/calendar";

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

  // Step 1: Redirect to Google OAuth
  if (!code) {
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google-calendar`;
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES,
      access_type: "offline",
      prompt: "consent",
    });
    return NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
  }

  // Step 2: Exchange code for tokens
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google-calendar`;
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/app/org?error=google_auth_failed`
    );
  }

  const tokens = await tokenResponse.json();

  // Step 3: Store encrypted config
  const configEncrypted = encryptJson({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  });

  // Deactivate existing connection
  await supabase
    .from("org_calendar_connections")
    .update({ is_active: false })
    .eq("org_id", userOrg.org_id)
    .eq("provider", "google");

  // Create new connection
  await supabase.from("org_calendar_connections").insert({
    org_id: userOrg.org_id,
    provider: "google",
    config_encrypted: configEncrypted,
    calendar_id: "primary",
    is_active: true,
  });

  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_APP_URL}/app/org?success=google_connected`
  );
}
