/* ============================================================
   ARCHITECTURE INTÉRIEURE — supabase-client.js
   Client Supabase UNIQUE, partagé par toute la page.
   À charger une seule fois, juste après le CDN Supabase et
   AVANT menu.js et le script propre à chaque page.
   Aucun autre fichier ne doit appeler supabase.createClient().
   ============================================================ */

const SUPABASE_URL = 'https://xhrhqgpzewyfenidyaox.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhocmhxZ3B6ZXd5ZmVuaWR5YW94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5OTA1NDQsImV4cCI6MjA5OTU2NjU0NH0.76-Z2nXAOUKWew-bvgTBhxAeYKbfkJZErwqUHrlQE3g';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
