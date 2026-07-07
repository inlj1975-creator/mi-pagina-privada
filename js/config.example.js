// Plantilla de configuración. Copia este archivo como "config.js" (en la misma carpeta)
// y reemplaza los valores con los reales de tu proyecto Supabase.
// Los encuentras en: Supabase Dashboard -> Project Settings -> API.
//
// "config.js" está excluido de git (ver .gitignore), así que tus valores reales
// nunca se suben al repositorio.

const SUPABASE_URL = "https://TU-PROYECTO.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_xxxxxxxxxxxxxxxxxxxx";

// Integración con Microsoft Outlook. Estos tres valores NO son secretos
// (client_id y tenant_id se ven en la URL del navegador al conectar; el
// redirect_uri es una URL pública) — el client_secret nunca va acá, vive
// solo como Supabase Function secret. Los encuentras en:
// entra.microsoft.com -> tu app -> Overview.
const MS_CLIENT_ID = "TU-APPLICATION-CLIENT-ID";
const MS_TENANT_ID = "TU-DIRECTORY-TENANT-ID";
const MS_REDIRECT_URI = "https://TU-USUARIO.github.io/TU-REPO/oauth-callback.html";
