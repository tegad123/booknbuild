import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return new NextResponse(
      renderHtml("Error", "Missing approval token.", null),
      { status: 400, headers: { "Content-Type": "text/html" } }
    );
  }

  const supabase = await createServiceClient();

  // Find org by approval token
  const { data: org, error } = await supabase
    .from("orgs")
    .select("id, name, slug, status, approved_at")
    .eq("approval_token", token)
    .single();

  if (error || !org) {
    return new NextResponse(
      renderHtml(
        "Invalid Token",
        "This approval link is invalid or has already been used.",
        null
      ),
      { status: 404, headers: { "Content-Type": "text/html" } }
    );
  }

  // Already approved?
  if (org.approved_at) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const loginUrl = `${appUrl}/login`;
    return new NextResponse(
      renderHtml(
        "Already Approved",
        `${org.name} was already approved. You can log in below.`,
        loginUrl
      ),
      { status: 200, headers: { "Content-Type": "text/html" } }
    );
  }

  // Mark as approved — set approved_at, consume the token
  // Do NOT activate the org.
  const { error: updateError } = await supabase
    .from("orgs")
    .update({
      approved_at: new Date().toISOString(),
      approval_token: null,
    })
    .eq("id", org.id);

  if (updateError) {
    return new NextResponse(
      renderHtml(
        "Error",
        "Something went wrong while approving. Please try again or contact support.",
        null
      ),
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const loginUrl = `${appUrl}/login`;

  return new NextResponse(
    renderHtml(
      "Approved!",
      `${org.name} has been approved. An administrator will activate your organization shortly. You can log in below once activated.`,
      loginUrl
    ),
    { status: 200, headers: { "Content-Type": "text/html" } }
  );
}

function renderHtml(
  title: string,
  message: string,
  loginUrl: string | null
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>BooknBuild - ${title}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f9fafb;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .card {
      background: white;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      padding: 40px;
      max-width: 480px;
      width: 100%;
      text-align: center;
    }
    .logo { font-size: 28px; font-weight: 700; color: #2563eb; margin-bottom: 8px; }
    h1 { font-size: 22px; color: #111827; margin-bottom: 12px; }
    p { font-size: 15px; color: #6b7280; line-height: 1.6; margin-bottom: 24px; }
    .btn {
      display: inline-block;
      padding: 12px 32px;
      background: #2563eb;
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 15px;
    }
    .btn:hover { background: #1d4ed8; }
    .icon { font-size: 48px; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">BooknBuild</div>
    <div class="icon">${title.includes("Error") || title.includes("Invalid") ? "&#10060;" : "&#9989;"}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    ${loginUrl ? `<a href="${loginUrl}" class="btn">Log In</a>` : ""}
  </div>
</body>
</html>`;
}
