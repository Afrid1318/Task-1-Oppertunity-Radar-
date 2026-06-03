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

const HIRING_KEYWORDS = ['careers', 'jobs', 'we are hiring', 'join our team', 'open positions', 'hiring now'];
const LAUNCH_KEYWORDS = ['press', 'press release', 'we launched', 'launch', 'announc', 'new product'];

function normalizeWebsite(website) {
  if (!website) return null;
  let url = website.trim();
  if (!url.startsWith('http')) url = `https://${url}`;
  try {
    return new URL(url).origin;
  } catch (err) {
    return null;
  }
}

async function fetchText(url, timeout = 10000) {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) return null;
    const text = await res.text();
    return text;
  } catch (err) {
    return null;
  }
}

async function checkGitHubActivity(org) {
  try {
    const res = await fetch(`https://api.github.com/orgs/${org}`);
    if (!res.ok) return null;
    const j = await res.json();
    const reposRes = await fetch(j.repos_url + '?per_page=5');
    if (!reposRes.ok) return { public_repos: j.public_repos || 0 };
    const repos = await reposRes.json();
    const recent = repos.some(r => {
      const pushed = r.pushed_at ? new Date(r.pushed_at) : null;
      if (!pushed) return false;
      const days = (Date.now() - pushed.getTime()) / (1000 * 60 * 60 * 24);
      return days <= 90;
    });
    return { public_repos: j.public_repos || 0, recent_activity: recent };
  } catch (err) {
    return null;
  }
}

async function insertSignal(companyId, type, title, description = null, weight = 10) {
  try {
    const { error } = await supabase.from('signals').insert({
      company_id: companyId,
      signal_type: type,
      signal_title: title,
      description,
      detected_date: new Date().toISOString(),
      signal_weight: weight,
    });
    if (error) console.warn('Insert signal error:', error.message);
  } catch (err) {
    console.warn('Insert signal failed:', err?.message ?? err);
  }
}

async function run() {
  console.log('Fetching companies from DB...');
  const { data: companies, error } = await supabase.from('companies').select('*');
  if (error) {
    console.error('Failed to fetch companies:', error.message);
    process.exit(1);
  }
  console.log('Found', companies.length, 'companies');

  for (const c of companies) {
    const origin = normalizeWebsite(c.website);
    if (!origin) continue;
    console.log('Checking', c.company_name, origin);

    const homepage = await fetchText(origin);
    if (homepage) {
      const lower = homepage.toLowerCase();
      if (HIRING_KEYWORDS.some(k => lower.includes(k))) {
        await insertSignal(c.id, 'Hiring', 'Hiring activity detected on website', null, 20);
        console.log('  -> Hiring signal');
      }
      if (LAUNCH_KEYWORDS.some(k => lower.includes(k))) {
        await insertSignal(c.id, 'Product Launch', 'Product or press mentions detected', null, 15);
        console.log('  -> Product Launch signal');
      }
      // look for careers/jobs links
      const careerLink = /href=["']([^"']*(career|careers|job|jobs)[^"']*)["']/i.exec(homepage);
      if (careerLink) {
        await insertSignal(c.id, 'Hiring', `Found careers link: ${careerLink[1]}`, careerLink[1], 12);
      }
    }

    // Try GitHub org derived from domain (take first segment)
    try {
      const host = new URL(origin).hostname;
      const org = host.split('.').slice(-2, -1)[0];
      if (org) {
        const gh = await checkGitHubActivity(org);
        if (gh && gh.public_repos > 0) {
          const title = gh.recent_activity ? 'Active GitHub development' : 'Public GitHub repos';
          const weight = gh.recent_activity ? 18 : 8;
          await insertSignal(c.id, 'Technology Adoption', title, `public_repos=${gh.public_repos}`, weight);
          console.log('  -> GitHub signal', title);
        }
      }
    } catch (err) {
      // ignore
    }
  }

  console.log('Signal detection complete');
}

if (process.argv[1] && process.argv[1].includes('detect_signals.mjs')) {
  run().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
