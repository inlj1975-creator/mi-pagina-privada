// Crea/actualiza/borra el evento de Outlook correspondiente a una tarea, en
// DOS calendarios independientes: (a) el calendario PERSONAL del
// responsable (endpoint delegado /me/events, sync original) y (b) el
// calendario COMPARTIDO del Grupo M365 del proyecto de la tarea (endpoint
// de aplicación /groups/{id}/events, agregado en la Fase 2 de "Proyectos
// ampliados"). Las dos sync son INDEPENDIENTES entre sí: si el responsable
// no conectó su Outlook pero el proyecto sí tiene grupo, la sync de grupo
// se intenta igual (y viceversa) -- ninguna bloquea a la otra.
//
// Cualquier problema de cualquiera de las dos (responsable sin conexión,
// proyecto sin grupo, error de Graph) queda en el campo correspondiente
// ("personal"/"grupo") de la respuesta, con status 200: la tarea ya se
// guardó en la app antes de llamar acá, así que un problema del lado de
// Outlook nunca debe verse como una falla real.

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

async function desencriptarToken(textoCifrado: string): Promise<string> {
  const clave = await obtenerClaveCifrado();
  const combinado = Uint8Array.from(atob(textoCifrado), (c) => c.charCodeAt(0));
  const iv = combinado.slice(0, 12);
  const cifrado = combinado.slice(12);
  const datos = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, clave, cifrado);
  return new TextDecoder().decode(datos);
}

