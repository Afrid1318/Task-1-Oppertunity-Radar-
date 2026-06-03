import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { TargetServiceConfig } from "@/components/TargetServiceConfig";
import { fetchCompaniesWithScores, potentialBg } from "@/lib/radar";
import { Flame, TrendingUp, Building2, Zap } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "AI Insights — Opportunity Radar" },
      { name: "description", content: "AI-curated views: top growth companies, emerging opportunities, hottest industries and urgent outreach." },
    ],
  }),
  component: InsightsPage,
});

type CompanyItem = Awaited<ReturnType<typeof fetchCompaniesWithScores>>[number];

function InsightsPage() {
  const { data: companies = [] } = useQuery({
    queryKey: ["companies-with-scores"],
    queryFn: fetchCompaniesWithScores,
  });

  const scored = companies.filter(c => c.score?.ai_reason);
  const sortedByScore = [...scored].sort((a, b) => (b.score?.opportunity_score ?? 0) - (a.score?.opportunity_score ?? 0));
  const top = sortedByScore.slice(0, 5);
  const emerging = [...scored]
    .filter(c => (c.score?.opportunity_score ?? 0) >= 40 && (c.score?.opportunity_score ?? 0) < 70)
    .slice(0, 5);
  const urgent = sortedByScore.filter(c => (c.score?.opportunity_score ?? 0) >= 70).slice(0, 5);

  const indMap = new Map<string, { sum: number; count: number }>();
  scored.forEach(c => {
    const e = indMap.get(c.industry) ?? { sum: 0, count: 0 };
    e.sum += c.score?.opportunity_score ?? 0;
    e.count += 1;
    indMap.set(c.industry, e);
  });
  const industries = [...indMap.entries()]
    .map(([name, v]) => ({ name, avg: Math.round(v.sum / v.count) }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 8);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">AI Insights</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Which companies are most likely to become customers — and why.
          </p>
        </div>

        <TargetServiceConfig />

        {scored.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
            <p className="text-muted-foreground">No AI analysis yet. Go to Companies and click &quot;Analyze All&quot; to generate insights.</p>
            <Link to="/companies" className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
              Analyze companies
            </Link>
          </div>
        ) : (
          <>
            <Section icon={<Flame className="h-5 w-5 text-success" />} title="Top Growth Companies" subtitle="Highest opportunity scores — most likely to buy">
              <Grid items={top} />
            </Section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Section icon={<Zap className="h-5 w-5 text-destructive" />} title="Needs Immediate Outreach" subtitle="Score 70+ — contact decision makers within 7 days">
                <CompactList items={urgent} />
              </Section>
              <Section icon={<TrendingUp className="h-5 w-5 text-warning" />} title="Emerging Opportunities" subtitle="Score 40–69 — nurture and monitor">
                <CompactList items={emerging} />
              </Section>
            </div>

            <Section icon={<Building2 className="h-5 w-5 text-primary" />} title="Industries with Highest Potential" subtitle="Average AI opportunity score per industry">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={industries} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis type="number" domain={[0, 100]} stroke="var(--color-muted-foreground)" fontSize={12} />
                    <YAxis type="category" dataKey="name" width={140} stroke="var(--color-muted-foreground)" fontSize={12} />
                    <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                    <Bar dataKey="avg" fill="var(--color-primary)" radius={[0,6,6,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Section({ icon, title, subtitle, children }: { icon: ReactNode; title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2 mb-1">{icon}<h3 className="font-display text-lg font-semibold">{title}</h3></div>
      <p className="text-xs text-muted-foreground mb-4">{subtitle}</p>
      {children}
    </div>
  );
}

function Grid({ items }: { items: CompanyItem[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
      {items.map((c) => (
        <Link key={c.id} to="/companies/$id" params={{ id: c.id }} target="_blank" rel="noreferrer" className="rounded-lg border border-border bg-background p-4 hover:border-primary/40 hover:shadow-[var(--shadow-elevated)] transition-all">
          <div className="font-display text-2xl font-semibold text-primary">{c.score?.opportunity_score ?? 0}</div>
          <div className="mt-1 font-medium truncate">{c.company_name}</div>
          <div className="text-xs text-muted-foreground truncate">{c.industry}</div>
          <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{c.score?.ai_reason}</p>
          <span className={`mt-3 inline-block text-xs font-semibold px-2 py-0.5 rounded-md border ${potentialBg(c.score?.business_potential)}`}>
            {c.score?.business_potential}
          </span>
        </Link>
      ))}
    </div>
  );
}

function CompactList({ items }: { items: CompanyItem[] }) {
  return (
    <ul className="space-y-2">
      {items.map((c) => (
        <li key={c.id}>
          <Link to="/companies/$id" params={{ id: c.id }} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg border border-border bg-background p-3 hover:border-primary/40">
            <div className="font-display text-lg font-semibold w-10 text-primary">{c.score?.opportunity_score ?? 0}</div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{c.company_name}</div>
              <div className="text-xs text-muted-foreground line-clamp-1">{c.score?.ai_reason}</div>
            </div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border shrink-0 ${potentialBg(c.score?.business_potential)}`}>
              {c.score?.business_potential}
            </span>
          </Link>
        </li>
      ))}
      {items.length === 0 && <li className="text-sm text-muted-foreground">Nothing here yet.</li>}
    </ul>
  );
}
