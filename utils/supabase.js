require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('⚠️  SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diset di .env');
}

// Service role client — untuk DB operations (bypass RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

// Anon client — untuk user auth (signInWithPassword, dll)
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

module.exports = supabase;
module.exports.authClient = supabaseAnon;
