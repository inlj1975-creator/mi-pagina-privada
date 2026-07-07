// Crea un único cliente de Supabase para toda la app, usando los valores
// definidos en config.js. El resto de los scripts (auth.js, auth-guard.js,
// projects.js) usan "window.supabaseClient" para hablar con Supabase.
//
// Requiere que, antes de este script, la página haya cargado:
//   1) la librería de Supabase desde el CDN (define window.supabase)
//   2) config.js (define SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY)

window.supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
