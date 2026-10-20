-- Settings and backup integrity repair. Safe to run more than once.
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_user_id_key ON public.user_profiles (user_id);

-- Keep restore conflict handling deterministic for the workspace owner.
CREATE INDEX IF NOT EXISTS backups_user_created_idx ON public.backups (user_id, created_at DESC);
