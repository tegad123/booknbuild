"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Quote {
  id: string;
  niche: string;
  quote_version: number;
  status: string;
  packages_json: any;
  totals_json: any;
  needs_approval: boolean;
  verification_clause: string;
  created_at: string;
  sent_at: string | null;
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function QuoteApproval({
  quotes,
  orgId,
}: {
  quotes: Quote[];
  orgId: string;
}) {
  const [sending, setSending] = useState<string | null>(null);

  async function handleApproveAndSend(quoteId: string) {
    setSending(quoteId);
    try {
      const res = await fetch("/api/quotes/approve-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote_id: quoteId }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to send quote");
        return;
      }

      window.location.reload();
    } catch {
      alert("Failed to send quote");
    } finally {
      setSending(null);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Quotes</h2>

      {quotes.map((quote) => (
        <Card key={quote.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Quote v{quote.quote_version} - {quote.niche}
              </CardTitle>
              <div className="flex items-center gap-2">
                {quote.needs_approval && (
                  <Badge variant="destructive">Needs Approval</Badge>
                )}
                <Badge variant="secondary">{quote.status}</Badge>
              </div>
            </div>
          </CardHeader>

          {quote.totals_json && (
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-sm text-muted-foreground">Economy</p>
                  <p className="text-lg font-bold">
                    {formatCents(quote.totals_json.economy_total || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Standard</p>
                  <p className="text-lg font-bold text-blue-600">
                    {formatCents(quote.totals_json.mid_total || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Premium</p>
                  <p className="text-lg font-bold">
                    {formatCents(quote.totals_json.premium_total || 0)}
                  </p>
                </div>
              </div>

              {quote.verification_clause && (
                <p className="text-xs text-muted-foreground mt-4">
                  {quote.verification_clause}
                </p>
              )}

              <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
                <span>Created: {new Date(quote.created_at).toLocaleString()}</span>
                {quote.sent_at && (
                  <span>
                    | Sent: {new Date(quote.sent_at).toLocaleString()}
                  </span>
                )}
              </div>
            </CardContent>
          )}

          <CardFooter className="flex gap-2">
            {(quote.status === "needs_approval" || quote.status === "draft") && (
              <Button
                onClick={() => handleApproveAndSend(quote.id)}
                disabled={sending === quote.id}
              >
                {sending === quote.id ? "Sending..." : "Approve & Send Quote"}
              </Button>
            )}

            <Button variant="outline" asChild>
              <a
                href={`/q/${quote.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Preview
              </a>
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
