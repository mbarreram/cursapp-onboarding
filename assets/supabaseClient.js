/* Cursapp · Supabase Client
   Fase 1: conexión base para integración híbrida localStorage + Supabase.
   Importante: esta es la clave ANON PUBLIC. No usar service_role en frontend.
*/
(function () {
  const config = window.CURSAPP_SUPABASE || {};
  const SUPABASE_URL = config.url;
  const SUPABASE_PUBLIC_KEY = config.publishableKey;

  function initSupabase() {
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      console.warn("Supabase SDK no cargado. Revisa el script CDN en el HTML.");
      return null;
    }

    if (window.cursappSupabase) return window.cursappSupabase;

    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: config.sdkStorageKey || "cursapp_supabase_oauth_v1"
      }
    });

    window.cursappSupabase = client;
    window.CURSAPP_SUPABASE_READY = true;
    return client;
  }

  window.initCursappSupabase = initSupabase;
  document.addEventListener("DOMContentLoaded", initSupabase);
})();
