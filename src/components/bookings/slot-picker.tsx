"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Slot {
  start: string;
  end: string;
}

interface SlotPickerProps {
  quoteId: string;
  packageTier: string;
  depositAmount: number;
  totalAmount: number;
  depositPercent: number;
  brandColor: string;
  paymentProvider: string | null;
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatSlotDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatSlotTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function SlotPicker({
  quoteId,
  packageTier,
  depositAmount,
  totalAmount,
  depositPercent,
  brandColor,
  paymentProvider,
}: SlotPickerProps) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [holdData, setHoldData] = useState<any>(null);
  const [step, setStep] = useState<"select" | "confirm" | "payment" | "done">(
    "select"
  );
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [countdown, setCountdown] = useState(600); // 10 min

  useEffect(() => {
    fetch(`/api/booking/slots?quote_id=${quoteId}`)
      .then((res) => res.json())
      .then((data) => {
        setSlots(data.slots || []);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load available times");
        setLoading(false);
      });
  }, [quoteId]);

  // Countdown timer for hold
  useEffect(() => {
    if (!holdData) return;
    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.floor(
          (new Date(holdData.expires_at).getTime() - Date.now()) / 1000
        )
      );
      setCountdown(remaining);
      if (remaining === 0) {
        setError("Hold expired. Please select a new time.");
        setStep("select");
        setHoldData(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [holdData]);

  async function handleHold() {
    if (!selectedSlot) return;
    setProcessing(true);
    setError(null);

    try {
      const res = await fetch("/api/booking/hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quote_id: quoteId,
          slot_start: selectedSlot.start,
          slot_end: selectedSlot.end,
          package_tier: packageTier,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to hold slot");
        return;
      }

      setHoldData(data);
      setStep("confirm");
    } catch {
      setError("Failed to hold slot");
    } finally {
      setProcessing(false);
    }
  }

  async function handlePayment() {
    if (!holdData) return;
    setProcessing(true);
    setError(null);

    try {
      const res = await fetch("/api/booking/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quote_id: quoteId,
          appointment_id: holdData.appointment_id,
          hold_id: holdData.hold_id,
          amount: depositAmount,
          package_tier: packageTier,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Payment failed");
        return;
      }

      // In production, this would redirect to Stripe Checkout or use Stripe Elements
      // For now, show success state
      setStep("done");
    } catch {
      setError("Payment failed");
    } finally {
      setProcessing(false);
    }
  }

  // Group slots by day
  const slotsByDay: Record<string, Slot[]> = {};
  for (const slot of slots) {
    const day = formatSlotDate(slot.start);
    if (!slotsByDay[day]) slotsByDay[day] = [];
    slotsByDay[day].push(slot);
  }

  if (step === "done") {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="text-4xl mb-4">&#10003;</div>
          <h2 className="text-xl font-bold mb-2">Booking Confirmed!</h2>
          <p className="text-gray-600">
            Your appointment is scheduled for{" "}
            {selectedSlot && formatSlotDate(selectedSlot.start)} at{" "}
            {selectedSlot && formatSlotTime(selectedSlot.start)}.
          </p>
          <p className="text-gray-500 mt-2">
            You will receive a confirmation via SMS and email.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {step === "select" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Select a Time</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-gray-500">Loading available times...</p>
              ) : slots.length === 0 ? (
                <p className="text-gray-500">
                  No available times in the next 2 weeks. Please call us to
                  schedule.
                </p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(slotsByDay).map(([day, daySlots]) => (
                    <div key={day}>
                      <h3 className="font-medium text-sm mb-2">{day}</h3>
                      <div className="flex flex-wrap gap-2">
                        {daySlots.map((slot) => (
                          <Button
                            key={slot.start}
                            variant={
                              selectedSlot?.start === slot.start
                                ? "default"
                                : "outline"
                            }
                            size="sm"
                            onClick={() => setSelectedSlot(slot)}
                            style={
                              selectedSlot?.start === slot.start
                                ? { backgroundColor: brandColor, color: "white" }
                                : {}
                            }
                          >
                            {formatSlotTime(slot.start)}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {selectedSlot && (
            <Button
              className="w-full"
              style={{ backgroundColor: brandColor, color: "white" }}
              onClick={handleHold}
              disabled={processing}
            >
              {processing ? "Reserving..." : "Reserve This Time"}
            </Button>
          )}
        </>
      )}

      {step === "confirm" && holdData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Confirm & Pay Deposit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-yellow-50 text-yellow-800 p-3 rounded-lg text-sm">
              Slot held for {Math.floor(countdown / 60)}:
              {String(countdown % 60).padStart(2, "0")}
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Date</span>
                <span className="font-medium">
                  {selectedSlot && formatSlotDate(selectedSlot.start)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Time</span>
                <span className="font-medium">
                  {selectedSlot && formatSlotTime(selectedSlot.start)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total</span>
                <span className="font-medium">{formatCents(totalAmount)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Deposit ({depositPercent}%)</span>
                <span>{formatCents(depositAmount)}</span>
              </div>
            </div>

            <Button
              className="w-full"
              style={{ backgroundColor: brandColor, color: "white" }}
              onClick={handlePayment}
              disabled={processing}
            >
              {processing
                ? "Processing..."
                : `Pay ${formatCents(depositAmount)} Deposit`}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
