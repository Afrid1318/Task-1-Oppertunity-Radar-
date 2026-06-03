
-- Companies
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  industry text NOT NULL,
  website text,
  location text,
  description text,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  signal_type text NOT NULL,
  signal_title text NOT NULL,
  description text,
  source_url text,
  detected_date timestamptz NOT NULL DEFAULT now(),
  signal_weight int NOT NULL DEFAULT 10
);

CREATE TABLE public.opportunity_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  opportunity_score int NOT NULL,
  business_potential text NOT NULL,
  ai_reason text,
  recommended_action text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  action text NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_signals_company ON public.signals(company_id);
CREATE INDEX idx_scores_company ON public.opportunity_scores(company_id);
CREATE INDEX idx_notes_company ON public.notes(company_id);
CREATE INDEX idx_activity_company ON public.activity_logs(company_id);

-- Grants
GRANT SELECT ON public.companies, public.signals, public.opportunity_scores, public.notes, public.activity_logs TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.companies, public.signals, public.opportunity_scores, public.notes, public.activity_logs TO authenticated;
GRANT ALL ON public.companies, public.signals, public.opportunity_scores, public.notes, public.activity_logs TO service_role;

-- RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read companies" ON public.companies FOR SELECT USING (true);
CREATE POLICY "Auth insert companies" ON public.companies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update companies" ON public.companies FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete companies" ON public.companies FOR DELETE TO authenticated USING (true);

CREATE POLICY "Public read signals" ON public.signals FOR SELECT USING (true);
CREATE POLICY "Auth write signals" ON public.signals FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public read scores" ON public.opportunity_scores FOR SELECT USING (true);
CREATE POLICY "Auth write scores" ON public.opportunity_scores FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public read notes" ON public.notes FOR SELECT USING (true);
CREATE POLICY "Auth write notes" ON public.notes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public read activity" ON public.activity_logs FOR SELECT USING (true);
CREATE POLICY "Auth write activity" ON public.activity_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
