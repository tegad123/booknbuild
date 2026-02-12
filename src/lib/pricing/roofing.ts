import { PricingInput, PricingOutput, Package, LineItem } from "./types";

interface RoofMaterialConfig {
  cost_per_sq: number;
  markup: number;
}

interface RoofPricingConfig {
  labor_per_sq: number;
  materials: Record<string, RoofMaterialConfig>;
  tearoff_per_sq: number;
  pitch_multipliers: Record<string, number>;
  decking_allowance_per_sq: number;
  minimum_fee: number;
}

function resolveMaterialKey(material: string | undefined): string {
  const mat = (material || "").toLowerCase();
  if (mat.includes("metal") || mat.includes("standing")) return "metal_standing_seam";
  if (mat.includes("architectural")) return "asphalt_architectural";
  return "asphalt_3tab";
}

function resolvePitchMultiplier(
  pitch: string | undefined,
  pitchMultipliers: Record<string, number>
): number {
  if (!pitch) return 1.0;
  const p = pitch.toLowerCase();
  // Check medium first to avoid "6/12" matching "12" in the steep branch
  if (p.includes("medium") || p === "6/12") return pitchMultipliers["6/12"] || 1.1;
  if (p.includes("low") || p === "4/12") return pitchMultipliers["4/12"] || 1.0;
  // Steep pitches
  if (p.includes("12/12")) return pitchMultipliers["12/12"] || 1.5;
  if (p.includes("10/12")) return pitchMultipliers["10/12"] || 1.35;
  if (p.includes("steep") || p.includes("8/12")) return pitchMultipliers["8/12"] || 1.2;
  return pitchMultipliers["4/12"] || 1.0;
}

function buildRoofPackage(
  name: string,
  tier: "economy" | "mid" | "premium",
  squares: number,
  materialConfig: RoofMaterialConfig,
  pricing: RoofPricingConfig,
  pitchMultiplier: number,
  fields: PricingInput["normalized_fields"],
  tierMultiplier: number
): Package {
  const items: LineItem[] = [];

  // Material
  const materialCostPerSq = Math.round(
    materialConfig.cost_per_sq * materialConfig.markup * tierMultiplier
  );
  items.push({
    label: "Roofing material",
    quantity: squares,
    unit: "sq",
    unit_price: materialCostPerSq,
    total: materialCostPerSq * squares,
  });

  // Labor with pitch multiplier
  const laborPerSq = Math.round(
    pricing.labor_per_sq * pitchMultiplier * tierMultiplier
  );
  items.push({
    label: "Installation labor",
    quantity: squares,
    unit: "sq",
    unit_price: laborPerSq,
    total: laborPerSq * squares,
  });

  // Tear-off
  if (fields.add_ons.includes("tearoff")) {
    const tearoffPerSq = Math.round(pricing.tearoff_per_sq * pitchMultiplier);
    items.push({
      label: "Tear-off existing roof",
      quantity: squares,
      unit: "sq",
      unit_price: tearoffPerSq,
      total: tearoffPerSq * squares,
    });
  }

  // Decking allowance
  if (fields.add_ons.includes("decking")) {
    items.push({
      label: "Decking repair allowance",
      quantity: squares,
      unit: "sq",
      unit_price: pricing.decking_allowance_per_sq,
      total: pricing.decking_allowance_per_sq * squares,
    });
  }

  const subtotal = Math.max(
    items.reduce((sum, item) => sum + item.total, 0),
    pricing.minimum_fee
  );

  return { name, tier, line_items: items, subtotal };
}

export function calculateRoofing(input: PricingInput): PricingOutput {
  const pricing = input.config as unknown as RoofPricingConfig;
  const squares = input.measurement;
  const fields = input.normalized_fields;

  const materialKey = resolveMaterialKey(fields.material);
  const materialConfig = pricing.materials[materialKey];

  if (!materialConfig) {
    throw new Error(`Unknown roof material: ${materialKey}`);
  }

  const pitchMultiplier = resolvePitchMultiplier(
    fields.pitch as string | undefined,
    pricing.pitch_multipliers
  );

  // Economy: 3-tab or cheapest (0.85x)
  // Mid: selected material (1.0x)
  // Premium: highest quality + extras (1.2x)
  const economy = buildRoofPackage(
    "Basic",
    "economy",
    squares,
    materialConfig,
    pricing,
    pitchMultiplier,
    fields,
    0.85
  );

  const mid = buildRoofPackage(
    "Standard",
    "mid",
    squares,
    materialConfig,
    pricing,
    pitchMultiplier,
    fields,
    1.0
  );

  const premium = buildRoofPackage(
    "Premium",
    "premium",
    squares,
    materialConfig,
    pricing,
    pitchMultiplier,
    fields,
    1.2
  );

  const verification_clause =
    `This quote is based on approximately ${squares} squares ` +
    `(${squares * 100} sq ft) of roofing as estimated from photos and ` +
    `property data. Final price may vary after on-site inspection of ` +
    `roof condition, decking integrity, and actual pitch measurement.`;

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
