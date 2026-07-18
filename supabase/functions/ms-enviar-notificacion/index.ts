// Manda un email avisando que se le asignó una tarea a alguien. A
// diferencia de ms-sync-evento-tarea, acá no hace falta el OAuth de nadie
// en particular: se manda con permiso de APLICACIÓN (Mail.Send), con
// client credentials — por eso no depende de que el responsable haya
// conectado su Outlook.
//
// Desde la Fase 2 de "Proyectos ampliados": si la tarea pertenece a un
// proyecto que ya tiene Grupo M365, se manda "como" ese grupo
// (/groups/{id}/sendMail) en vez de la casilla fija MS_REMITENTE_EMAIL. Si
// el proyecto no tiene grupo (o el envío como grupo falla), cae de vuelta
// al comportamiento de siempre — este cambio nunca debe dejar una
// notificación sin mandarse.

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

// deno-lint-ignore no-explicit-any
async function obtenerInfoProyecto(supabaseAdmin: any, proyectoId: string | null) {
  if (!proyectoId) return "";

  const { data: proyecto } = await supabaseAdmin
    .from("proyectos")
    .select("nombre, descripcion, estado, fecha, cliente_id")
    .eq("id", proyectoId)
    .maybeSingle();

  if (!proyecto) return "";

  let clienteNombre = "";
  if (proyecto.cliente_id) {
    const { data: cliente } = await supabaseAdmin
      .from("clientes")
      .select("nombre")
      .eq("id", proyecto.cliente_id)
      .maybeSingle();
    clienteNombre = cliente?.nombre || "";
  }

  return [
    `\n\nProyecto: ${proyecto.nombre}`,
    proyecto.estado ? `\nEstado del proyecto: ${proyecto.estado}` : "",
    proyecto.fecha ? `\nFecha del proyecto: ${proyecto.fecha}` : "",
    clienteNombre ? `\nCliente: ${clienteNombre}` : "",
    proyecto.descripcion ? `\nDescripción del proyecto: ${proyecto.descripcion}` : "",
  ].join("");
}

// deno-lint-ignore no-explicit-any
async function obtenerGrupoDeProyecto(supabaseAdmin: any, proyectoId: string | null) {
  if (!proyectoId) return null;
  const { data } = await supabaseAdmin
    .from("proyectos")
    .select("ms_group_id")
    .eq("id", proyectoId)
    .maybeSingle();
  return data?.ms_group_id || null;
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
      .select("titulo, descripcion, fecha_inicio, fecha_termino, responsable_id, proyecto_id")
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

    const infoProyecto = await obtenerInfoProyecto(supabaseAdmin, tarea.proyecto_id);

    const primeraLinea =
      motivo === "fechas"
        ? `Cambiaron las fechas de tu tarea "${tarea.titulo}".`
        : `Se te asignó la tarea "${tarea.titulo}".`;

    const cuerpo = [
      primeraLinea,
      tarea.descripcion ? `\nDescripción: ${tarea.descripcion}` : "",
      tarea.fecha_inicio ? `\nInicio: ${tarea.fecha_inicio}` : "",
      tarea.fecha_termino ? `\nTérmino: ${tarea.fecha_termino}` : "",
      infoProyecto,
    ].join("");

    const asunto =
      motivo === "fechas" ? `Cambiaron las fechas: ${tarea.titulo}` : `Nueva tarea asignada: ${tarea.titulo}`;

    const mensaje = {
      message: {
        subject: asunto,
        body: { contentType: "Text", content: cuerpo },
        toRecipients: [{ emailAddress: { address: perfil.email } }],
      },
    };

    // Preferencia: mandar "como" el grupo del proyecto (si existe). Si el
    // proyecto no tiene grupo, o el envío como grupo falla por lo que sea,
    // cae de vuelta a la casilla fija de siempre — este cambio de
    // comportamiento nunca debe dejar una notificación sin mandarse.
    const groupId = await obtenerGrupoDeProyecto(supabaseAdmin, tarea.proyecto_id);

    let enviadoComoGrupo = false;
    let mailResp: Response | null = null;
    // Guarda el motivo del intento como grupo (si se probó y falló), para
    // poder diagnosticarlo sin adivinar -- antes esto se perdía en
    // silencio si terminaba usando el fallback.
    let errorComoGrupo: string | null = null;

    if (groupId) {
      mailResp = await fetch(`https://graph.microsoft.com/v1.0/groups/${groupId}/sendMail`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(mensaje),
      });
      enviadoComoGrupo = mailResp.ok;

      if (!mailResp.ok) {
        const errorBody = await mailResp.json().catch(() => ({}));
        errorComoGrupo = `${mailResp.status} ${errorBody.error?.message || "sin detalle"}`;
      }
    }

    if (!mailResp || !mailResp.ok) {
      const remitente = Deno.env.get("MS_REMITENTE_EMAIL");
      mailResp = await fetch(`https://graph.microsoft.com/v1.0/users/${remitente}/sendMail`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(mensaje),
      });
      enviadoComoGrupo = false;
    }

    if (!mailResp.ok) {
      const errorBody = await mailResp.json().catch(() => ({}));
      return jsonResponse(
        { error: errorBody.error?.message || "Error al enviar el mail con Microsoft Graph" },
        400
      );
    }

    return jsonResponse({ ok: true, enviado_como_grupo: enviadoComoGrupo, error_como_grupo: errorComoGrupo });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});
