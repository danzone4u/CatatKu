import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SUPABASE_URL = 'https://vmfzvppivtwvznzojjty.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_xpZYgg-9bJWxOdE8PHx7Yw_y5MgBP86';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
