import { SupabaseClient } from "@supabase/supabase-js";
import { getGoogleFreeBusy } from "./google";
import { getMicrosoftFreeBusy } from "./microsoft";

interface SlotStrategy {
  duration_minutes: number;
  lead_time_hours: number;
  buffer_minutes: number;
  max_per_day: number;
  working_hours: { start: number; end: number };
}

interface Slot {
  start: string; // ISO
  end: string; // ISO
}

interface BusySlot {
  start: string;
  end: string;
}

/**
 * Generate available appointment slots for the next N days.
 * Respects: working hours, lead time, buffer, max per day, calendar busy times, existing holds.
 */
export async function generateSlots(
  supabase: SupabaseClient,
  orgId: string,
  strategy: SlotStrategy,
  daysAhead: number = 14
): Promise<Slot[]> {
  const now = new Date();
  const earliestStart = new Date(
    now.getTime() + strategy.lead_time_hours * 60 * 60 * 1000
  );

  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + daysAhead);

  // Get busy times from calendar
  let busySlots: BusySlot[] = [];

  const { data: calConnection } = await supabase
    .from("org_calendar_connections")
    .select("provider")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .single();

  if (calConnection) {
    try {
      if (calConnection.provider === "google") {
        busySlots = await getGoogleFreeBusy(
          supabase,
          orgId,
          earliestStart.toISOString(),
          endDate.toISOString()
        );
      } else if (calConnection.provider === "microsoft") {
        busySlots = await getMicrosoftFreeBusy(
          supabase,
          orgId,
          earliestStart.toISOString(),
          endDate.toISOString()
        );
      }
    } catch (err) {
      console.error("Failed to fetch calendar busy times:", err);
    }
  }

  // Get existing holds and appointments
  const { data: existingHolds } = await supabase
    .from("holds")
    .select("slot_start, slot_end")
    .eq("org_id", orgId)
    .gte("expires_at", now.toISOString());

  const { data: existingAppointments } = await supabase
    .from("appointments")
    .select("start_at, end_at")
    .eq("org_id", orgId)
    .in("status", ["confirmed", "pending_payment", "pending_hold"])
    .gte("start_at", earliestStart.toISOString());

  const allBusy: BusySlot[] = [
    ...busySlots,
    ...(existingHolds || []).map((h: any) => ({
      start: h.slot_start,
      end: h.slot_end,
    })),
    ...(existingAppointments || []).map((a: any) => ({
      start: a.start_at,
      end: a.end_at,
    })),
  ];

  // Generate candidate slots
  const slots: Slot[] = [];
  const current = new Date(earliestStart);
  current.setMinutes(0, 0, 0);

  // Move to next working hour if needed
  if (current.getHours() < strategy.working_hours.start) {
    current.setHours(strategy.working_hours.start, 0, 0, 0);
  }

  while (current < endDate) {
    const dayOfWeek = current.getDay();

    // Skip weekends (0=Sun, 6=Sat)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      current.setDate(current.getDate() + 1);
      current.setHours(strategy.working_hours.start, 0, 0, 0);
      continue;
    }

    const hour = current.getHours();

    // Check working hours
    if (hour < strategy.working_hours.start) {
      current.setHours(strategy.working_hours.start, 0, 0, 0);
      continue;
    }

    const slotEnd = new Date(
      current.getTime() + strategy.duration_minutes * 60 * 1000
    );

    // Check if slot end is within working hours
    if (slotEnd.getHours() > strategy.working_hours.end ||
        (slotEnd.getHours() === strategy.working_hours.end && slotEnd.getMinutes() > 0)) {
      // Move to next day
      current.setDate(current.getDate() + 1);
      current.setHours(strategy.working_hours.start, 0, 0, 0);
      continue;
    }

    // Check if after earliest start
    if (current >= earliestStart) {
      // Check for conflicts with busy times
      const hasConflict = allBusy.some((busy) => {
        const busyStart = new Date(busy.start);
        const busyEnd = new Date(busy.end);
        return current < busyEnd && slotEnd > busyStart;
      });

      if (!hasConflict) {
        // Check max per day
        const dayStart = new Date(current);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const slotsThisDay = slots.filter((s) => {
          const sStart = new Date(s.start);
          return sStart >= dayStart && sStart < dayEnd;
        });

        if (slotsThisDay.length < strategy.max_per_day) {
          slots.push({
            start: current.toISOString(),
            end: slotEnd.toISOString(),
          });
        }
      }
    }

    // Move to next slot start (duration + buffer)
    current.setMinutes(
      current.getMinutes() + strategy.duration_minutes + strategy.buffer_minutes
    );
  }

  return slots;
}
