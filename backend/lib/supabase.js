const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://mock.supabase.co',
  process.env.SUPABASE_KEY || 'mock'
);

// Returns true only if a real Supabase URL is configured
const isSupabaseReady = () =>
  !!process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('mock');

module.exports = { supabase, isSupabaseReady };
