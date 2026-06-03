import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'node:path';

// Load .env from project root so users don't need to export env vars manually
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLEARBIT_API_KEY = process.env.CLEARBIT_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const defaultDomains = [
  'google.com',
  'microsoft.com',
  'apple.com',
  'amazon.com',
  'meta.com',
  'tesla.com',
  'ibm.com',
  'oracle.com',
  'salesforce.com',
  'adobe.com',
  'stripe.com',
  'shopify.com',
  'zoom.us',
  'slack.com',
  'notion.so',
  'asana.com',
  'trello.com',
  'twilio.com',
  'okta.com',
  'squareup.com',
  'hubspot.com',
  'zendesk.com',
  'workday.com',
  'servicenow.com',
  'atlassian.com',
  'snowflake.com',
  'datadoghq.com',
  'splunk.com',
  'mongodb.com',
  'elastic.co',
];

async function fetchClearbit(domain) {
  try {
    const res = await fetch(`https://company.clearbit.com/v2/companies/find?domain=${domain}`, {
      headers: { Authorization: `Bearer ${CLEARBIT_API_KEY}` },
    });
    if (!res.ok) return null;
    const j = await res.json();
    return {
      company_name: j.name || domain,
      industry: j.category?.industry || j.tags?.join(', ') || 'Unknown',
      website: j.domain || domain,
      location: j.location || `${j.geo?.city ?? ''} ${j.geo?.state ?? ''}`.trim() || null,
      description: j.description || null,
      logo_url: j.logo || null,
    };
  } catch (err) {
    console.warn('Clearbit fetch failed for', domain, err?.message ?? err);
    return null;
  }
}

async function fetchWithOpenAI(domain) {
  const system = `You are a helpful assistant that returns compact JSON with company profile fields: company_name, industry, website, location, description, logo_url. Respond ONLY with valid JSON.`;
  const user = `Provide a concise company profile for the company at domain: ${domain}. Return only JSON.`;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.0,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.warn('OpenAI call failed:', res.status, t.slice(0, 300));
      return null;
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    // Extract JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
    return {
      company_name: parsed.company_name || domain,
      industry: parsed.industry || 'Unknown',
      website: parsed.website || domain,
      location: parsed.location || null,
      description: parsed.description || null,
      logo_url: parsed.logo_url || null,
    };
  } catch (err) {
    console.warn('OpenAI enrichment failed for', domain, err?.message ?? err);
    return null;
  }
}

async function upsertCompany(profile) {
  if (!profile || !profile.company_name) return null;

  // Try to find by website first
  const website = profile.website || null;
  let existing = null;
  if (website) {
    const { data } = await supabase.from('companies').select('*').eq('website', website).limit(1).maybeSingle();
    existing = data;
  }

  if (existing && existing.id) {
    const { error } = await supabase.from('companies').update({
      company_name: profile.company_name,
      industry: profile.industry,
      location: profile.location,
      description: profile.description,
      logo_url: profile.logo_url,
      website: profile.website,
    }).eq('id', existing.id);
    if (error) throw error;
    return existing.id;
  }

  const { data, error } = await supabase.from('companies').insert({
    company_name: profile.company_name,
    industry: profile.industry || 'Unknown',
    website: profile.website || null,
    location: profile.location || null,
    description: profile.description || null,
    logo_url: profile.logo_url || null,
  }).select('id').single();
  if (error) throw error;
  return data.id;
}

async function insertSignal(companyId, domain) {
  const { error } = await supabase.from('signals').insert({
    company_id: companyId,
    signal_type: 'Profile Import',
    signal_title: `Imported profile for ${domain}`,
    description: 'Seeded by import script',
    source_url: null,
    signal_weight: 5,
  });
  if (error) console.warn('Failed to insert signal', error.message);
}

async function run(domains = defaultDomains) {
  console.log('Starting seeding for', domains.length, 'companies');
  for (const domain of domains) {
    console.log('Processing', domain);
    let profile = null;
    if (CLEARBIT_API_KEY) {
      profile = await fetchClearbit(domain);
      if (profile) console.log('Enriched via Clearbit:', profile.company_name);
    }
    if (!profile && OPENAI_API_KEY) {
      profile = await fetchWithOpenAI(domain);
      if (profile) console.log('Enriched via OpenAI:', profile.company_name);
    }
    if (!profile) {
      // Fallback minimal profile
      profile = { company_name: domain.split('.')[0].toUpperCase(), industry: 'Unknown', website: domain, location: null, description: null, logo_url: null };
      console.log('Using fallback profile for', domain);
    }

    try {
      const id = await upsertCompany(profile);
      console.log('Upserted company id=', id);
      await insertSignal(id, domain);
    } catch (err) {
      console.error('Failed to upsert for', domain, err?.message ?? err);
    }
  }
  console.log('Seeding complete');
}

if (process.argv[1] && process.argv[1].includes('seed_companies.mjs')) {
  const custom = process.argv.slice(2);
  run(custom.length ? custom : undefined).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
