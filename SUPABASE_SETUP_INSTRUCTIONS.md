# Supabase Database Setup Instructions

## CRITICAL: You MUST run this SQL script in Supabase to create the database tables

The database tables don't exist yet, which is why you're getting "Could not find the table 'public.properties'" errors.

### Steps to Fix:

1. **Go to your Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Select your project: `wnqrjintbqcjxyaktddu`

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy and Paste the SQL Script**
   - Open the file: `supabase-setup/01-create-tables.sql`
   - Copy the ENTIRE contents
   - Paste into the SQL Editor

4. **Run the Script**
   - Click "Run" button
   - Wait for it to complete (should take 10-30 seconds)

5. **Verify Tables Created**
   - Go to "Table Editor" in the left sidebar
   - You should see 8 tables: properties, tenants, rent_payments, expenses, maintenance_requests, documents, notes, user_profiles

### After Running the Script:
- All database errors will be fixed
- You can add properties, tenants, payments, etc.
- All features will work properly

### If You Get Errors:
- Make sure you're logged into the correct Supabase project
- Check that you copied the entire SQL script
- Try running smaller sections if needed
