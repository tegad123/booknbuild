import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { z } from "zod";

const intakeSubmitSchema = z.object({
  org_id: z.string().uuid(),
  niche: z.string().min(1),
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
  address: z.string().min(1),
  customer_estimate: z.string().optional(),
  answers: z.record(z.string(), z.string()),
  photo_urls: z.array(z.string()),
  consent: z.object({
    accepted: z.literal(true),
    timestamp: z.string(),
    user_agent: z.string(),
  }),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = intakeSubmitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const supabase = await createServiceClient();

    // Get client IP from headers
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || "unknown";

    // 1. Upsert lead (by phone + org_id)
    const { data: existingLead } = await supabase
      .from("leads")
      .select("id")
      .eq("org_id", data.org_id)
      .eq("phone", data.phone)
      .single();

    let leadId: string;

    if (existingLead) {
      leadId = existingLead.id;
      await supabase
        .from("leads")
        .update({
          name: data.name,
          email: data.email,
          address: data.address,
          last_contact_at: new Date().toISOString(),
        })
        .eq("id", leadId);
    } else {
      const { data: newLead, error: leadErr } = await supabase
        .from("leads")
        .insert({
          org_id: data.org_id,
          name: data.name,
          phone: data.phone,
          email: data.email,
          address: data.address,
          niche: data.niche,
          status: "new",
        })
        .select("id")
        .single();

      if (leadErr) throw leadErr;
      leadId = newLead.id;
    }

    // 2. Create intake_submission
    const { data: submission, error: subErr } = await supabase
      .from("intake_submissions")
      .insert({
        org_id: data.org_id,
        lead_id: leadId,
        niche: data.niche,
        answers_json: {
          ...data.answers,
          customer_estimate: data.customer_estimate || "",
        },
        consent_json: {
          ...data.consent,
          ip,
        },
      })
      .select("id")
      .single();

    if (subErr) throw subErr;

    // 3. Create media_assets
    if (data.photo_urls.length > 0) {
      const mediaAssets = data.photo_urls.map((url) => ({
        org_id: data.org_id,
        lead_id: leadId,
        intake_id: submission.id,
        file_url: url,
        file_type: "image",
      }));
      await supabase.from("media_assets").insert(mediaAssets);
    }

    // 4. Enqueue AI pipeline task
    await supabase.from("tasks").insert({
      org_id: data.org_id,
      lead_id: leadId,
      type: "run_ai_pipeline",
      run_at: new Date().toISOString(),
      payload_json: {
        lead_id: leadId,
        intake_id: submission.id,
        niche: data.niche,
      },
      status: "queued",
    });

    // 5. Log event
    await supabase.from("events").insert({
      org_id: data.org_id,
      type: "intake_submitted",
      lead_id: leadId,
      metadata_json: {
        niche: data.niche,
        photo_count: data.photo_urls.length,
      },
    });

    return NextResponse.json({ success: true, lead_id: leadId });
  } catch (err) {
    console.error("Intake submit error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
