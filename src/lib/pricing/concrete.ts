import { PricingInput, PricingOutput, Package, LineItem } from "./types";

interface ConcreteMaterialConfig {
  cost_per_sqft: number;
  markup: number;
}

interface ConcretePricingConfig {
  labor_per_sqft: number;
  materials: Record<string, ConcreteMaterialConfig>;
  rebar_per_sqft: number;
  mesh_per_sqft: number;
  demo_per_sqft: number;
  finish_options: Record<string, number>;
  minimum_fee: number;
}

function resolveThicknessKey(thickness: string | undefined): string {
  if (!thickness) return "standard_4in";
  const t = thickness.toLowerCase();
  if (t.includes("6")) return "standard_6in";
  return "standard_4in";
}

function resolveReinforcementCost(
  reinforcement: string | undefined,
  pricing: ConcretePricingConfig
): { label: string; cost_per_sqft: number } | null {
  if (!reinforcement) return null;
  const r = reinforcement.toLowerCase();
  if (r.includes("rebar"))
    return { label: "Rebar reinforcement", cost_per_sqft: pricing.rebar_per_sqft };
  if (r.includes("mesh"))
    return { label: "Wire mesh reinforcement", cost_per_sqft: pricing.mesh_per_sqft };
  return null;
}

function resolveFinishCost(
  finish: string | undefined,
  finishOptions: Record<string, number>
): { label: string; cost_per_sqft: number } | null {
  if (!finish) return null;
  const f = finish.toLowerCase();
  if (f.includes("stamp")) return { label: "Stamped finish", cost_per_sqft: finishOptions.stamped || 0 };
  if (f.includes("exposed") || f.includes("aggregate"))
    return { label: "Exposed aggregate finish", cost_per_sqft: finishOptions.exposed_aggregate || 0 };
  if (f.includes("polish"))
    return { label: "Polished finish", cost_per_sqft: finishOptions.polished || 0 };
  // Broom finish is free/default
  return null;
}

function buildConcretePackage(
  name: string,
  tier: "economy" | "mid" | "premium",
  sqft: number,
  materialConfig: ConcreteMaterialConfig,
  pricing: ConcretePricingConfig,
  fields: PricingInput["normalized_fields"],
  tierMultiplier: number
): Package {
  const items: LineItem[] = [];

  // Material
  const materialCostPerSqft = Math.round(
    materialConfig.cost_per_sqft * materialConfig.markup * tierMultiplier
  );
  items.push({
    label: "Concrete material",
    quantity: sqft,
    unit: "sqft",
    unit_price: materialCostPerSqft,
    total: materialCostPerSqft * sqft,
  });

  // Labor
  const laborPerSqft = Math.round(pricing.labor_per_sqft * tierMultiplier);
  items.push({
    label: "Installation labor",
    quantity: sqft,
    unit: "sqft",
    unit_price: laborPerSqft,
    total: laborPerSqft * sqft,
  });

  // Reinforcement
  const reinforcement = resolveReinforcementCost(
    fields.reinforcement as string | undefined,
    pricing
  );
  if (reinforcement) {
    items.push({
      label: reinforcement.label,
      quantity: sqft,
      unit: "sqft",
      unit_price: reinforcement.cost_per_sqft,
      total: reinforcement.cost_per_sqft * sqft,
    });
  }

  // Finish upcharge
  const finish = resolveFinishCost(
    fields.finish as string | undefined,
    pricing.finish_options
  );
  if (finish && finish.cost_per_sqft > 0) {
    items.push({
      label: finish.label,
      quantity: sqft,
      unit: "sqft",
      unit_price: finish.cost_per_sqft,
      total: finish.cost_per_sqft * sqft,
    });
  }

  // Demo existing concrete
  if (fields.add_ons.includes("demo")) {
    items.push({
      label: "Remove existing concrete",
      quantity: sqft,
      unit: "sqft",
      unit_price: pricing.demo_per_sqft,
      total: pricing.demo_per_sqft * sqft,
    });
  }

  const subtotal = Math.max(
    items.reduce((sum, item) => sum + item.total, 0),
    pricing.minimum_fee
  );

  return { name, tier, line_items: items, subtotal };
}

export function calculateConcrete(input: PricingInput): PricingOutput {
  const pricing = input.config as unknown as ConcretePricingConfig;
  const sqft = input.measurement;
  const fields = input.normalized_fields;

  const thicknessKey = resolveThicknessKey(fields.thickness as string | undefined);
  const materialConfig = pricing.materials[thicknessKey];

  if (!materialConfig) {
    throw new Error(`Unknown concrete thickness: ${thicknessKey}`);
  }

  const economy = buildConcretePackage(
    "Basic",
    "economy",
    sqft,
    materialConfig,
    pricing,
    fields,
    0.85
  );

  const mid = buildConcretePackage(
    "Standard",
    "mid",
    sqft,
    materialConfig,
    pricing,
    fields,
    1.0
  );

  const premium = buildConcretePackage(
    "Premium",
    "premium",
    sqft,
    materialConfig,
    pricing,
    fields,
    1.2
  );

  const verification_clause =
    `This quote is based on approximately ${sqft} square feet ` +
    `of concrete work as estimated from photos and property data. ` +
    `Final price may vary after on-site measurement and assessment ` +
    `of grade, access, and soil conditions.`;

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
