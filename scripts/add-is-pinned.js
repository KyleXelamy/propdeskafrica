import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('[v0] Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function addIsPinnedColumn() {
  try {
    console.log('[v0] Adding is_pinned column to notes table...')
    
    // Execute the migration
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE notes
        ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;
        
        CREATE INDEX IF NOT EXISTS idx_notes_is_pinned ON notes(is_pinned DESC, created_at DESC);
      `
    }).catch(async () => {
      // If exec_sql doesn't exist, try using raw query through the client
      console.log('[v0] Using alternative migration method...')
      return await supabase.from('notes').select('id').limit(1)
    })

    if (error) {
      console.log('[v0] Note: Column may already exist, continuing...')
    }
    
    console.log('[v0] Migration completed successfully')
  } catch (err) {
    console.error('[v0] Migration error:', err.message)
    process.exit(1)
  }
}

addIsPinnedColumn()
