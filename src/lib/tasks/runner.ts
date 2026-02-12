import { SupabaseClient } from "@supabase/supabase-js";

type TaskHandler = (
  supabase: SupabaseClient,
  task: any
) => Promise<void>;

const handlers: Record<string, TaskHandler> = {};

export function registerHandler(type: string, handler: TaskHandler) {
  handlers[type] = handler;
}

/**
 * Process queued tasks that are due now.
 * Picks up tasks with status='queued' and run_at <= now.
 * Retries up to 3 times with exponential backoff.
 */
export async function runTaskQueue(supabase: SupabaseClient) {
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("status", "queued")
    .lte("run_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(20);

  if (error) throw error;
  if (!tasks || tasks.length === 0) return { processed: 0 };

  let processed = 0;

  for (const task of tasks) {
    const handler = handlers[task.type];
    if (!handler) {
      console.error(`No handler for task type: ${task.type}`);
      await supabase
        .from("tasks")
        .update({ status: "failed" })
        .eq("id", task.id);
      continue;
    }

    // Mark as running
    await supabase
      .from("tasks")
      .update({ status: "running" })
      .eq("id", task.id);

    try {
      await handler(supabase, task);

      // Mark done
      await supabase
        .from("tasks")
        .update({ status: "done" })
        .eq("id", task.id);
      processed++;
    } catch (err) {
      console.error(`Task ${task.id} (${task.type}) failed:`, err);

      const retryCount = (task.retry_count || 0) + 1;
      if (retryCount < 3) {
        // Exponential backoff: 1min, 4min, 16min
        const delayMs = Math.pow(4, retryCount) * 60_000;
        const nextRun = new Date(Date.now() + delayMs).toISOString();

        await supabase
          .from("tasks")
          .update({
            status: "queued",
            retry_count: retryCount,
            run_at: nextRun,
          })
          .eq("id", task.id);
      } else {
        await supabase
          .from("tasks")
          .update({ status: "failed", retry_count: retryCount })
          .eq("id", task.id);
      }

      // Log error event
      await supabase.from("events").insert({
        org_id: task.org_id,
        type: "task_error",
        lead_id: task.lead_id,
        metadata_json: {
          task_id: task.id,
          task_type: task.type,
          error: (err as Error).message,
          retry_count: retryCount,
        },
      });
    }
  }

  return { processed, total: tasks.length };
}
