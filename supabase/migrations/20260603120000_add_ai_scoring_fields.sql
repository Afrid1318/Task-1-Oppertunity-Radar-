-- AI scoring enhancements: key signals summary and scoring metadata
ALTER TABLE public.opportunity_scores
  ADD COLUMN IF NOT EXISTS key_signals jsonb,
  ADD COLUMN IF NOT EXISTS model_version text,
  ADD COLUMN IF NOT EXISTS scored_at timestamptz DEFAULT now();
