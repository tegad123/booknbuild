import { createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { QuoteView } from "@/components/quotes/quote-view";

export default async function PublicQuotePage({
  params,
}: {
  params: Promise<{ quoteId: string }>;
}) {
  const { quoteId } = await params;
  const supabase = await createServiceClient();

  // Fetch quote with lead and org info
  const { data: quote } = await supabase
    .from("quotes")
    .select("*, leads(name, address, email, phone), orgs(name, brand_json)")
    .eq("id", quoteId)
    .single();

  if (!quote) notFound();

  // Track view
  if (!quote.viewed_at) {
    await supabase
      .from("quotes")
      .update({ viewed_at: new Date().toISOString(), status: "viewed" })
      .eq("id", quoteId)
      .in("status", ["sent"]);

    await supabase.from("events").insert({
      org_id: quote.org_id,
      type: "quote_viewed",
      lead_id: quote.lead_id,
      metadata_json: { quote_id: quoteId },
    });
  }

  const lead = (quote as any).leads;
  const org = (quote as any).orgs;
  const brand = org?.brand_json || {};

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: brand.bg_color || "#f9fafb",
      }}
    >
      <div className="max-w-3xl mx-auto py-8 px-4">
        {/* Header with branding */}
        <div className="text-center mb-8">
          {brand.logo_url && (
            <img
              src={brand.logo_url}
              alt={org?.name}
              className="h-12 mx-auto mb-4"
            />
          )}
          <h1
            className="text-2xl font-bold"
            style={{ color: brand.primary_color || "#111" }}
          >
            Your {quote.niche} Quote
          </h1>
          <p className="text-gray-600 mt-1">
            Prepared for {lead?.name || "Valued Customer"}
          </p>
          {lead?.address && (
            <p className="text-gray-500 text-sm">{lead.address}</p>
          )}
        </div>

        <QuoteView
          quote={quote}
          brandColor={brand.primary_color || "#2563eb"}
          bookingUrl={`/book/${quoteId}`}
        />

        {/* Verification clause */}
        {quote.verification_clause && (
          <p className="text-xs text-gray-400 text-center mt-8 max-w-lg mx-auto">
            {quote.verification_clause}
          </p>
        )}

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>{org?.name}</p>
        </div>
      </div>
    </div>
  );
}
