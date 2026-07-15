// Este archivo SÍ se sube a git: ninguno de estos valores es secreto
// (están pensados para vivir en el navegador). Los encuentras en:
// Supabase Dashboard -> Project Settings -> API, y entra.microsoft.com -> tu app.
//
// Este archivo tiene valores distintos a propósito en main (producción) y
// en staging (ver CLAUDE.md, sección "Ambiente de staging") — un merge
// driver (.gitattributes) evita que un merge entre ramas los mezcle.

// RAMA STAGING — proyecto Supabase de staging (mi-pagina-privada-staging):
const SUPABASE_URL = "https://bdphftoorhaxdzdiylyv.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_DbRQFAstJgQldqnyT_Sdqg_feGp3FP3";

// Integración con Microsoft Outlook (ver js/config.example.js para más detalle).
// MS_CLIENT_ID / MS_TENANT_ID quedan iguales a producción (se reusa el
// mismo app registration de Azure). MS_REDIRECT_URI apunta a la URL de
// Cloudflare Pages — hay que agregar esta misma URL como redirect URI en
// Azure (Authentication -> Add a URI) para que el login de Outlook funcione.
const MS_CLIENT_ID = "83dc4320-7d80-430c-9f69-e374fd6eac52";
const MS_TENANT_ID = "686c15d7-2396-4e7f-9f29-35e5cbcfbf3f";
const MS_REDIRECT_URI = "https://mi-pagina-privada.pages.dev/oauth-callback.html";
