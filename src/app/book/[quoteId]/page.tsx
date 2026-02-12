import { createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { SlotPicker } from "@/components/bookings/slot-picker";

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ quoteId: string }>;
  searchParams: Promise<{ package?: string }>;
}) {
  const { quoteId } = await params;
  const { package: packageTier } = await searchParams;
  const supabase = await createServiceClient();

  // Fetch quote with org info
  const { data: quote } = await supabase
    .from("quotes")
    .select("*, leads(name, address, phone, email), orgs(name, brand_json)")
    .eq("id", quoteId)
    .single();

  if (!quote) notFound();

  const lead = (quote as any).leads;
  const org = (quote as any).orgs;
  const brand = org?.brand_json || {};

  // Get deposit config
  const { data: orgConfig } = await supabase
    .from("org_configs")
    .select("config_json")
    .eq("org_id", quote.org_id)
    .eq("is_active", true)
    .single();

  const config = orgConfig?.config_json as any;
  const depositPercent = config?.booking?.deposit_percent || 25;

  // Get selected package
  const packages = quote.packages_json as any[];
  const selectedPkg = packages?.find(
    (p: any) => p.tier === (packageTier || "mid")
  );
  const total = selectedPkg?.subtotal || 0;
  const depositAmount = Math.round(total * (depositPercent / 100));

  // Check if payment provider connected
  const { data: paymentConn } = await supabase
    .from("org_payment_connections")
    .select("provider")
    .eq("org_id", quote.org_id)
    .eq("is_active", true)
    .single();

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: brand.bg_color || "#f9fafb" }}
    >
      <div className="max-w-2xl mx-auto py-8 px-4">
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
            Book Your {quote.niche} Service
          </h1>
          <p className="text-gray-600 mt-1">
            {lead?.name} - {lead?.address}
          </p>
          {selectedPkg && (
            <p className="text-lg font-semibold mt-2">
              {selectedPkg.name} Package -{" "}
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
              }).format(total / 100)}
            </p>
          )}
        </div>

        <SlotPicker
          quoteId={quoteId}
          packageTier={packageTier || "mid"}
          depositAmount={depositAmount}
          totalAmount={total}
          depositPercent={depositPercent}
          brandColor={brand.primary_color || "#2563eb"}
          paymentProvider={paymentConn?.provider || null}
        />
      </div>
    </div>
  );
}
