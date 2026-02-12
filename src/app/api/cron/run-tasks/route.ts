import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { runTaskQueue } from "@/lib/tasks/runner";

// Import all handlers so they register themselves
import "@/lib/tasks/handlers/index";

export async function GET(request: Request) {
  // Verify cron secret if configured
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const supabase = await createServiceClient();
    const result = await runTaskQueue(supabase);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error("Cron run-tasks error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
