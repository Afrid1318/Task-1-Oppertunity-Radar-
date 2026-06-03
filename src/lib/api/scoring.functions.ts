import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { analyzeCompany } from "../ai/scoring.server";
import { getServerConfig } from "../config.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const targetServiceSchema = z.string().min(3).max(500).optional();

async function runCompanyScoring(companyId: string, targetService?: string) {
  const config = getServerConfig();
  const service = targetService ?? config.targetService;

  const [{ data: company, error: companyError }, { data: signals, error: signalsError }] =
    await Promise.all([
      supabaseAdmin.from("companies").select("*").eq("id", companyId).single(),
      supabaseAdmin
        .from("signals")
        .select("*")
        .eq("company_id", companyId)
        .order("detected_date", { ascending: false }),
    ]);

  if (companyError || !company) {
    throw new Error(companyError?.message ?? "Company not found");
  }
  if (signalsError) throw new Error(signalsError.message);

  const result = await analyzeCompany(
    {
      company_name: company.company_name,
      industry: company.industry,
      website: company.website,
      location: company.location,
      description: company.description,
    },
    (signals ?? []).map((s) => ({
      signal_type: s.signal_type,
      signal_title: s.signal_title,
      description: s.description,
      signal_weight: s.signal_weight,
      detected_date: s.detected_date,
    })),
    {
      targetService: service,
      openaiApiKey: config.openaiApiKey,
      openaiModel: config.openaiModel,
    },
  );

  const { error: upsertError } = await supabaseAdmin.from("opportunity_scores").upsert(
    {
      company_id: companyId,
      opportunity_score: result.opportunity_score,
      business_potential: result.business_potential,
      ai_reason: result.ai_reason,
      key_signals: result.key_signals,
      recommended_action: result.recommended_action,
      scored_at: new Date().toISOString(),
      model_version: result.source === "ai" ? config.openaiModel ?? "gpt-4o-mini" : "heuristic-v1",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "company_id" },
  );

  if (upsertError) throw new Error(upsertError.message);

  await supabaseAdmin.from("activity_logs").insert({
    company_id: companyId,
    action: `AI scored opportunity (${result.opportunity_score}/100, ${result.business_potential} potential)`,
  });

  return { companyId, ...result };
}

export const scoreCompany = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      companyId: z.string().uuid(),
      targetService: targetServiceSchema,
    }),
  )
  .handler(async ({ data }) => runCompanyScoring(data.companyId, data.targetService));

export const scoreAllCompanies = createServerFn({ method: "POST" })
  .inputValidator(z.object({ targetService: targetServiceSchema }))
  .handler(async ({ data }) => {
    const config = getServerConfig();
    const service = data.targetService ?? config.targetService;

    const { data: companies, error } = await supabaseAdmin
      .from("companies")
      .select("id")
      .order("company_name");

    if (error) throw new Error(error.message);
    if (!companies?.length) return { scored: 0, results: [] };

    const results = [];
    for (const { id } of companies) {
      results.push(await runCompanyScoring(id, service));
    }

    return { scored: results.length, results };
  });
