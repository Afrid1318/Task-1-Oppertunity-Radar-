import dotenv from 'dotenv';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const HIGH_VALUE_SIGNALS = new Set(['Funding', 'Hiring', 'Technology Adoption', 'Expansion', 'Product Launch']);

function scoreToPotential(score) {
  if (score >= 70) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
}

function buildRecommendedAction(score, companyName, topSignal) {
  if (score >= 70) {
    return `Schedule a discovery call with ${companyName} within 7 days — reference their recent ${topSignal?.signal_type?.toLowerCase() ?? 'growth activity'}.`;
  }
  if (score >= 40) {
    return `Add ${companyName} to a nurture sequence and share a relevant case study before requesting a meeting.`;
  }
  return `Monitor ${companyName} quarterly for new signals; no immediate outreach recommended.`;
}

function scoreHeuristically(company, signals, targetService) {
  const sorted = [...signals].sort((a, b) => b.signal_weight - a.signal_weight);
  const totalWeight = signals.reduce((sum, s) => sum + (s.signal_weight || 0), 0);
  const highValueCount = signals.filter((s) => HIGH_VALUE_SIGNALS.has(s.signal_type)).length;
  const recencyBoost = signals.filter((s) => {
    const days = (Date.now() - new Date(s.detected_date).getTime()) / (1000 * 60 * 60 * 24);
    return days <= 30;
  }).length;

  let raw = signals.length === 0 ? 15 : Math.round((totalWeight / Math.max(signals.length * 25, 1)) * 55 + signals.length * 4);
  raw += highValueCount * 6 + recencyBoost * 3;
  const opportunity_score = Math.min(100, Math.max(5, raw));
  const business_potential = scoreToPotential(opportunity_score);

  const key_signals = sorted.length > 0 ? sorted.slice(0, 5).map((s) => `${s.signal_type}: ${s.signal_title}`) : [`No growth signals detected yet for ${company.company_name}`];

  return {
    opportunity_score,
    business_potential,
    ai_reason: signals.length === 0
      ? `${company.company_name} (${company.industry}) shows no active buying signals yet.`
      : `${company.company_name} in ${company.industry} shows ${signals.length} growth signal(s).`,
    key_signals,
    recommended_action: buildRecommendedAction(opportunity_score, company.company_name, sorted[0]),
  };
}

async function run() {
  console.log('Fetching companies...');
  const { data: companies, error: cErr } = await supabase.from('companies').select('*');
  if (cErr) { console.error(cErr.message); process.exit(1); }

  for (const comp of companies) {
    const { data: signals } = await supabase.from('signals').select('*').eq('company_id', comp.id);
    const result = scoreHeuristically(comp, signals || [], process.env.TARGET_SERVICE || 'Target Service');

    const { error: upsertError } = await supabase.from('opportunity_scores').upsert({
      company_id: comp.id,
      opportunity_score: result.opportunity_score,
      business_potential: result.business_potential,
      ai_reason: result.ai_reason,
      key_signals: result.key_signals,
      recommended_action: result.recommended_action,
      scored_at: new Date().toISOString(),
      model_version: 'heuristic-v1',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'company_id' });

    if (upsertError) console.warn('Upsert score error for', comp.company_name, upsertError.message);
    else console.log('Scored', comp.company_name, result.opportunity_score);
  }

  console.log('Scoring complete');
}

if (process.argv[1] && process.argv[1].includes('score_all.mjs')) {
  run().catch(err => { console.error(err); process.exit(1); });
}
