"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function OrgActions({
  orgId,
  isApproved,
  isActive,
}: {
  orgId: string;
  isApproved: boolean;
  isActive: boolean;
}) {
  const router = useRouter();
  const [activating, setActivating] = useState(false);

  async function handleActivate() {
    setActivating(true);
    const res = await fetch("/api/org/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_id: orgId }),
    });

    if (res.ok) {
      router.refresh();
    } else {
      const err = await res.json();
      alert(`Error: ${err.error}`);
    }
    setActivating(false);
  }

  if (isActive) {
    return (
      <p className="text-sm font-medium text-green-600">
        Organization is active and receiving leads.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleActivate}
        disabled={!isApproved || activating}
      >
        {activating ? "Activating..." : "Activate Organization"}
      </Button>
      {!isApproved && (
        <p className="text-xs text-muted-foreground">
          Organization must be approved before activation.
        </p>
      )}
    </div>
  );
}
