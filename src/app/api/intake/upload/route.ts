import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import crypto from "crypto";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File;
  const orgId = formData.get("org_id") as string;

  if (!file || !orgId) {
    return NextResponse.json(
      { error: "file and org_id required" },
      { status: 400 }
    );
  }

  const supabase = await createServiceClient();

  const fileExt = file.name.split(".").pop() || "jpg";
  const fileName = `${crypto.randomUUID()}.${fileExt}`;
  const filePath = `intake/${orgId}/${fileName}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from("intake")
    .upload(filePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("intake").getPublicUrl(filePath);

  return NextResponse.json({ url: filePath, public_url: publicUrl });
}
