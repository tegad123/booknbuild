import { describe, it, expect } from "vitest";
import { calculateConcrete } from "@/lib/pricing/concrete";
import { CONCRETE_TEMPLATE } from "@/lib/templates/seed-data";
import { PricingInput } from "@/lib/pricing/types";

const defaultConfig = CONCRETE_TEMPLATE.org_config.pricing;

function makeInput(overrides: Partial<PricingInput> = {}): PricingInput {
  return {
    niche: "concrete",
    measurement: 450,
    measurement_type: "sqft",
    normalized_fields: {
      thickness: "4 inches",
      add_ons: [],
    },
    config: defaultConfig as Record<string, unknown>,
    ...overrides,
  };
}

describe("Concrete Pricing", () => {
  it("calculates basic 4in slab without add-ons", () => {
    const result = calculateConcrete(makeInput());

    expect(result.packages).toHaveLength(3);

    // Mid tier: material (450 * 1.35 = 608/sqft) + labor (350/sqft) = 958/sqft * 450 = 431100
    const mid = result.packages[1];
    const materialItem = mid.line_items.find((i) => i.label.includes("material"));
    const laborItem = mid.line_items.find((i) => i.label.includes("labor"));

    expect(materialItem!.unit_price).toBe(608); // Math.round(450 * 1.35) = 608
    expect(laborItem!.unit_price).toBe(350);

    expect(mid.subtotal).toBe(608 * 450 + 350 * 450);
  });

  it("handles 6in thickness", () => {
    const result = calculateConcrete(
      makeInput({
        normalized_fields: {
          thickness: "6 inches",
          add_ons: [],
        },
      })
    );

    const mid = result.packages[1];
    const materialItem = mid.line_items.find((i) => i.label.includes("material"));
    // standard_6in: 600 * 1.3 = 780
    expect(materialItem!.unit_price).toBe(780);
  });

  it("adds rebar reinforcement", () => {
    const result = calculateConcrete(
      makeInput({
        normalized_fields: {
          thickness: "4 inches",
          reinforcement: "Rebar",
          add_ons: [],
        },
      })
    );

    const mid = result.packages[1];
    const rebar = mid.line_items.find((i) => i.label.includes("Rebar"));

    expect(rebar).toBeDefined();
    expect(rebar!.unit_price).toBe(150);
    expect(rebar!.total).toBe(150 * 450);
  });

  it("adds wire mesh reinforcement", () => {
    const result = calculateConcrete(
      makeInput({
        normalized_fields: {
          thickness: "4 inches",
          reinforcement: "Wire Mesh",
          add_ons: [],
        },
      })
    );

    const mid = result.packages[1];
    const mesh = mid.line_items.find((i) => i.label.includes("Wire mesh"));

    expect(mesh).toBeDefined();
    expect(mesh!.unit_price).toBe(75);
    expect(mesh!.total).toBe(75 * 450);
  });

  it("adds stamped finish upcharge", () => {
    const result = calculateConcrete(
      makeInput({
        normalized_fields: {
          thickness: "4 inches",
          finish: "Stamped",
          add_ons: [],
        },
      })
    );

    const mid = result.packages[1];
    const finish = mid.line_items.find((i) => i.label.includes("Stamped"));

    expect(finish).toBeDefined();
    expect(finish!.unit_price).toBe(250);
    expect(finish!.total).toBe(250 * 450);
  });

  it("adds exposed aggregate finish", () => {
    const result = calculateConcrete(
      makeInput({
        normalized_fields: {
          thickness: "4 inches",
          finish: "Exposed Aggregate",
          add_ons: [],
        },
      })
    );

    const mid = result.packages[1];
    const finish = mid.line_items.find((i) => i.label.includes("Exposed aggregate"));

    expect(finish).toBeDefined();
    expect(finish!.unit_price).toBe(200);
  });

  it("adds polished finish", () => {
    const result = calculateConcrete(
      makeInput({
        normalized_fields: {
          thickness: "4 inches",
          finish: "Polished",
          add_ons: [],
        },
      })
    );

    const mid = result.packages[1];
    const finish = mid.line_items.find((i) => i.label.includes("Polished"));

    expect(finish).toBeDefined();
    expect(finish!.unit_price).toBe(400);
  });

  it("does not add finish upcharge for broom finish", () => {
    const result = calculateConcrete(
      makeInput({
        normalized_fields: {
          thickness: "4 inches",
          finish: "Broom",
          add_ons: [],
        },
      })
    );

    const mid = result.packages[1];
    // Should only have material and labor
    expect(mid.line_items).toHaveLength(2);
  });

  it("adds demo when included in add_ons", () => {
    const result = calculateConcrete(
      makeInput({
        normalized_fields: {
          thickness: "4 inches",
          add_ons: ["demo"],
        },
      })
    );

    const mid = result.packages[1];
    const demo = mid.line_items.find((i) => i.label.includes("Remove existing"));

    expect(demo).toBeDefined();
    expect(demo!.unit_price).toBe(300);
    expect(demo!.total).toBe(300 * 450);
  });

  it("enforces minimum fee", () => {
    const result = calculateConcrete(
      makeInput({
        measurement: 20, // very small area
      })
    );

    // minimum_fee: 250000 ($2500)
    expect(result.totals.economy_total).toBeGreaterThanOrEqual(250000);
    expect(result.totals.mid_total).toBeGreaterThanOrEqual(250000);
    expect(result.totals.premium_total).toBeGreaterThanOrEqual(250000);
  });

  it("economy < mid < premium", () => {
    const result = calculateConcrete(makeInput());
    expect(result.totals.economy_total).toBeLessThan(result.totals.mid_total);
    expect(result.totals.mid_total).toBeLessThan(result.totals.premium_total);
  });

  it("handles full add-ons combo", () => {
    const result = calculateConcrete(
      makeInput({
        normalized_fields: {
          thickness: "6 inches",
          reinforcement: "Rebar",
          finish: "Stamped",
          add_ons: ["demo"],
        },
      })
    );

    const mid = result.packages[1];
    // Should have: material, labor, rebar, stamped finish, demo = 5 items
    expect(mid.line_items).toHaveLength(5);

    const demo = mid.line_items.find((i) => i.label.includes("Remove"));
    const rebar = mid.line_items.find((i) => i.label.includes("Rebar"));
    const stamped = mid.line_items.find((i) => i.label.includes("Stamped"));

    expect(demo).toBeDefined();
    expect(rebar).toBeDefined();
    expect(stamped).toBeDefined();
  });

  it("generates verification clause with square feet", () => {
    const result = calculateConcrete(makeInput({ measurement: 500 }));
    expect(result.verification_clause).toContain("500 square feet");
  });
});
