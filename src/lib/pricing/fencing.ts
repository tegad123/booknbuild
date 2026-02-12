import { PricingInput, PricingOutput, Package, LineItem } from "./types";

interface FenceMaterialConfig {
  cost_per_lf: number;
  markup: number;
}

interface FencePricingConfig {
  labor_per_lf: number;
  materials: Record<string, FenceMaterialConfig>;
  gates: { single_4ft: number; double_8ft: number };
  tearout_per_lf: number;
  hauloff_flat: number;
  minimum_fee: number;
  multipliers: Record<string, number>;
}

function resolveMaterialKey(
  material: string | undefined,
  height: string | undefined
): string {
  const mat = (material || "wood").toLowerCase();
  const h = (height || "6ft").includes("4") ? "4ft" : "6ft";

  if (mat.includes("vinyl")) return `vinyl_${h}`;
  if (mat.includes("chain")) return `chain_link_${h}`;
  return `wood_${h}`;
}

function buildFencePackage(
  name: string,
  tier: "economy" | "mid" | "premium",
  lf: number,
  materialConfig: FenceMaterialConfig,
  pricing: FencePricingConfig,
  fields: PricingInput["normalized_fields"],
  tierMultiplier: number
): Package {
  const items: LineItem[] = [];

  // Material cost with tier multiplier
  const materialCostPerLf = Math.round(
    materialConfig.cost_per_lf * materialConfig.markup * tierMultiplier
  );
  items.push({
    label: `Fencing material`,
    quantity: lf,
    unit: "LF",
    unit_price: materialCostPerLf,
    total: materialCostPerLf * lf,
  });

  // Labor
  const laborPerLf = Math.round(pricing.labor_per_lf * tierMultiplier);
  items.push({
    label: "Installation labor",
    quantity: lf,
    unit: "LF",
    unit_price: laborPerLf,
    total: laborPerLf * lf,
  });

  // Gates
  if (fields.add_ons.includes("gate_single") || fields.add_ons.includes("gate")) {
    const gateCount = Number(fields.gate_count) || 1;
    items.push({
      label: "Single gate (4ft)",
      quantity: gateCount,
      unit: "ea",
      unit_price: pricing.gates.single_4ft,
      total: pricing.gates.single_4ft * gateCount,
    });
  }
  if (fields.add_ons.includes("gate_double")) {
    const gateCount = Number(fields.double_gate_count) || 1;
    items.push({
      label: "Double gate (8ft)",
      quantity: gateCount,
      unit: "ea",
      unit_price: pricing.gates.double_8ft,
      total: pricing.gates.double_8ft * gateCount,
    });
  }

  // Tearout
  if (fields.add_ons.includes("tearout")) {
    items.push({
      label: "Existing fence removal",
      quantity: lf,
      unit: "LF",
      unit_price: pricing.tearout_per_lf,
      total: pricing.tearout_per_lf * lf,
    });
  }

  // Haul-off
  if (fields.add_ons.includes("tearout") || fields.add_ons.includes("hauloff")) {
    items.push({
      label: "Debris haul-off",
      quantity: 1,
      unit: "flat",
      unit_price: pricing.hauloff_flat,
      total: pricing.hauloff_flat,
    });
  }

  const subtotal = Math.max(
    items.reduce((sum, item) => sum + item.total, 0),
    pricing.minimum_fee
  );

  return { name, tier, line_items: items, subtotal };
}

export function calculateFencing(input: PricingInput): PricingOutput {
  const pricing = input.config as unknown as FencePricingConfig;
  const lf = input.measurement;
  const fields = input.normalized_fields;

  const materialKey = resolveMaterialKey(fields.material, fields.height);
  const materialConfig = pricing.materials[materialKey];

  if (!materialConfig) {
    throw new Error(`Unknown fence material: ${materialKey}`);
  }

  // Economy: basic material, standard labor (0.85x)
  // Mid: selected material, standard pricing (1.0x)
  // Premium: upgraded material, premium labor (1.2x)
  const economy = buildFencePackage(
    "Basic",
    "economy",
    lf,
    materialConfig,
    pricing,
    fields,
    0.85
  );

  const mid = buildFencePackage(
    "Standard",
    "mid",
    lf,
    materialConfig,
    pricing,
    fields,
    1.0
  );

  const premium = buildFencePackage(
    "Premium",
    "premium",
    lf,
    materialConfig,
    pricing,
    fields,
    1.2
  );

  const verification_clause =
    `This quote is based on approximately ${lf} linear feet of fencing ` +
    `as estimated from photos and property data. Final price may vary ` +
    `after on-site verification of property lines and grade conditions.`;

  return {
    packages: [economy, mid, premium],
    totals: {
      economy_total: economy.subtotal,
      mid_total: mid.subtotal,
      premium_total: premium.subtotal,
    },
    verification_clause,
  };
}
