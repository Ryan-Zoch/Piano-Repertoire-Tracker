/* =========================================================
   Cloud sync configuration
   ---------------------------------------------------------
   Fill these two values in to enable optional cross-device sync.
   Get them from your Supabase project:
     Dashboard → Project Settings → API
       • Project URL  →  supabaseUrl
       • anon public  →  supabaseAnonKey   (this key is safe to expose;
                                            your data is protected by
                                            Row Level Security)
   Leave them blank to keep the app fully local (no sync).
   See "Cloud sync setup" in the README for the full walkthrough.
   ========================================================= */
window.PRT_CONFIG = {
  supabaseUrl: "https://shcnbwiyeeebybcjvhaz.supabase.co/rest/v1/",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoY25id2l5ZWVlYnliY2p2aGF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MjA3ODYsImV4cCI6MjA5Nzk5Njc4Nn0.pHnt_8vfsOrf1ZdJKjplf_Ak6XyudlTWG-3Jawe_R9Y",
};
