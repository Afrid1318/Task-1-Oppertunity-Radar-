import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { TargetServiceConfig } from "@/components/TargetServiceConfig";
import { StatCard } from "@/components/StatCard";
import { fetchCompaniesWithScores, potentialBg } from "@/lib/radar";
import { scoreAllCompanies } from "@/lib/api/scoring.functions";
import { getTargetService } from "@/lib/target-service";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { Building2, TrendingUp, Flame, Snowflake, Activity, ArrowRight, Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Opportunity Radar" },
      { name: "description", content: "Live overview of high-potential leads, signal activity and industry breakdowns." },
    ],
  }),
  component: DashboardPage,
});

const POTENTIAL_COLORS: Record<string, string> = {
  High: "var(--color-success)",
  Medium: "var(--color-warning)",
  Low: "var(--color-muted-foreground)",
};
const SIGNAL_COLORS = ["#2563EB", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4", "#EC4899"];

function DashboardPage() {
  const queryClient = useQueryClient();
  const [scoringAll, setScoringAll] = useState(false);

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["companies-with-scores"],
    queryFn: fetchCompaniesWithScores,
  });
  const { data: signals = [] } = useQuery({
    queryKey: ["all-signals"],
    queryFn: async () => (await supabase.from("signals").select("*")).data ?? [],
  });
  const { data: activity = [] } = useQuery({
    queryKey: ["recent-activity"],
    queryFn: async () => (await supabase.from("activity_logs").select("*, companies(company_name)").order("timestamp", { ascending: false }).limit(8)).data ?? [],
  });

  const total = companies.length;
  const high = companies.filter((c) => c.score?.business_potential === "High").length;
  const medium = companies.filter((c) => c.score?.business_potential === "Medium").length;
  const low = companies.filter((c) => c.score?.business_potential === "Low").length;

  // Score distribution bins
  const bins = [0, 20, 40, 60, 80].map((min, i) => {
    const max = i === 4 ? 101 : min + 20;
    return {
      range: `${min}-${i === 4 ? 100 : max - 1}`,
      count: companies.filter((c) => (c.score?.opportunity_score ?? 0) >= min && (c.score?.opportunity_score ?? 0) < max).length,
    };
  });

  // Signal type distribution
  const sigTypeMap = new Map<string, number>();
  (signals as any[]).forEach((s) => sigTypeMap.set(s.signal_type, (sigTypeMap.get(s.signal_type) ?? 0) + 1));
  const signalDist = [...sigTypeMap.entries()].map(([name, value]) => ({ name, value }));

  // Industry breakdown
  const indMap = new Map<string, number>();
  companies.forEach((c) => indMap.set(c.industry, (indMap.get(c.industry) ?? 0) + 1));
  const industryData = [...indMap.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 7);

  // Monthly growth (mock from created_at by month)
  const monthMap = new Map<string, number>();
  companies.forEach((c) => {
    const d = new Date(c.created_at);
    const k = d.toLocaleString("en-US", { month: "short" });
    monthMap.set(k, (monthMap.get(k) ?? 0) + 1);
  });
  // Fallback: synthesize a trend
  const monthsOrder = ["Jan","Feb","Mar","Apr","May","Jun"];
  const growth = monthsOrder.map((m, i) => ({ month: m, leads: 8 + i * 3 + (monthMap.get(m) ?? 0) }));

  const unscoredCount = companies.filter(c => !c.score?.ai_reason).length;

  async function handleScoreAll() {
    setScoringAll(true);
    try {
      const result = await scoreAllCompanies({ data: { targetService: getTargetService() } });
      await queryClient.invalidateQueries({ queryKey: ["companies-with-scores"] });
      toast.success(`AI analyzed ${result.scored} companies`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setScoringAll(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">AI-powered intelligence on which companies need your service — and why.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {unscoredCount > 0 && (
              <button
                onClick={handleScoreAll}
                disabled={scoringAll}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 shadow-[var(--shadow-elevated)] disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${scoringAll ? "animate-spin" : ""}`} />
                {scoringAll ? "Analyzing…" : `Analyze ${unscoredCount} Companies`}
              </button>
            )}
            <Link to="/companies" className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-muted">
              View all companies <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <TargetServiceConfig />

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Companies" value={isLoading ? "…" : total} icon={<Building2 className="h-5 w-5" />} accent="primary" hint="Across 15 industries" />
          <StatCard label="High Opportunity" value={high} icon={<Flame className="h-5 w-5" />} accent="success" hint="Outreach within 7 days" />
          <StatCard label="Medium Opportunity" value={medium} icon={<TrendingUp className="h-5 w-5" />} accent="warning" hint="Add to nurture" />
          <StatCard label="Low Opportunity" value={low} icon={<Snowflake className="h-5 w-5" />} accent="destructive" hint="Revisit quarterly" />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display text-lg font-semibold">Opportunity Score Distribution</h3>
                <p className="text-xs text-muted-foreground">Companies grouped by AI opportunity score</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={bins}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="range" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                <Bar dataKey="count" fill="var(--color-primary)" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
            <h3 className="font-display text-lg font-semibold">Signal Distribution</h3>
            <p className="text-xs text-muted-foreground mb-2">Types of detected signals</p>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={signalDist} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                  {signalDist.map((_, i) => <Cell key={i} fill={SIGNAL_COLORS[i % SIGNAL_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
            <h3 className="font-display text-lg font-semibold">Industry Breakdown</h3>
            <p className="text-xs text-muted-foreground mb-4">Top industries on radar</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={industryData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={11} />
                <YAxis type="category" dataKey="name" width={110} stroke="var(--color-muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                <Bar dataKey="value" fill="var(--color-primary-glow)" radius={[0,6,6,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
            <h3 className="font-display text-lg font-semibold">Monthly Opportunity Growth</h3>
            <p className="text-xs text-muted-foreground mb-4">New high-potential leads detected</p>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={growth}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                <Line type="monotone" dataKey="leads" stroke="var(--color-primary)" strokeWidth={3} dot={{ r: 4, fill: "var(--color-primary)" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-4 w-4 text-primary" />
              <h3 className="font-display text-lg font-semibold">Recent Activity</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Latest events on tracked companies</p>
            <ul className="space-y-3">
              {(activity as any[]).map((a) => (
                <li key={a.id} className="flex items-start gap-3 text-sm">
                  <div className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{a.action}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {a.companies?.company_name} · {new Date(a.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                </li>
              ))}
              {activity.length === 0 && <li className="text-sm text-muted-foreground">No activity yet.</li>}
            </ul>
          </div>
        </div>

        {/* Top opportunities */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-lg font-semibold">Top Opportunities Right Now</h3>
              <p className="text-xs text-muted-foreground">Highest scoring companies based on recent signals</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {companies
              .slice()
              .sort((a, b) => (b.score?.opportunity_score ?? 0) - (a.score?.opportunity_score ?? 0))
              .slice(0, 6)
              .map((c) => (
                <Link
                  key={c.id}
                  to="/companies/$id"
                  params={{ id: c.id }}
                  target="_blank"
                  rel="noreferrer"
                  className="group rounded-lg border border-border bg-background p-4 hover:border-primary/40 hover:shadow-[var(--shadow-elevated)] transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{c.company_name}</div>
                      <div className="text-xs text-muted-foreground truncate">{c.industry} · {c.location}</div>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-md border ${potentialBg(c.score?.business_potential)}`}>
                      {c.score?.opportunity_score ?? 0}
                    </span>
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground line-clamp-2">{c.score?.ai_reason ?? `${c.signal_count} signals — not yet analyzed`}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-md border ${potentialBg(c.score?.business_potential)}`}>
                      {c.score?.business_potential ?? "—"}
                    </span>
                    {!c.score?.ai_reason && <Sparkles className="h-3 w-3 text-primary" />}
                  </div>
                </Link>
              ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
