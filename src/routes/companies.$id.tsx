import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { TargetServiceConfig } from "@/components/TargetServiceConfig";
import { fetchCompanyDetail, potentialBg } from "@/lib/radar";
import { scoreCompany } from "@/lib/api/scoring.functions";
import { getTargetService } from "@/lib/target-service";
import { ArrowLeft, ExternalLink, Globe, MapPin, Sparkles, Target, Lightbulb, RefreshCw, Zap } from "lucide-react";
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from "recharts";
import { toast } from "sonner";

export const Route = createFileRoute("/companies/$id")({
  head: () => ({
    meta: [
      { title: "Company — Opportunity Radar" },
    ],
  }),
  component: CompanyDetailPage,
});

const SIGNAL_ICONS: Record<string, string> = {
  Funding: "💰",
  Hiring: "👥",
  "Product Launch": "🚀",
  Partnership: "🤝",
  "Technology Adoption": "⚙️",
  Expansion: "🌍",
  "Leadership Change": "👤",
};

function CompanyDetailPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const [scoring, setScoring] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["company", id],
    queryFn: () => fetchCompanyDetail(id),
  });

  async function handleRescore() {
    setScoring(true);
    try {
      const result = await scoreCompany({
        data: { companyId: id, targetService: getTargetService() },
      });
      await queryClient.invalidateQueries({ queryKey: ["company", id] });
      await queryClient.invalidateQueries({ queryKey: ["companies-with-scores"] });
      toast.success(`Scored ${result.opportunity_score}/100 (${result.business_potential} potential)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Scoring failed");
    } finally {
      setScoring(false);
    }
  }

  if (isLoading || !data?.company) {
    return <AppShell><div className="text-muted-foreground">Loading…</div></AppShell>;
  }
  const { company, signals, score, notes, activity } = data;
  const scoreValue = score?.opportunity_score ?? 0;
  const keySignals = (score?.key_signals ?? []) as string[];
  const gaugeData = [{ name: "score", value: scoreValue, fill: "var(--color-primary)" }];
  const hasScore = Boolean(score?.ai_reason);

  return (
    <AppShell>
      <div className="space-y-6">
        <Link to="/companies" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to companies
        </Link>

        <TargetServiceConfig />

        {/* Profile header */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)] flex flex-col md:flex-row gap-6">
          <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground flex items-center justify-center font-display font-bold text-2xl shadow-[var(--shadow-elevated)]">
            {company.company_name.slice(0, 1)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-2xl font-semibold">{company.company_name}</h1>
              <span className={`text-xs font-semibold px-2 py-1 rounded-md border ${potentialBg(score?.business_potential)}`}>
                {score?.business_potential ?? "Unscored"} potential
              </span>
            </div>
            <p className="mt-2 text-muted-foreground">{company.description}</p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Target className="h-4 w-4" /> {company.industry}</span>
              {company.location && <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {company.location}</span>}
              {company.website && (
                <a href={`https://${company.website}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-primary hover:underline">
                  <Globe className="h-4 w-4" /> {company.website} <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
          <button
            onClick={handleRescore}
            disabled={scoring}
            className="inline-flex items-center gap-2 self-start rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 shadow-[var(--shadow-elevated)] disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${scoring ? "animate-spin" : ""}`} />
            {scoring ? "Analyzing…" : hasScore ? "Re-analyze" : "Analyze with AI"}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Score gauge */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
            <h3 className="font-display text-lg font-semibold">Opportunity Score</h3>
            <ResponsiveContainer width="100%" height={220}>
              <RadialBarChart innerRadius="70%" outerRadius="100%" data={gaugeData} startAngle={90} endAngle={-270}>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar background={{ fill: "var(--color-muted)" }} dataKey="value" cornerRadius={20} />
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground" style={{ fontSize: 40, fontWeight: 700, fontFamily: "Space Grotesk" }}>
                  {scoreValue}
                </text>
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="text-center text-sm text-muted-foreground -mt-2">out of 100</div>
            {score?.scored_at && (
              <div className="mt-2 text-center text-xs text-muted-foreground">
                Last analyzed {new Date(score.scored_at).toLocaleString()}
              </div>
            )}
          </div>

          {/* AI analysis */}
          <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="font-display text-lg font-semibold">Why This Company?</h3>
            </div>
            {hasScore ? (
              <>
                <p className="text-sm leading-relaxed text-foreground">{score?.ai_reason}</p>
                {keySignals.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center gap-2 text-sm font-semibold mb-2">
                      <Zap className="h-4 w-4 text-warning" /> Key Signals Detected
                    </div>
                    <ul className="space-y-1.5">
                      {keySignals.map((signal, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                          {signal}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-primary mb-1">
                    <Lightbulb className="h-4 w-4" /> Recommended Action
                  </div>
                  <p className="text-sm">{score?.recommended_action}</p>
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
                <Sparkles className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No AI analysis yet. Click &quot;Analyze with AI&quot; to score this company against your target service.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Signals timeline */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <h3 className="font-display text-lg font-semibold mb-4">Raw Signal Timeline</h3>
          <ol className="relative border-l-2 border-border ml-2 space-y-4">
            {signals.map((s) => (
              <li key={s.id} className="pl-5 relative">
                <div className="absolute -left-[10px] top-1 h-4 w-4 rounded-full bg-primary border-4 border-card" />
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-lg leading-none">{SIGNAL_ICONS[s.signal_type] ?? "📡"}</span>
                  <span className="font-medium">{s.signal_title}</span>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground">{s.signal_type}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{new Date(s.detected_date).toLocaleDateString()}</span>
                </div>
                {s.description && <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>}
              </li>
            ))}
            {signals.length === 0 && <li className="text-sm text-muted-foreground">No signals yet.</li>}
          </ol>
        </div>

        {/* Notes & Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
            <h3 className="font-display text-lg font-semibold mb-3">Notes</h3>
            <ul className="space-y-2">
              {notes.map((n: { id: string; note: string; created_at: string }) => (
                <li key={n.id} className="rounded-lg border border-border bg-background p-3 text-sm">
                  {n.note}
                  <div className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleDateString()}</div>
                </li>
              ))}
              {notes.length === 0 && <li className="text-sm text-muted-foreground">No notes yet.</li>}
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
            <h3 className="font-display text-lg font-semibold mb-3">Activity History</h3>
            <ul className="space-y-3">
              {activity.map((a: { id: string; action: string; timestamp: string }) => (
                <li key={a.id} className="flex items-start gap-3 text-sm">
                  <div className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                  <div>
                    <div className="font-medium">{a.action}</div>
                    <div className="text-xs text-muted-foreground">{new Date(a.timestamp).toLocaleDateString()}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