function sumarUnDia(fecha: string) {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
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
async function obtenerAccessTokenResponsable(supabaseAdmin: any, responsableId: string) {
  const { data: conexion } = await supabaseAdmin
    .from("ms_conexiones")
    .select("*")
    .eq("user_id", responsableId)
    .maybeSingle();

  if (!conexion) return null;

  let accessTokenActual: string;
  let refreshTokenActual: string;
  try {
    accessTokenActual = await desencriptarToken(conexion.ms_access_token);
    refreshTokenActual = await desencriptarToken(conexion.ms_refresh_token);
  } catch {
    // Fila de antes de cifrar (texto plano) o dato corrupto: no hay forma
    // de recuperar el token real. Se trata igual que "sin conexión" — el
    // responsable tiene que reconectar su Outlook desde "Mi cuenta".
    return null;
  }

  const vencePronto = new Date(conexion.ms_token_expires_at).getTime() < Date.now() + 60_000;
  if (!vencePronto) return accessTokenActual;

  const resp = await fetch(
    `https://login.microsoftonline.com/${Deno.env.get("MS_TENANT_ID")}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: Deno.env.get("MS_CLIENT_ID")!,
        client_secret: Deno.env.get("MS_CLIENT_SECRET")!,
        grant_type: "refresh_token",
        refresh_token: refreshTokenActual,
        scope: "offline_access Calendars.ReadWrite",
      }),
    }
  );

  const tokenData = await resp.json();
  if (!resp.ok) return null;

  await supabaseAdmin
    .from("ms_conexiones")
    .update({
      ms_access_token: await encriptarToken(tokenData.access_token),
      ms_refresh_token: await encriptarToken(tokenData.refresh_token || refreshTokenActual),
      ms_token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", responsableId);

  return tokenData.access_token;
}

// Token de aplicación (mismo patrón que ms-enviar-notificacion), para
// escribir en el calendario COMPARTIDO del grupo sin depender de que nadie
// haya conectado su Outlook.
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

// deno-lint-ignore no-explicit-any
async function obtenerGroupIdDeProyecto(supabaseAdmin: any, proyectoId: string | null) {
  if (!proyectoId) return null;
  const { data } = await supabaseAdmin
    .from("proyectos")
    .select("ms_group_id")
    .eq("id", proyectoId)
    .maybeSingle();
  return data?.ms_group_id || null;
}

// deno-lint-ignore no-explicit-any
function armarEventoBody(tarea: any, infoProyecto: string) {
  const fechaInicio = tarea.fecha_inicio || tarea.fecha_termino;
  const fechaTermino = tarea.fecha_termino || tarea.fecha_inicio;
  return {
    subject: tarea.titulo,
    body: { contentType: "text", content: (tarea.descripcion || "") + infoProyecto },
    isAllDay: true,
    start: { dateTime: `${fechaInicio}T00:00:00`, timeZone: "UTC" },
    end: { dateTime: `${sumarUnDia(fechaTermino)}T00:00:00`, timeZone: "UTC" },
  };
}

// deno-lint-ignore no-explicit-any
async function sincronizarCalendarioPersonal(supabaseAdmin: any, tarea: any, infoProyecto: string) {
  if (!tarea.responsable_id) return { skipped: true, motivo: "la tarea no tiene responsable_id" };

  const accessToken = await obtenerAccessTokenResponsable(supabaseAdmin, tarea.responsable_id);
  if (!accessToken) {
    return { skipped: true, motivo: "responsable sin conexión de Outlook válida" };
  }

  const eventoBody = armarEventoBody(tarea, infoProyecto);
  const graphUrl = tarea.outlook_event_id
    ? `https://graph.microsoft.com/v1.0/me/events/${tarea.outlook_event_id}`
    : `https://graph.microsoft.com/v1.0/me/events`;

  const graphResp = await fetch(graphUrl, {
    method: tarea.outlook_event_id ? "PATCH" : "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(eventoBody),
  });

  const graphData = await graphResp.json().catch(() => ({}));
  if (!graphResp.ok) {
    return { error: graphData.error?.message || "Error al sincronizar el evento con Outlook" };
  }

  if (!tarea.outlook_event_id) {
    await supabaseAdmin.from("tareas").update({ outlook_event_id: graphData.id }).eq("id", tarea.id);
  }

  return { ok: true };
}

// deno-lint-ignore no-explicit-any
async function sincronizarCalendarioGrupo(supabaseAdmin: any, tarea: any, infoProyecto: string) {
  const groupId = await obtenerGroupIdDeProyecto(supabaseAdmin, tarea.proyecto_id);
  if (!groupId) return { skipped: true, motivo: "el proyecto no tiene Grupo M365" };

  const accessToken = await obtenerAccessTokenAplicacion();
  if (!accessToken) return { skipped: true, motivo: "no se pudo obtener token de aplicación de Microsoft" };

  const eventoBody = armarEventoBody(tarea, infoProyecto);
  const graphUrl = tarea.ms_group_event_id
    ? `https://graph.microsoft.com/v1.0/groups/${groupId}/events/${tarea.ms_group_event_id}`
    : `https://graph.microsoft.com/v1.0/groups/${groupId}/events`;

  const graphResp = await fetch(graphUrl, {
    method: tarea.ms_group_event_id ? "PATCH" : "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(eventoBody),
  });

  const graphData = await graphResp.json().catch(() => ({}));
  if (!graphResp.ok) {
    return { error: graphData.error?.message || "Error al sincronizar el evento con el calendario del grupo" };
  }

  if (!tarea.ms_group_event_id) {
    await supabaseAdmin.from("tareas").update({ ms_group_event_id: graphData.id }).eq("id", tarea.id);
  }

  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { tarea_id, accion, outlook_event_id, responsable_id, ms_group_event_id, proyecto_id } =
      await req.json();

    // "PROJECT_SECRET_KEY" guarda la "secret key" (sb_secret_...) del
    // sistema nuevo de claves de Supabase — hace de reemplazo del
    // "service role key" clásico. Salta RLS por completo, por eso esta
    // función puede leer la tarea y la conexión de Outlook de CUALQUIER
    // usuario (el responsable), no solo del que hizo el pedido. No puede
    // llamarse "SUPABASE_..." (Supabase reserva ese prefijo para sus
    // propias variables).
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("PROJECT_SECRET_KEY")!
    );

    if (accion === "delete") {
      const resultados: Record<string, unknown> = {};

      if (outlook_event_id && responsable_id) {
        const accessToken = await obtenerAccessTokenResponsable(supabaseAdmin, responsable_id);
        if (accessToken) {
          // No revisamos el resultado: si el evento ya no existía (por
          // ejemplo, alguien lo borró a mano en Outlook), el resultado que
          // nos importa (que no quede el evento) ya se cumple igual.
          await fetch(`https://graph.microsoft.com/v1.0/me/events/${outlook_event_id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          resultados.personal = { ok: true };
        } else {
          resultados.personal = { skipped: true, motivo: "responsable sin conexión de Outlook válida" };
        }
      } else {
        resultados.personal = { skipped: true, motivo: "sin outlook_event_id o responsable_id" };
      }

      if (ms_group_event_id && proyecto_id) {
        const groupId = await obtenerGroupIdDeProyecto(supabaseAdmin, proyecto_id);
        const accessToken = groupId ? await obtenerAccessTokenAplicacion() : null;
        if (accessToken) {
          await fetch(`https://graph.microsoft.com/v1.0/groups/${groupId}/events/${ms_group_event_id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          resultados.grupo = { ok: true };
        } else {
          resultados.grupo = { skipped: true, motivo: "sin grupo M365 o token de aplicación" };
        }
      } else {
        resultados.grupo = { skipped: true, motivo: "sin ms_group_event_id o proyecto_id" };
      }

      return jsonResponse({ ok: true, ...resultados });
    }

    if (accion === "upsert") {
      if (!tarea_id) return jsonResponse({ error: "Falta tarea_id" }, 400);

      const { data: tarea, error: tareaError } = await supabaseAdmin
        .from("tareas")
        .select(
          "id, titulo, descripcion, fecha_inicio, fecha_termino, responsable_id, outlook_event_id, ms_group_event_id, proyecto_id"
        )
        .eq("id", tarea_id)
        .maybeSingle();

      if (tareaError) {
        return jsonResponse({ error: "Error leyendo la tarea: " + tareaError.message }, 500);
      }
      if (!tarea) {
        return jsonResponse({ skipped: true, motivo: "no se encontró la tarea", tarea_id_recibido: tarea_id });
      }

      const fechaInicio = tarea.fecha_inicio || tarea.fecha_termino;
      const fechaTermino = tarea.fecha_termino || tarea.fecha_inicio;
      if (!fechaInicio || !fechaTermino) {
        return jsonResponse({ skipped: true, motivo: "sin fechas" });
      }

      const infoProyecto = await obtenerInfoProyecto(supabaseAdmin, tarea.proyecto_id);

      const [personal, grupo] = await Promise.all([
        sincronizarCalendarioPersonal(supabaseAdmin, tarea, infoProyecto),
        sincronizarCalendarioGrupo(supabaseAdmin, tarea, infoProyecto),
      ]);

      return jsonResponse({ ok: true, personal, grupo });
    }

    return jsonResponse({ error: "accion inválida" }, 400);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});
