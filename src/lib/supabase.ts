import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { required } from "./env";

let _service: SupabaseClient | null = null;

// Service-role client — bypasses RLS. Server-only. Never import in client components.
export function supabaseService(): SupabaseClient {
  if (_service) return _service;
  _service = createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return _service;
}
