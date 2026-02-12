import { describe, it, expect } from "vitest";
import { calculateFencing } from "@/lib/pricing/fencing";
import { FENCE_TEMPLATE } from "@/lib/templates/seed-data";
import { PricingInput } from "@/lib/pricing/types";

const defaultConfig = FENCE_TEMPLATE.org_config.pricing;

function makeInput(overrides: Partial<PricingInput> = {}): PricingInput {
  return {
    niche: "fencing",
    measurement: 150,
    measurement_type: "linear_feet",
    normalized_fields: {
      material: "wood",
      height: "6ft",
      add_ons: [],
    },
    config: defaultConfig as Record<string, unknown>,
    ...overrides,
  };
}

describe("Fencing Pricing", () => {
  it("calculates basic wood 6ft fence without add-ons", () => {
    const result = calculateFencing(makeInput());

    expect(result.packages).toHaveLength(3);
    expect(result.packages[0].tier).toBe("economy");
    expect(result.packages[1].tier).toBe("mid");
    expect(result.packages[2].tier).toBe("premium");

    // Mid tier: material (1800 * 1.4 = 2520/LF) + labor (2500/LF) = 5020/LF * 150 = 753000
    const midPkg = result.packages[1];
    const materialItem = midPkg.line_items.find((i) => i.label.includes("material"));
    const laborItem = midPkg.line_items.find((i) => i.label.includes("labor"));

    expect(materialItem).toBeDefined();
    expect(materialItem!.unit_price).toBe(2520); // 1800 * 1.4
    expect(materialItem!.total).toBe(2520 * 150);

    expect(laborItem).toBeDefined();
    expect(laborItem!.unit_price).toBe(2500);
    expect(laborItem!.total).toBe(2500 * 150);

    expect(midPkg.subtotal).toBe(2520 * 150 + 2500 * 150);
    expect(result.totals.mid_total).toBe(midPkg.subtotal);
  });

  it("applies economy tier multiplier (0.85x)", () => {
    const result = calculateFencing(makeInput());
    const economy = result.packages[0];

    const materialItem = economy.line_items.find((i) => i.label.includes("material"));
    // 1800 * 1.4 * 0.85 = 2142
    expect(materialItem!.unit_price).toBe(2142);

    const laborItem = economy.line_items.find((i) => i.label.includes("labor"));
    // 2500 * 0.85 = 2125
    expect(laborItem!.unit_price).toBe(2125);
  });

  it("applies premium tier multiplier (1.2x)", () => {
    const result = calculateFencing(makeInput());
    const premium = result.packages[2];

    const materialItem = premium.line_items.find((i) => i.label.includes("material"));
    // 1800 * 1.4 * 1.2 = 3024
    expect(materialItem!.unit_price).toBe(3024);

    const laborItem = premium.line_items.find((i) => i.label.includes("labor"));
    // 2500 * 1.2 = 3000
    expect(laborItem!.unit_price).toBe(3000);
  });

  it("adds tearout and hauloff when included in add_ons", () => {
    const result = calculateFencing(
      makeInput({
        normalized_fields: {
          material: "wood",
          height: "6ft",
          add_ons: ["tearout"],
        },
      })
    );

    const mid = result.packages[1];
    const tearout = mid.line_items.find((i) => i.label.includes("removal"));
    const hauloff = mid.line_items.find((i) => i.label.includes("haul"));

    expect(tearout).toBeDefined();
    expect(tearout!.unit_price).toBe(800);
    expect(tearout!.total).toBe(800 * 150);

    expect(hauloff).toBeDefined();
    expect(hauloff!.total).toBe(20000);
  });

  it("adds single gate when in add_ons", () => {
    const result = calculateFencing(
      makeInput({
        normalized_fields: {
          material: "wood",
          height: "6ft",
          add_ons: ["gate_single"],
          gate_count: 2,
        },
      })
    );

    const mid = result.packages[1];
    const gate = mid.line_items.find((i) => i.label.includes("Single gate"));

    expect(gate).toBeDefined();
    expect(gate!.quantity).toBe(2);
    expect(gate!.unit_price).toBe(45000);
    expect(gate!.total).toBe(90000);
  });

  it("adds double gate when in add_ons", () => {
    const result = calculateFencing(
      makeInput({
        normalized_fields: {
          material: "wood",
          height: "6ft",
          add_ons: ["gate_double"],
          double_gate_count: 1,
        },
      })
    );

    const mid = result.packages[1];
    const gate = mid.line_items.find((i) => i.label.includes("Double gate"));

    expect(gate).toBeDefined();
    expect(gate!.quantity).toBe(1);
    expect(gate!.total).toBe(85000);
  });

  it("enforces minimum fee", () => {
    const result = calculateFencing(
      makeInput({
        measurement: 10, // very short fence
      })
    );

    // All tiers should be at least minimum_fee (150000 cents = $1500)
    expect(result.totals.economy_total).toBeGreaterThanOrEqual(150000);
    expect(result.totals.mid_total).toBeGreaterThanOrEqual(150000);
    expect(result.totals.premium_total).toBeGreaterThanOrEqual(150000);
  });

  it("handles vinyl material correctly", () => {
    const result = calculateFencing(
      makeInput({
        normalized_fields: {
          material: "vinyl",
          height: "6ft",
          add_ons: [],
        },
      })
    );

    const mid = result.packages[1];
    const materialItem = mid.line_items.find((i) => i.label.includes("material"));
    // vinyl_6ft: 3200 * 1.3 = 4160
    expect(materialItem!.unit_price).toBe(4160);
  });

  it("handles chain link material correctly", () => {
    const result = calculateFencing(
      makeInput({
        normalized_fields: {
          material: "chain_link",
          height: "4ft",
          add_ons: [],
        },
      })
    );

    const mid = result.packages[1];
    const materialItem = mid.line_items.find((i) => i.label.includes("material"));
    // chain_link_4ft: 800 * 1.5 = 1200
    expect(materialItem!.unit_price).toBe(1200);
  });

  it("economy < mid < premium", () => {
    const result = calculateFencing(makeInput());
    expect(result.totals.economy_total).toBeLessThan(result.totals.mid_total);
    expect(result.totals.mid_total).toBeLessThan(result.totals.premium_total);
  });

  it("generates verification clause with linear feet", () => {
    const result = calculateFencing(makeInput({ measurement: 200 }));
    expect(result.verification_clause).toContain("200 linear feet");
  });
});
