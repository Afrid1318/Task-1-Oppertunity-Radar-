import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { TargetServiceConfig } from "@/components/TargetServiceConfig";
import { fetchCompaniesWithScores, potentialBg } from "@/lib/radar";
import { scoreAllCompanies } from "@/lib/api/scoring.functions";
import { getTargetService } from "@/lib/target-service";
import { Search, Plus, Upload, ArrowUpDown, Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/companies/")({
  head: () => ({
    meta: [
      { title: "Companies — Opportunity Radar" },
      { name: "description", content: "Searchable, filterable list of companies with AI opportunity scores." },
    ],
  }),
  component: CompaniesPage,
});

function CompaniesPage() {
  const queryClient = useQueryClient();
  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["companies-with-scores"],
    queryFn: fetchCompaniesWithScores,
  });

  const [q, setQ] = useState("");
  const search = useRouterState({ select: (s) => s.location.search });

  // Initialize search q from URL query param `q` when route changes
  useEffect(() => {
    try {
      const params = new URLSearchParams(search);
      const urlQ = params.get('q') ?? '';
      setQ(urlQ);
    } catch (err) {
      // ignore
    }
  }, [search]);
  const [potential, setPotential] = useState<string>("All");
  const [sort, setSort] = useState<"score" | "name">("score");
  const [scoringAll, setScoringAll] = useState(false);

  const industries = useMemo(() => ["All", ...new Set(companies.map(c => c.industry))], [companies]);
  const [industry, setIndustry] = useState("All");

  const unscoredCount = companies.filter(c => !c.score?.ai_reason).length;

  const filtered = useMemo(() => {
    let list = companies.filter(c => {
      const matchQ = !q || c.company_name.toLowerCase().includes(q.toLowerCase()) || c.industry.toLowerCase().includes(q.toLowerCase());
      const matchP = potential === "All" || c.score?.business_potential === potential;
      const matchI = industry === "All" || c.industry === industry;
      return matchQ && matchP && matchI;
    });
    list.sort((a, b) =>
      sort === "score"
        ? (b.score?.opportunity_score ?? 0) - (a.score?.opportunity_score ?? 0)
        : a.company_name.localeCompare(b.company_name)
    );
    return list;
  }, [companies, q, potential, industry, sort]);

  async function handleScoreAll() {
    setScoringAll(true);
    try {
      const result = await scoreAllCompanies({ data: { targetService: getTargetService() } });
      await queryClient.invalidateQueries({ queryKey: ["companies-with-scores"] });
      toast.success(`AI analyzed ${result.scored} companies`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Batch scoring failed");
    } finally {
      setScoringAll(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Companies</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {filtered.length} companies · AI ranks by likelihood to need your service
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleScoreAll}
              disabled={scoringAll || companies.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${scoringAll ? "animate-spin" : ""}`} />
              {scoringAll ? "Analyzing…" : unscoredCount > 0 ? `Analyze All (${unscoredCount} pending)` : "Re-analyze All"}
            </button>
            <button onClick={() => toast.info("CSV upload coming soon")} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-muted">
              <Upload className="h-4 w-4" /> Upload CSV
            </button>
            <button onClick={() => toast.info("Add Company form coming next")} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 shadow-[var(--shadow-elevated)]">
              <Plus className="h-4 w-4" /> Add Company
            </button>
          </div>
        </div>

        <TargetServiceConfig />

        {/* Filters */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)] flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search by company or industry…"
              className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <select value={industry} onChange={(e) => setIndustry(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm">
            {industries.map(i => <option key={i}>{i}</option>)}
          </select>
          <select value={potential} onChange={(e) => setPotential(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm">
            {["All","High","Medium","Low"].map(p => <option key={p}>{p}</option>)}
          </select>
          <button onClick={() => setSort(sort === "score" ? "name" : "score")} className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm">
            <ArrowUpDown className="h-4 w-4" /> {sort === "score" ? "By score" : "By name"}
          </button>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-[var(--shadow-card)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-5 py-3">Company</th>
                  <th className="text-left px-5 py-3">Industry</th>
                  <th className="text-left px-5 py-3">Score</th>
                  <th className="text-left px-5 py-3">Potential</th>
                  <th className="text-left px-5 py-3">Why (AI Reason)</th>
                  <th className="text-left px-5 py-3">Recommended Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">Loading…</td></tr>
                )}
                {!isLoading && filtered.map((c) => (
                  <tr key={c.id} className="border-t border-border hover:bg-muted/40">
                    <td className="px-5 py-3">
                      <Link to="/companies/$id" params={{ id: c.id }} target="_blank" rel="noreferrer" className="font-medium text-foreground hover:text-primary">
                        {c.company_name}
                      </Link>
                      <div className="text-xs text-muted-foreground">{c.location} · {c.signal_count} signals</div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{c.industry}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="font-display text-lg font-semibold">{c.score?.opportunity_score ?? "—"}</div>
                        {c.score?.opportunity_score != null && (
                          <div className="w-20 h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow" style={{ width: `${c.score.opportunity_score}%` }} />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-md border ${potentialBg(c.score?.business_potential)}`}>
                        {c.score?.business_potential ?? "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground max-w-xs">
                      {c.score?.ai_reason ? (
                        <span className="line-clamp-2" title={c.score.ai_reason}>{c.score.ai_reason}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-primary">
                          <Sparkles className="h-3 w-3" /> Not analyzed
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground max-w-xs truncate">{c.score?.recommended_action ?? "—"}</td>
                  </tr>
                ))}
                {!isLoading && filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">No companies match your filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
