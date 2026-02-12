import { describe, it, expect } from "vitest";
import { calculateRoofing } from "@/lib/pricing/roofing";
import { ROOF_TEMPLATE } from "@/lib/templates/seed-data";
import { PricingInput } from "@/lib/pricing/types";

const defaultConfig = ROOF_TEMPLATE.org_config.pricing;

function makeInput(overrides: Partial<PricingInput> = {}): PricingInput {
  return {
    niche: "roofing",
    measurement: 22,
    measurement_type: "squares",
    normalized_fields: {
      material: "asphalt_architectural",
      add_ons: [],
    },
    config: defaultConfig as Record<string, unknown>,
    ...overrides,
  };
}

describe("Roofing Pricing", () => {
  it("calculates basic architectural shingle roof", () => {
    const result = calculateRoofing(makeInput());

    expect(result.packages).toHaveLength(3);

    // Mid tier: material (12000 * 1.3 = 15600/sq) + labor (7500/sq) = 23100/sq * 22 = 508200
    const mid = result.packages[1];
    const materialItem = mid.line_items.find((i) => i.label.includes("material"));
    const laborItem = mid.line_items.find((i) => i.label.includes("labor"));

    expect(materialItem!.unit_price).toBe(15600); // 12000 * 1.3
    expect(materialItem!.total).toBe(15600 * 22);

    expect(laborItem!.unit_price).toBe(7500);
    expect(laborItem!.total).toBe(7500 * 22);

    expect(mid.subtotal).toBe((15600 + 7500) * 22);
  });

  it("applies pitch multiplier to labor", () => {
    const result = calculateRoofing(
      makeInput({
        normalized_fields: {
          material: "asphalt_architectural",
          pitch: "Steep (8/12+)",
          add_ons: [],
        },
      })
    );

    const mid = result.packages[1];
    const laborItem = mid.line_items.find((i) => i.label.includes("labor"));
    // 7500 * 1.2 (8/12 pitch multiplier) = 9000
    expect(laborItem!.unit_price).toBe(9000);
  });

  it("adds tearoff when included", () => {
    const result = calculateRoofing(
      makeInput({
        normalized_fields: {
          material: "asphalt_architectural",
          add_ons: ["tearoff"],
        },
      })
    );

    const mid = result.packages[1];
    const tearoff = mid.line_items.find((i) => i.label.includes("Tear-off"));

    expect(tearoff).toBeDefined();
    expect(tearoff!.unit_price).toBe(5000);
    expect(tearoff!.total).toBe(5000 * 22);
  });

  it("applies pitch multiplier to tearoff cost", () => {
    const result = calculateRoofing(
      makeInput({
        normalized_fields: {
          material: "asphalt_architectural",
          pitch: "Medium (6/12)",
          add_ons: ["tearoff"],
        },
      })
    );

    const mid = result.packages[1];
    const tearoff = mid.line_items.find((i) => i.label.includes("Tear-off"));
    // 5000 * 1.1 (6/12 pitch) = 5500
    expect(tearoff!.unit_price).toBe(5500);
  });

  it("adds decking allowance when included", () => {
    const result = calculateRoofing(
      makeInput({
        normalized_fields: {
          material: "asphalt_architectural",
          add_ons: ["decking"],
        },
      })
    );

    const mid = result.packages[1];
    const decking = mid.line_items.find((i) => i.label.includes("Decking"));

    expect(decking).toBeDefined();
    expect(decking!.unit_price).toBe(3000);
    expect(decking!.total).toBe(3000 * 22);
  });

  it("enforces minimum fee", () => {
    const result = calculateRoofing(
      makeInput({
        measurement: 3, // tiny roof
      })
    );

    // minimum_fee: 500000 ($5000)
    expect(result.totals.economy_total).toBeGreaterThanOrEqual(500000);
    expect(result.totals.mid_total).toBeGreaterThanOrEqual(500000);
    expect(result.totals.premium_total).toBeGreaterThanOrEqual(500000);
  });

  it("handles metal standing seam pricing", () => {
    const result = calculateRoofing(
      makeInput({
        normalized_fields: {
          material: "metal_standing_seam",
          add_ons: [],
        },
      })
    );

    const mid = result.packages[1];
    const materialItem = mid.line_items.find((i) => i.label.includes("material"));
    // metal_standing_seam: 35000 * 1.25 = 43750
    expect(materialItem!.unit_price).toBe(43750);
  });

  it("defaults to 3-tab for unknown material", () => {
    const result = calculateRoofing(
      makeInput({
        normalized_fields: {
          material: "unknown",
          add_ons: [],
        },
      })
    );

    const mid = result.packages[1];
    const materialItem = mid.line_items.find((i) => i.label.includes("material"));
    // asphalt_3tab: 9000 * 1.35 = 12150
    expect(materialItem!.unit_price).toBe(12150);
  });

  it("economy < mid < premium", () => {
    const result = calculateRoofing(makeInput());
    expect(result.totals.economy_total).toBeLessThan(result.totals.mid_total);
    expect(result.totals.mid_total).toBeLessThan(result.totals.premium_total);
  });

  it("generates verification clause with squares and sqft", () => {
    const result = calculateRoofing(makeInput({ measurement: 25 }));
    expect(result.verification_clause).toContain("25 squares");
    expect(result.verification_clause).toContain("2500 sq ft");
  });
});
