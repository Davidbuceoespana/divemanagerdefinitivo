// lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
// ---> Comprueba aquí:
console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
console.log('ANON KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// Exponemos globalmente para poder probarlo en la consola
if (typeof window !== 'undefined') {
  window.supabase = supabase;
}
