-- =====================================================================
-- PROPDESK AFRICA — add-missing-columns migration
-- Run this on a database that already has the OLD schema deployed.
-- It is idempotent (uses ADD COLUMN IF NOT EXISTS).
-- =====================================================================

-- properties
ALTER TABLE public.properties
    ADD COLUMN IF NOT EXISTS size_sqft INTEGER,
    ADD COLUMN IF NOT EXISTS monthly_rent DECIMAL(12,2),
    ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(12,2),
    ADD COLUMN IF NOT EXISTS amenities TEXT[] DEFAULT '{}';

-- tenants
ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS first_name TEXT,
    ADD COLUMN IF NOT EXISTS last_name TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS monthly_rent DECIMAL(12,2);

-- rent_payments
ALTER TABLE public.rent_payments
    ADD COLUMN IF NOT EXISTS due_date DATE,
    ADD COLUMN IF NOT EXISTS paid_date DATE,
    ADD COLUMN IF NOT EXISTS late_fee DECIMAL(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS reference_number TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT;

-- expenses
ALTER TABLE public.expenses
    ADD COLUMN IF NOT EXISTS vendor TEXT,
    ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS recurring_frequency TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT;

-- maintenance_requests
ALTER TABLE public.maintenance_requests
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general';

-- documents
ALTER TABLE public.documents
    ADD COLUMN IF NOT EXISTS notes TEXT;

-- notes
ALTER TABLE public.notes
    ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal',
    ADD COLUMN IF NOT EXISTS title TEXT;

-- user_profiles
ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS first_name TEXT,
    ADD COLUMN IF NOT EXISTS last_name TEXT,
    ADD COLUMN IF NOT EXISTS notification_preferences JSONB;

-- relax the rent_payments.status check constraint so the new values
-- (paid / completed / late / partial) used by the form are accepted.
ALTER TABLE public.rent_payments DROP CONSTRAINT IF EXISTS rent_payments_status_check;
ALTER TABLE public.rent_payments
  ADD CONSTRAINT rent_payments_status_check
  CHECK (status IN ('pending', 'paid', 'completed', 'late', 'partial', 'failed', 'cancelled'));

-- documents storage bucket
-- CRYPTO-005 / INFRA-013: the bucket is PRIVATE. Objects are read through
-- short-lived signed URLs that the API only issues to the owner, so these
-- policies are enforced on reads as well as writes. `DO UPDATE` (not
-- `DO NOTHING`) so re-running this script flips an existing public bucket
-- to private — see audit/deliverable-storage-infra.md -> SECURITY ROLLOUT
-- NOTE for the required order of operations.
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Bucket settings only — no schema change. Mirrors 01-create-tables.sql.
UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'text/plain'
    ]::text[]
WHERE id = 'documents';

DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own documents"  ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;

CREATE POLICY "Users can upload their own documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documents'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Users can read their own documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Users can update their own documents" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'documents'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Users can delete their own documents" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'documents'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- updated_at triggers (only add if missing)
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY['properties','tenants','maintenance_requests','notes','user_profiles'])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t, t);
  END LOOP;
END$$;
