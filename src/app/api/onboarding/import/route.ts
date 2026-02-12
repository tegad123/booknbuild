import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  processOnboardingImport,
  onboardingSchema,
  OnboardingError,
} from "@/lib/onboarding/import";
import { renderPdfToBuffer } from "@/lib/pdf/generator";
import { ConfirmationPdf } from "@/lib/pdf/confirmation";
import { sendEmail } from "@/lib/messaging/email";
import React from "react";

export async function POST(request: Request) {
  // ── A) Bearer auth ────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization");
  const expectedSecret = process.env.ONBOARDING_SECRET;

  if (!expectedSecret) {
    console.error("ONBOARDING_SECRET env var is not set");
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 }
    );
  }

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing Authorization header. Expected: Bearer <ONBOARDING_SECRET>" },
      { status: 401 }
    );
  }

  const token = authHeader.slice(7);
  if (token !== expectedSecret) {
    return NextResponse.json(
      { error: "Invalid authorization token" },
      { status: 401 }
    );
  }

  // ── B) Validate payload with Zod ──────────────────────────────────
  try {
    const body = await request.json();

    const parsed = onboardingSchema.safeParse(body);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      return NextResponse.json(
        {
          error: "Invalid payload",
          field_errors: flat.fieldErrors,
          form_errors: flat.formErrors,
        },
        { status: 400 }
      );
    }

    // ── C) Persistence via processOnboardingImport ────────────────────
    const supabase = await createServiceClient();
    const result = await processOnboardingImport(supabase, parsed.data);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const approveUrl = `${appUrl}/api/onboarding/approve?token=${result.approval_token}`;

    // ── D) Confirmation PDF + email ─────────────────────────────────
    try {
      const pdfBuffer = await renderPdfToBuffer(
        React.createElement(ConfirmationPdf, {
          companyName: parsed.data.company_name,
          ownerEmail: parsed.data.owner_email,
          contactName: parsed.data.contact_name,
          niches: parsed.data.niches,
          slug: result.slug,
          intakeLinks: result.intake_links,
          integrationLinks: result.integration_links,
          approveUrl,
          configSummary: result.config_summary,
          brand: parsed.data.brand,
          hasTwilio: !!parsed.data.integrations?.twilio,
        })
      );

      if (process.env.RESEND_API_KEY) {
        await sendEmail({
          to: parsed.data.owner_email,
          subject: `BooknBuild Setup Confirmation - ${parsed.data.company_name}`,
          html: `
            <h2>Welcome to BooknBuild!</h2>
            <p>Your organization <strong>${parsed.data.company_name}</strong> has been configured.</p>
            <p>Please review the attached PDF and approve your setup:</p>
            <p><a href="${approveUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:white;text-decoration:none;border-radius:6px;">Approve Setup</a></p>
            <p style="margin-top:16px;">Or if changes are needed, reply to this email.</p>
            <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb;" />
            <p><strong>Your public intake links:</strong></p>
            <ul>
              ${result.intake_links.map((l: string) => `<li><a href="${l}">${l}</a></li>`).join("")}
            </ul>
          `,
          attachments: [
            {
              filename: `booknbuild-confirmation-${result.slug}.pdf`,
              content: pdfBuffer,
            },
          ],
        });
      }
    } catch (pdfErr) {
      // PDF/email errors are non-fatal — org is already created
      console.error("PDF/email error (non-fatal):", pdfErr);
    }

    return NextResponse.json({
      success: true,
      org_id: result.org_id,
      slug: result.slug,
      intake_links: result.intake_links,
      integration_links: result.integration_links,
      approve_url: approveUrl,
    });
  } catch (err) {
    if (err instanceof OnboardingError) {
      const status = err.code === "SLUG_TAKEN" ? 409 : 400;
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status }
      );
    }

    console.error("Onboarding import error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Internal server error" },
      { status: 500 }
    );
  }
}
