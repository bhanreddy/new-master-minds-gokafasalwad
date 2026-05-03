import { createClient } from '@supabase/supabase-js';
import { SecureTokenStore } from './secureTokenStore';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../constants/school';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: SecureTokenStore,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

