import type { GeminiAnalysisResult } from "./types";

const MOCK = process.env.MOCK_AI === "true";

export async function analyzePhotos(
  photoUrls: string[],
  intakeAnswers: Record<string, unknown>,
  niche: string
): Promise<GeminiAnalysisResult> {
  if (MOCK) {
    return getMockResult(niche);
  }

  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `You are analyzing photos for a ${niche} project estimate.
Intake answers: ${JSON.stringify(intakeAnswers)}
Photo URLs: ${photoUrls.join(", ")}

Analyze the photos and return ONLY valid JSON in this exact format:
{
  "classification": {
    "material": "detected material type or null",
    "type": "project type description",
    "hints": ["list of classification hints"]
  },
  "quality": {
    "issues": ["list of photo quality issues"],
    "missing_photo_prompts": ["suggestions for additional photos needed"]
  },
  "confidence": 0.0 to 1.0
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Gemini returned invalid JSON");
  }

  return JSON.parse(jsonMatch[0]) as GeminiAnalysisResult;
}

function getMockResult(niche: string): GeminiAnalysisResult {
  const mocksByNiche: Record<string, GeminiAnalysisResult> = {
    fencing: {
      classification: {
        material: "wood",
        type: "privacy fence replacement",
        hints: ["6ft height detected", "backyard installation", "flat terrain"],
      },
      quality: { issues: [], missing_photo_prompts: [] },
      confidence: 0.85,
    },
    roofing: {
      classification: {
        material: "asphalt_architectural",
        type: "full roof replacement",
        hints: ["moderate pitch", "two-story home", "some visible wear"],
      },
      quality: { issues: [], missing_photo_prompts: ["Close-up of damaged areas"] },
      confidence: 0.78,
    },
    concrete: {
      classification: {
        material: "standard_4in",
        type: "driveway replacement",
        hints: ["rectangular area", "existing cracked concrete"],
      },
      quality: { issues: [], missing_photo_prompts: [] },
      confidence: 0.82,
    },
  };
  return mocksByNiche[niche] || mocksByNiche.fencing;
}
