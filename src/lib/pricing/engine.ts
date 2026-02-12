import { PricingInput, PricingOutput } from "./types";
import { calculateFencing } from "./fencing";
import { calculateRoofing } from "./roofing";
import { calculateConcrete } from "./concrete";

const calculators: Record<string, (input: PricingInput) => PricingOutput> = {
  fencing: calculateFencing,
  roofing: calculateRoofing,
  concrete: calculateConcrete,
};

export function calculatePrice(input: PricingInput): PricingOutput {
  const calculator = calculators[input.niche];
  if (!calculator) {
    throw new Error(`No pricing calculator for niche: ${input.niche}`);
  }
  return calculator(input);
}
