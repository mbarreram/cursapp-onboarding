/* Cursapp · Supabase Client
   Fase 1: conexión base para integración híbrida localStorage + Supabase.
   Importante: esta es la clave ANON PUBLIC. No usar service_role en frontend.
*/
(function () {
  const SUPABASE_URL = "https://ngxistgymgdkoaiulfbq.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5neGlzdGd5bWdka29haXVsZmJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2OTg1NDQsImV4cCI6MjA5NjI3NDU0NH0.1r-aLijYEWvUifKcLjlClnA8-oYw11lgThY0swg_xbg";

  function initSupabase() {
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      console.warn("Supabase SDK no cargado. Revisa el script CDN en el HTML.");
      return null;
    }

    if (window.cursappSupabase) return window.cursappSupabase;

    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });

    window.cursappSupabase = client;
    window.CURSAPP_SUPABASE_READY = true;
    return client;
  }

  window.initCursappSupabase = initSupabase;
  document.addEventListener("DOMContentLoaded", initSupabase);
})();
