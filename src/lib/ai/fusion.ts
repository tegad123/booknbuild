import type { GeminiAnalysisResult, PropertyDataResult, FusionResult } from "./types";

const MOCK = process.env.MOCK_AI === "true";

export async function fuseAndDecide(
  geminiResult: GeminiAnalysisResult,
  propertyResult: PropertyDataResult,
  customerEstimate: string | undefined,
  niche: string,
  thresholds: { auto_quote_confidence?: number } = {}
): Promise<FusionResult> {
  if (MOCK) {
    return getMockFusion(propertyResult, niche, thresholds);
  }

  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

  const prompt = `You are a home services estimation AI for ${niche} projects.

Given these data sources, produce a final measurement decision.

Photo Analysis (Gemini):
${JSON.stringify(geminiResult, null, 2)}

Property Data (satellite/parcel):
${JSON.stringify(propertyResult, null, 2)}

Customer Estimate: ${customerEstimate || "Not provided"}

Auto-quote confidence threshold: ${thresholds.auto_quote_confidence || 0.75}

Return ONLY valid JSON:
{
  "selected_value": number (the measurement you recommend using),
  "selected_value_type": "${propertyResult.value_type}",
  "confidence": 0.0 to 1.0,
  "decision": "auto_quote" | "needs_approval" | "force_booking",
  "normalized_fields": {
    "material": "string or null",
    "height": "string or null",
    "add_ons": ["list of detected add-ons like tearout, gates, etc."]
  },
  "explanation": "Brief explanation of your decision"
}

Decision rules:
- auto_quote: confidence >= threshold AND data sources agree within 20%
- needs_approval: confidence < threshold OR data sources disagree by > 20%
- force_booking: insufficient data for any quote (skip to in-person estimate)`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error("GPT-4o mini returned empty response");

  return JSON.parse(text) as FusionResult;
}

function getMockFusion(
  propertyResult: PropertyDataResult,
  niche: string,
  thresholds: { auto_quote_confidence?: number }
): FusionResult {
  const threshold = thresholds.auto_quote_confidence || 0.75;
  const confidence = 0.82;

  const normalizedByNiche: Record<string, FusionResult["normalized_fields"]> = {
    fencing: {
      material: "wood",
      height: "6ft",
      add_ons: ["tearout"],
    },
    roofing: {
      material: "asphalt_architectural",
      height: undefined,
      add_ons: ["tearoff"],
    },
    concrete: {
      material: "standard_4in",
      height: undefined,
      add_ons: ["demo", "broom_finish"],
    },
  };

  return {
    selected_value: propertyResult.value,
    selected_value_type: propertyResult.value_type,
    confidence,
    decision: confidence >= threshold ? "auto_quote" : "needs_approval",
    normalized_fields: normalizedByNiche[niche] || normalizedByNiche.fencing,
    explanation: `Mock fusion: selected property data value of ${propertyResult.value} ${propertyResult.value_type} with ${(confidence * 100).toFixed(0)}% confidence.`,
  };
}
