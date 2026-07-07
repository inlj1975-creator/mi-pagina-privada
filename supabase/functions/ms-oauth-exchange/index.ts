// Recibe el "code" que Microsoft devolvió a oauth-callback.html y lo
// cambia por tokens de acceso (necesita el client_secret, por eso esto
// vive acá y no en el frontend). Guarda el resultado en "ms_conexiones"
// como el propio usuario (respeta la política RLS de insert/update:
// user_id = auth.uid()), no con la service role.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const { code, redirect_uri } = await req.json();
    if (!code || !redirect_uri) {
      return new Response(JSON.stringify({ error: "Falta code o redirect_uri" }), { status: 400 });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autenticado" }), { status: 401 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "No autenticado" }), { status: 401 });
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
          scope: "offline_access Calendars.ReadWrite",
        }),
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      return new Response(
        JSON.stringify({ error: tokenData.error_description || "Error al canjear el código con Microsoft" }),
        { status: 400 }
      );
    }

    const msTokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    const { error: upsertError } = await supabase.from("ms_conexiones").upsert({
      user_id: user.id,
      ms_access_token: tokenData.access_token,
      ms_refresh_token: tokenData.refresh_token,
      ms_token_expires_at: msTokenExpiresAt,
      ms_scope: tokenData.scope,
      updated_at: new Date().toISOString(),
    });

    if (upsertError) {
      return new Response(JSON.stringify({ error: upsertError.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
