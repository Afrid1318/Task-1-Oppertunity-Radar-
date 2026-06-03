import { z } from "zod";

export const scoringResultSchema = z.object({
  opportunity_score: z.number().min(0).max(100),
  business_potential: z.enum(["High", "Medium", "Low"]),
  ai_reason: z.string().min(1),
  key_signals: z.array(z.string()).min(1).max(6),
  recommended_action: z.string().min(1),
});

export type ScoringResult = z.infer<typeof scoringResultSchema>;

export type CompanyContext = {
  company_name: string;
  industry: string;
  website: string | null;
  location: string | null;
  description: string | null;
};

export type SignalContext = {
  signal_type: string;
  signal_title: string;
  description: string | null;
  signal_weight: number;
  detected_date: string;
};

const DEFAULT_TARGET_SERVICE =
  "B2B SaaS platform for sales automation, CRM integration, and lead intelligence";

const HIGH_VALUE_SIGNALS = new Set([
  "Funding",
  "Hiring",
  "Technology Adoption",
  "Expansion",
  "Product Launch",
]);

function scoreToPotential(score: number): ScoringResult["business_potential"] {
  if (score >= 70) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

function buildRecommendedAction(
  score: number,
  companyName: string,
  topSignal: SignalContext | undefined,
): string {
  if (score >= 70) {
    return `Schedule a discovery call with ${companyName} within 7 days — reference their recent ${topSignal?.signal_type?.toLowerCase() ?? "growth activity"} to open the conversation.`;
  }
  if (score >= 40) {
    return `Add ${companyName} to a nurture sequence and share a case study relevant to ${topSignal?.signal_type?.toLowerCase() ?? "their industry"} before requesting a meeting.`;
  }
  return `Monitor ${companyName} quarterly for new signals; no immediate outreach recommended until buying intent increases.`;
}

export function scoreHeuristically(
  company: CompanyContext,
  signals: SignalContext[],
  targetService: string,
): ScoringResult {
  const sorted = [...signals].sort((a, b) => b.signal_weight - a.signal_weight);
  const totalWeight = signals.reduce((sum, s) => sum + s.signal_weight, 0);
  const highValueCount = signals.filter((s) => HIGH_VALUE_SIGNALS.has(s.signal_type)).length;
  const recencyBoost = signals.filter((s) => {
    const days = (Date.now() - new Date(s.detected_date).getTime()) / (1000 * 60 * 60 * 24);
    return days <= 30;
  }).length;

  let raw =
    signals.length === 0
      ? 15
      : Math.round((totalWeight / Math.max(signals.length * 25, 1)) * 55 + signals.length * 4);
  raw += highValueCount * 6 + recencyBoost * 3;
  const opportunity_score = Math.min(100, Math.max(5, raw));
  const business_potential = scoreToPotential(opportunity_score);

  const key_signals =
    sorted.length > 0
      ? sorted.slice(0, 5).map((s) => `${s.signal_type}: ${s.signal_title}`)
      : [`No growth signals detected yet for ${company.company_name}`];

  const topTypes = [...new Set(sorted.slice(0, 3).map((s) => s.signal_type))].join(", ");
  const ai_reason =
    signals.length === 0
      ? `${company.company_name} (${company.industry}) shows no active buying signals yet. Without funding, hiring, or technology adoption events, fit for "${targetService}" remains unverified — revisit when new signals appear.`
      : `${company.company_name} in ${company.industry} shows ${signals.length} growth signal${signals.length === 1 ? "" : "s"} (${topTypes || "mixed activity"}), indicating potential need for ${targetService}. Weighted signal strength and recent activity suggest ${business_potential.toLowerCase()} likelihood of becoming a customer.`;

  return {
    opportunity_score,
    business_potential,
    ai_reason,
    key_signals,
    recommended_action: buildRecommendedAction(opportunity_score, company.company_name, sorted[0]),
  };
}

async function callOpenAI(
  apiKey: string,
  model: string,
  company: CompanyContext,
  signals: SignalContext[],
  targetService: string,
): Promise<ScoringResult> {
  const signalBlock =
    signals.length === 0
      ? "No signals detected yet."
      : signals
          .map(
            (s) =>
              `- [${s.signal_type}] ${s.signal_title} (weight: ${s.signal_weight}, date: ${s.detected_date})${s.description ? `: ${s.description}` : ""}`,
          )
          .join("\n");

  const systemPrompt = `You are a B2B sales intelligence analyst. Evaluate whether a company is likely to need a specific product or service based on their profile and detected growth signals.

Respond ONLY with valid JSON matching this schema:
{
  "opportunity_score": number (0-100),
  "business_potential": "High" | "Medium" | "Low",
  "ai_reason": string (2-4 sentences explaining WHY this company is or isn't a good fit),
  "key_signals": string[] (3-5 bullet points of the most important signals driving the score),
  "recommended_action": string (one concrete next step for the sales team)
}

Scoring guide:
- 70-100 High: Strong buying signals, act within 7 days
- 40-69 Medium: Emerging fit, nurture and monitor
- 0-39 Low: Weak fit or insufficient signals`;

  const userPrompt = `Target service/solution to evaluate fit for:
"${targetService}"

Company profile:
- Name: ${company.company_name}
- Industry: ${company.industry}
- Location: ${company.location ?? "Unknown"}
- Website: ${company.website ?? "N/A"}
- Description: ${company.description ?? "No description"}

Detected growth signals:
${signalBlock}

Analyze this company and return the JSON assessment.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${err.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from OpenAI");

  const parsed = scoringResultSchema.parse(JSON.parse(content));
  return parsed;
}

export async function analyzeCompany(
  company: CompanyContext,
  signals: SignalContext[],
  options: { targetService?: string; openaiApiKey?: string; openaiModel?: string } = {},
): Promise<ScoringResult & { source: "ai" | "heuristic" }> {
  const targetService = options.targetService?.trim() || DEFAULT_TARGET_SERVICE;

  if (options.openaiApiKey) {
    try {
      const result = await callOpenAI(
        options.openaiApiKey,
        options.openaiModel ?? "gpt-4o-mini",
        company,
        signals,
        targetService,
      );
      return { ...result, source: "ai" };
    } catch (err) {
      console.warn("[scoring] LLM failed, falling back to heuristic:", err);
    }
  }

  return { ...scoreHeuristically(company, signals, targetService), source: "heuristic" };
}
