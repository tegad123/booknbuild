export interface GeminiAnalysisResult {
  classification: {
    material?: string;
    type?: string;
    hints: string[];
  };
  quality: {
    issues: string[];
    missing_photo_prompts: string[];
  };
  confidence: number;
}

export interface PropertyDataResult {
  value: number;
  value_type: string; // "linear_feet" | "squares" | "sqft"
  confidence: number;
  metadata: Record<string, unknown>;
}

export interface FusionResult {
  selected_value: number;
  selected_value_type: string;
  confidence: number;
  decision: "auto_quote" | "needs_approval" | "force_booking";
  normalized_fields: {
    material?: string;
    height?: string;
    add_ons: string[];
    [key: string]: unknown;
  };
  explanation: string;
}
