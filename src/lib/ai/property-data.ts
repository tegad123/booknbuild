import type { PropertyDataResult } from "./types";

/**
 * PropertyDataProvider stub.
 * In production, this would call a satellite/parcel data API
 * based on the address and niche.
 */
export async function lookupPropertyData(
  address: string,
  niche: string
): Promise<PropertyDataResult> {
  // Always returns mock data for now — replace with real API
  const stubs: Record<string, PropertyDataResult> = {
    fencing: {
      value: 180, // linear feet
      value_type: "linear_feet",
      confidence: 0.7,
      metadata: {
        source: "parcel_perimeter_estimate",
        lot_size_sqft: 8500,
        perimeter_ft: 370,
        frontage_excluded: true,
      },
    },
    roofing: {
      value: 22, // squares (100 sqft each)
      value_type: "squares",
      confidence: 0.65,
      metadata: {
        source: "satellite_roof_area",
        roof_area_sqft: 2200,
        stories: 2,
      },
    },
    concrete: {
      value: 450, // sqft
      value_type: "sqft",
      confidence: 0.6,
      metadata: {
        source: "satellite_slab_area",
        detected_area_sqft: 450,
      },
    },
  };

  return stubs[niche] || stubs.fencing;
}
