// Manda un email avisando que se le asignó una tarea a alguien. A
// diferencia de ms-sync-evento-tarea, acá no hace falta el OAuth de nadie
// en particular: se manda "como" una casilla fija de la empresa
// (MS_REMITENTE_EMAIL) usando permiso de APLICACIÓN (Mail.Send), con
// client credentials — por eso no depende de que el responsable haya
// conectado su Outlook.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

async function obtenerAccessTokenAplicacion() {
  const resp = await fetch(
    `https://login.microsoftonline.com/${Deno.env.get("MS_TENANT_ID")}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: Deno.env.get("MS_CLIENT_ID")!,
        client_secret: Deno.env.get("MS_CLIENT_SECRET")!,
        grant_type: "client_credentials",
        scope: "https://graph.microsoft.com/.default",
      }),
    }
  );

  const tokenData = await resp.json();
  if (!resp.ok) return null;
  return tokenData.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { tarea_id, motivo = "asignacion" } = await req.json();
    if (!tarea_id) return jsonResponse({ error: "Falta tarea_id" }, 400);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("PROJECT_SECRET_KEY")!
    );

    const { data: tarea, error: tareaError } = await supabaseAdmin
      .from("tareas")
      .select("titulo, descripcion, fecha_inicio, fecha_termino, responsable_id")
      .eq("id", tarea_id)
      .maybeSingle();

    if (tareaError) {
      return jsonResponse({ error: "Error leyendo la tarea: " + tareaError.message }, 500);
    }
    if (!tarea || !tarea.responsable_id) {
      return jsonResponse({ skipped: true, motivo: "sin tarea o sin responsable" });
    }

    const { data: perfil } = await supabaseAdmin
      .from("perfiles")
      .select("email")
      .eq("id", tarea.responsable_id)
      .maybeSingle();

    if (!perfil || !perfil.email) {
      return jsonResponse({ skipped: true, motivo: "responsable sin email registrado" });
    }

    const accessToken = await obtenerAccessTokenAplicacion();
    if (!accessToken) {
      return jsonResponse({ error: "No se pudo obtener token de aplicación de Microsoft" }, 500);
    }

    const primeraLinea =
      motivo === "fechas"
        ? `Cambiaron las fechas de tu tarea "${tarea.titulo}".`
        : `Se te asignó la tarea "${tarea.titulo}".`;

    const cuerpo = [
      primeraLinea,
      tarea.descripcion ? `\nDescripción: ${tarea.descripcion}` : "",
      tarea.fecha_inicio ? `\nInicio: ${tarea.fecha_inicio}` : "",
      tarea.fecha_termino ? `\nTérmino: ${tarea.fecha_termino}` : "",
    ].join("");

    const asunto =
      motivo === "fechas" ? `Cambiaron las fechas: ${tarea.titulo}` : `Nueva tarea asignada: ${tarea.titulo}`;

    const remitente = Deno.env.get("MS_REMITENTE_EMAIL");

    const mailResp = await fetch(`https://graph.microsoft.com/v1.0/users/${remitente}/sendMail`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject: asunto,
          body: { contentType: "Text", content: cuerpo },
          toRecipients: [{ emailAddress: { address: perfil.email } }],
        },
      }),
    });

    if (!mailResp.ok) {
      const errorBody = await mailResp.json().catch(() => ({}));
      return jsonResponse(
        { error: errorBody.error?.message || "Error al enviar el mail con Microsoft Graph" },
        400
      );
    }

    return jsonResponse({ ok: true });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});
