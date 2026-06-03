import { supabase } from "@/integrations/supabase/client";

export type Company = {
  id: string;
  company_name: string;
  industry: string;
  website: string | null;
  location: string | null;
  description: string | null;
  created_at: string;
};

export type Signal = {
  id: string;
  company_id: string;
  signal_type: string;
  signal_title: string;
  description: string | null;
  source_url: string | null;
  detected_date: string;
  signal_weight: number;
};

export type Score = {
  id: string;
  company_id: string;
  opportunity_score: number;
  business_potential: "High" | "Medium" | "Low";
  ai_reason: string | null;
  key_signals: string[] | null;
  recommended_action: string | null;
  model_version: string | null;
  scored_at: string | null;
  updated_at: string;
};

export type CompanyWithScore = Company & {
  score: Score | null;
  signal_count: number;
};

export async function fetchCompaniesWithScores(): Promise<CompanyWithScore[]> {
  const [{ data: companies }, { data: scores }, { data: signals }] = await Promise.all([
    supabase.from("companies").select("*").order("company_name"),
    supabase.from("opportunity_scores").select("*"),
    supabase.from("signals").select("company_id"),
  ]);
  const scoreMap = new Map((scores ?? []).map((s: Record<string, unknown>) => [s.company_id, normalizeScore(s)]));
  const counts = new Map<string, number>();
  (signals ?? []).forEach((s: any) => counts.set(s.company_id, (counts.get(s.company_id) ?? 0) + 1));
  return (companies ?? []).map((c: any) => ({
    ...c,
    score: scoreMap.get(c.id) ?? null,
    signal_count: counts.get(c.id) ?? 0,
  })) as CompanyWithScore[];
}

export async function fetchCompanyDetail(id: string) {
  const [{ data: company }, { data: signals }, { data: scoreRows }, { data: notes }, { data: activity }] = await Promise.all([
    supabase.from("companies").select("*").eq("id", id).single(),
    supabase.from("signals").select("*").eq("company_id", id).order("detected_date", { ascending: false }),
    supabase.from("opportunity_scores").select("*").eq("company_id", id).limit(1),
    supabase.from("notes").select("*").eq("company_id", id).order("created_at", { ascending: false }),
    supabase.from("activity_logs").select("*").eq("company_id", id).order("timestamp", { ascending: false }),
  ]);
  return {
    company: company as Company | null,
    signals: (signals ?? []) as Signal[],
    score: scoreRows?.[0] ? normalizeScore(scoreRows[0]) : null,
    notes: notes ?? [],
    activity: activity ?? [],
  };
}

export function potentialColor(p: string | undefined | null) {
  if (p === "High") return "text-success";
  if (p === "Medium") return "text-warning";
  return "text-muted-foreground";
}
export function potentialBg(p: string | undefined | null) {
  if (p === "High") return "bg-success/10 text-success border-success/20";
  if (p === "Medium") return "bg-warning/10 text-warning border-warning/30";
  return "bg-muted text-muted-foreground border-border";
}

function normalizeScore(raw: Record<string, unknown>): Score {
  const keySignals = raw.key_signals;
  return {
    ...(raw as Score),
    key_signals: Array.isArray(keySignals)
      ? keySignals.filter((s): s is string => typeof s === "string")
      : null,
  };
}
