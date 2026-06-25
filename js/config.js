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
  supabaseUrl: "",
  supabaseAnonKey: "",
};
