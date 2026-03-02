import { createClient } from '@supabase/supabase-js';
import { SecureTokenStore } from './secureTokenStore';

const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://dqsogllxctoccohmwhww.supabase.co').trim();
const supabaseAnonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxc29nbGx4Y3RvY2NvaG13aHd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3Nzg5MjUsImV4cCI6MjA4MzM1NDkyNX0.pTfn7zlFm8swf8Ru0KheXsQaxlI55-KRBofzr_UnehA').trim();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: SecureTokenStore,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});
