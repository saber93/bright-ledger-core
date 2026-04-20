export const DEFAULT_SUPABASE_URL = "https://qyrqqngzfavorwkakmxw.supabase.co";
export const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_b_GtdNXv8DG250nujQEyyw_NMwv7Oz3";

export function resolvePublicSupabaseConfig() {
  const url =
    import.meta.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    DEFAULT_SUPABASE_URL;
  const publishableKey =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    DEFAULT_SUPABASE_PUBLISHABLE_KEY;

  return {
    url,
    publishableKey,
  };
}
