export interface PricingInput {
  niche: string;
  measurement: number;
  measurement_type: string;
  normalized_fields: {
    material?: string;
    height?: string;
    add_ons: string[];
    [key: string]: unknown;
  };
  config: Record<string, unknown>;
}

export interface LineItem {
  label: string;
  quantity: number;
  unit: string;
  unit_price: number; // cents
  total: number; // cents
}

export interface Package {
  name: string;
  tier: "economy" | "mid" | "premium";
  line_items: LineItem[];
  subtotal: number; // cents
}

export interface PricingOutput {
  packages: Package[];
  totals: {
    economy_total: number;
    mid_total: number;
    premium_total: number;
  };
  verification_clause: string;
}
