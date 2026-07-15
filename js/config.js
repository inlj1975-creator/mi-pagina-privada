// Este archivo SÍ se sube a git: ninguno de estos valores es secreto
// (están pensados para vivir en el navegador). Los encuentras en:
// Supabase Dashboard -> Project Settings -> API, y entra.microsoft.com -> tu app.
//
// Este archivo tiene valores distintos a propósito en main (producción) y
// en staging (ver CLAUDE.md, sección "Ambiente de staging") — un merge
// driver (.gitattributes) evita que un merge entre ramas los mezcle.

// RAMA STAGING — estos son placeholders. Reemplazar cuando exista el
// proyecto Supabase de staging (ver CLAUDE.md, sección "Ambiente de
// staging") con su Project URL y publishable key reales:
const SUPABASE_URL = "https://PENDIENTE-proyecto-supabase-staging.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_PENDIENTE";

// Integración con Microsoft Outlook (ver js/config.example.js para más detalle).
// MS_CLIENT_ID / MS_TENANT_ID quedan iguales a producción (se reusa el
// mismo app registration de Azure). MS_REDIRECT_URI es un placeholder:
// reemplazar por la URL real de Cloudflare Pages cuando exista, y agregar
// esa misma URL como redirect URI en Azure (Authentication -> Add a URI).
const MS_CLIENT_ID = "83dc4320-7d80-430c-9f69-e374fd6eac52";
const MS_TENANT_ID = "686c15d7-2396-4e7f-9f29-35e5cbcfbf3f";
const MS_REDIRECT_URI = "https://PENDIENTE.pages.dev/oauth-callback.html";
