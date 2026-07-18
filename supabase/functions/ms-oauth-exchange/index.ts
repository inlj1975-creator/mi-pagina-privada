// Recibe el "code" que Microsoft devolvió a oauth-callback.html y lo
// cambia por tokens de acceso (necesita el client_secret, por eso esto
// vive acá y no en el frontend). Guarda el resultado en "ms_conexiones"
// como el propio usuario (respeta la política RLS de insert/update:
// user_id = auth.uid()), no con la service role.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Sin estos headers, el navegador bloquea la respuesta por CORS: la
// página vive en github.io y la función en supabase.co, orígenes
// distintos. "*" es suficiente acá (no hay cookies de por medio, la
// autenticación viaja en el header Authorization).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// --- Cifrado de tokens de Microsoft (AES-GCM) ---
// Si alguien obtiene la secret key de Supabase (bypassea RLS), no alcanza
// para leer el token: también necesitaría "MS_TOKEN_ENCRYPTION_KEY", que
// solo vive como Edge Function secret, nunca en la base ni en el repo.
async function obtenerClaveCifrado(): Promise<CryptoKey> {
  const claveBase64 = Deno.env.get("MS_TOKEN_ENCRYPTION_KEY")!;
  const claveBytes = Uint8Array.from(atob(claveBase64), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey("raw", claveBytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encriptarToken(texto: string): Promise<string> {
  const clave = await obtenerClaveCifrado();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const datos = new TextEncoder().encode(texto);
  const cifrado = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, clave, datos);
  const combinado = new Uint8Array(iv.length + cifrado.byteLength);
  combinado.set(iv, 0);
  combinado.set(new Uint8Array(cifrado), iv.length);
  return btoa(String.fromCharCode(...combinado));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { code, redirect_uri } = await req.json();
    if (!code || !redirect_uri) {
      return jsonResponse({ error: "Falta code o redirect_uri" }, 400);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "No autenticado" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: "No autenticado" }, 401);
    }

    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${Deno.env.get("MS_TENANT_ID")}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: Deno.env.get("MS_CLIENT_ID")!,
          client_secret: Deno.env.get("MS_CLIENT_SECRET")!,
          grant_type: "authorization_code",
          code,
          redirect_uri,
          scope: "offline_access Calendars.ReadWrite Group.ReadWrite.All",
        }),
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      return jsonResponse(
        { error: tokenData.error_description || "Error al canjear el código con Microsoft" },
        400
      );
    }

    const msTokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    const { error: upsertError } = await supabase.from("ms_conexiones").upsert({
      user_id: user.id,
      ms_access_token: await encriptarToken(tokenData.access_token),
      ms_refresh_token: await encriptarToken(tokenData.refresh_token),
      ms_token_expires_at: msTokenExpiresAt,
      ms_scope: tokenData.scope,
      updated_at: new Date().toISOString(),
    });

    if (upsertError) {
      return jsonResponse({ error: upsertError.message }, 500);
    }

    return jsonResponse({ ok: true });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});
