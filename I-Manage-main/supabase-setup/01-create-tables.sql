-- =====================================================================
-- RENTARO — Supabase database setup (consolidated)
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- =====================================================================
-- Idempotent: safe to re-run. Each CREATE uses IF NOT EXISTS and each
-- ALTER uses ADD COLUMN IF NOT EXISTS so you can run it on a fresh
-- project OR on an already-deployed project to bring the schema up to
-- date.
-- =====================================================================

-- Required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enable Row Level Security globally
ALTER DATABASE postgres SET row_security = on;

-- =====================================================================
-- 1.  PROPERTIES
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.properties (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    county TEXT NOT NULL,
    -- 'type' is the canonical column; the form also sends 'property_type' which the API maps here.
    type TEXT NOT NULL CHECK (type IN ('apartment', 'house', 'maisonette', 'bedsitter', 'studio', 'commercial', 'land', 'other')),
    bedrooms INTEGER,
    bathrooms NUMERIC(3,1),
    rent_amount DECIMAL(12,2) NOT NULL,
    monthly_rent DECIMAL(12,2) GENERATED ALWAYS AS (rent_amount) STORED,
    deposit_amount DECIMAL(12,2),
    size_sqft INTEGER,
    status TEXT DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'vacant')),
    description TEXT,
    amenities TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.properties
    ADD COLUMN IF NOT EXISTS size_sqft INTEGER,
    ADD COLUMN IF NOT EXISTS monthly_rent DECIMAL(12,2),
    ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(12,2),
    ADD COLUMN IF NOT EXISTS amenities TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_properties_user_id ON public.properties(user_id);
CREATE INDEX IF NOT EXISTS idx_properties_status ON public.properties(status);

-- =====================================================================
-- 2.  TENANTS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT NOT NULL,
    national_id TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    lease_start_date DATE,
    lease_end_date DATE,
    monthly_rent DECIMAL(12,2),
    deposit_amount DECIMAL(12,2),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS first_name TEXT,
    ADD COLUMN IF NOT EXISTS last_name TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS monthly_rent DECIMAL(12,2);

CREATE INDEX IF NOT EXISTS idx_tenants_user_id ON public.tenants(user_id);
CREATE INDEX IF NOT EXISTS idx_tenants_property_id ON public.tenants(property_id);

-- =====================================================================
-- 3.  RENT PAYMENTS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.rent_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    -- 'due_date' is the date the rent falls due; 'paid_date' is when it was actually paid.
    -- 'payment_date' is kept for back-compat with the docs / earlier code.
    due_date DATE,
    paid_date DATE,
    payment_date DATE,
    payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'bank_transfer', 'mpesa', 'airtel_money', 'cheque', 'other')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'completed', 'late', 'partial', 'failed', 'cancelled')),
    late_fee DECIMAL(12,2) DEFAULT 0,
    reference_number TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.rent_payments
    ADD COLUMN IF NOT EXISTS due_date DATE,
    ADD COLUMN IF NOT EXISTS paid_date DATE,
    ADD COLUMN IF NOT EXISTS late_fee DECIMAL(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS reference_number TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_rent_payments_user_id ON public.rent_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_rent_payments_tenant_id ON public.rent_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rent_payments_due_date ON public.rent_payments(due_date);

-- =====================================================================
-- 4.  EXPENSES
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
    category TEXT NOT NULL CHECK (category IN ('maintenance', 'utilities', 'insurance', 'taxes', 'management', 'marketing', 'legal', 'security', 'cleaning', 'repairs', 'supplies', 'travel', 'other')),
    amount DECIMAL(12,2) NOT NULL,
    description TEXT NOT NULL,
    expense_date DATE NOT NULL,
    vendor TEXT,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurring_frequency TEXT CHECK (recurring_frequency IN ('monthly', 'quarterly', 'yearly')),
    receipt_url TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.expenses
    ADD COLUMN IF NOT EXISTS vendor TEXT,
    ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS recurring_frequency TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON public.expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON public.expenses(expense_date);

-- =====================================================================
-- 5.  MAINTENANCE REQUESTS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.maintenance_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'plumbing', 'electrical', 'hvac', 'appliances', 'structural', 'pest_control', 'security', 'cleaning', 'repairs', 'painting', 'roofing', 'flooring', 'windows_doors', 'landscaping', 'other')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
    contractor_name TEXT,
    contractor_phone TEXT,
    estimated_cost DECIMAL(12,2),
    actual_cost DECIMAL(12,2),
    scheduled_date DATE,
    completed_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.maintenance_requests
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general';

CREATE INDEX IF NOT EXISTS idx_maintenance_requests_user_id ON public.maintenance_requests(user_id);

-- =====================================================================
-- 6.  DOCUMENTS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('lease', 'insurance', 'inspection', 'receipt', 'photo', 'contract', 'legal', 'certificate', 'other')),
    file_url TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.documents
    ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);

-- =====================================================================
-- 7.  NOTES
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    title TEXT,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'general' CHECK (category IN ('general', 'important', 'reminder', 'maintenance', 'tenant', 'financial', 'legal')),
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.notes
    ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal',
    ADD COLUMN IF NOT EXISTS title TEXT;

CREATE INDEX IF NOT EXISTS idx_notes_user_id ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_is_pinned ON public.notes(is_pinned);

-- =====================================================================
-- 8.  USER PROFILES
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT,
    first_name TEXT,
    last_name TEXT,
    company_name TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    county TEXT,
    timezone TEXT DEFAULT 'Africa/Nairobi',
    currency TEXT DEFAULT 'KES',
    date_format TEXT DEFAULT 'DD/MM/YYYY',
    notification_preferences JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS first_name TEXT,
    ADD COLUMN IF NOT EXISTS last_name TEXT,
    ADD COLUMN IF NOT EXISTS notification_preferences JSONB;

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);

-- =====================================================================
-- 9.  ROW-LEVEL SECURITY
-- =====================================================================
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rent_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY['properties','tenants','rent_payments','expenses','maintenance_requests','documents','notes','user_profiles'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Users can view their own %I" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Users can insert their own %I" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Users can update their own %I" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Users can delete their own %I" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "Users can view their own %I" ON public.%I FOR SELECT USING (auth.uid() = user_id)', t, t);
    EXECUTE format('CREATE POLICY "Users can insert their own %I" ON public.%I FOR INSERT WITH CHECK (auth.uid() = user_id)', t, t);
    EXECUTE format('CREATE POLICY "Users can update their own %I" ON public.%I FOR UPDATE USING (auth.uid() = user_id)', t, t);
    EXECUTE format('CREATE POLICY "Users can delete their own %I" ON public.%I FOR DELETE USING (auth.uid() = user_id)', t, t);
  END LOOP;
END$$;

-- =====================================================================
-- 10.  updated_at TRIGGERS
-- =====================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

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

-- =====================================================================
-- 11.  AUTO-CREATE USER PROFILE ON SIGN-UP
-- =====================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, full_name, created_at, updated_at)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NOW(), NOW())
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================================
-- 12.  STORAGE BUCKET FOR DOCUMENTS
-- =====================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies — owners can read/write their own files only.
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own documents"  ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;

CREATE POLICY "Users can upload their own documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "Users can read their own documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "Users can update their own documents" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "Users can delete their own documents" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- The bucket is public-readable so the app can render the URL directly
-- without a signed-URL round-trip. Files are still scoped per-user via
-- the path prefix (userId/...) enforced by the policies above.

-- =====================================================================
-- DONE.
-- =====================================================================
