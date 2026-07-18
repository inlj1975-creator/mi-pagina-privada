// Crea (si hace falta) el Grupo de Microsoft 365 de un proyecto -- con sus
// carpetas y calendario compartido -- y mantiene su membresía al día.
// Sync de un solo sentido y ADITIVO: nunca se quita a nadie del grupo acá,
// solo se agrega. Se llama (a) al crear/editar un proyecto (js/projects.js,
// js/ofertas.js) y (b) al guardar una tarea con proyecto_id (js/tareas.js),
// para que el responsable de esa tarea quede también como miembro.
//
// No-bloqueante, mismo espíritu que ms-sync-evento-tarea / ms-enviar-
// notificacion: cualquier problema puntual de Graph (una carpeta que no se
// pudo crear, un miembro que no se pudo agregar) queda listado en
// "errores" del resumen que devuelve, nunca corta en el primer error.

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

const CARPETAS = ["Propuesta", "Factura Compras", "Factura Ventas"];

// Mismo patrón que obtenerAccessTokenAplicacion() de ms-enviar-notificacion
// (duplicado a propósito, siguiendo la convención ya establecida en el repo
// de aceptar duplicación entre Edge Functions en vez de compartir código).
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

// Reglas de Graph para mailNickname: sin espacios, sin tildes/ñ, solo
// [a-zA-Z0-9_-], máximo 64 caracteres. Se le agrega un sufijo con los
// primeros 8 caracteres del id del proyecto para evitar choques entre
// proyectos con nombres iguales o parecidos (Graph rechaza con 400 si el
// mailNickname ya existe en el tenant, sea de un grupo o de un usuario).
function saneaMailNickname(nombre: string, proyectoId: string): string {
  const base =
    (nombre || "proyecto")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "") // saca tildes/diacriticos
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 40) || "proyecto";

  return `${base}-${proyectoId.slice(0, 8)}`;
}

async function crearCarpetas(accessToken: string, groupId: string, errores: string[]) {
  const carpetasCreadas: string[] = [];

  // La biblioteca de documentos (SharePoint) del grupo tarda unos segundos
  // en aprovisionarse justo después de crear el grupo: reintenta con
  // backoff en vez de fallar directo con 404/503 (gotcha conocido de Graph).
  let driveListo = false;
  for (let intento = 0; intento < 5 && !driveListo; intento++) {
    if (intento > 0) await new Promise((r) => setTimeout(r, 3000));
    const resp = await fetch(`https://graph.microsoft.com/v1.0/groups/${groupId}/drive`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (resp.ok) driveListo = true;
  }

  if (!driveListo) {
    errores.push("El drive del grupo no estuvo disponible a tiempo (SharePoint todavía aprovisionando)");
    return carpetasCreadas;
  }

  for (const nombreCarpeta of CARPETAS) {
    const resp = await fetch(`https://graph.microsoft.com/v1.0/groups/${groupId}/drive/root/children`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: nombreCarpeta,
        folder: {},
        "@microsoft.graph.conflictBehavior": "rename",
      }),
    });

    if (resp.ok) {
      carpetasCreadas.push(nombreCarpeta);
    } else {
      const errorData = await resp.json().catch(() => ({}));
      errores.push(`Carpeta "${nombreCarpeta}": ${errorData.error?.message || resp.status}`);
    }
  }

  return carpetasCreadas;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { proyecto_id, perfil_id_extra } = await req.json();
    if (!proyecto_id) return jsonResponse({ error: "Falta proyecto_id" }, 400);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("PROJECT_SECRET_KEY")!
    );

    const errores: string[] = [];

    const { data: proyecto, error: proyectoError } = await supabaseAdmin
      .from("proyectos")
      .select("id, nombre, ms_group_id, ms_group_email, responsable_comercial_id, project_manager_id")
      .eq("id", proyecto_id)
      .maybeSingle();

    if (proyectoError) {
      return jsonResponse({ error: "Error leyendo el proyecto: " + proyectoError.message }, 500);
    }
    if (!proyecto) {
      return jsonResponse({ skipped: true, motivo: "no se encontró el proyecto" });
    }

    const accessToken = await obtenerAccessTokenAplicacion();
    if (!accessToken) {
      return jsonResponse({ skipped: true, motivo: "no se pudo obtener token de aplicación de Microsoft" });
    }

    let grupoCreado = false;
    let carpetasCreadas: string[] = [];
    let groupId = proyecto.ms_group_id as string | null;
    let groupEmail = proyecto.ms_group_email as string | null;

    if (!groupId) {
      const mailNickname = saneaMailNickname(proyecto.nombre, proyecto.id);

      const grupoResp = await fetch("https://graph.microsoft.com/v1.0/groups", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          displayName: proyecto.nombre || mailNickname,
          mailNickname,
          mailEnabled: true,
          securityEnabled: false,
          groupTypes: ["Unified"],
          visibility: "Private",
        }),
      });

      const grupoData = await grupoResp.json();

      if (!grupoResp.ok) {
        return jsonResponse(
          { error: grupoData.error?.message || "Error al crear el Grupo M365" },
          400
        );
      }

      groupId = grupoData.id;
      groupEmail = grupoData.mail || null;
      grupoCreado = true;

      // Si "mail" todavía no vino en la respuesta (aprovisionamiento
      // asíncrono de Exchange), se reintenta una vez con una lectura corta.
      if (!groupEmail) {
        await new Promise((r) => setTimeout(r, 3000));
        const relecturaResp = await fetch(
          `https://graph.microsoft.com/v1.0/groups/${groupId}?$select=mail`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (relecturaResp.ok) {
          const relecturaData = await relecturaResp.json();
          groupEmail = relecturaData.mail || null;
        }
      }

      // Guardado con protección contra doble creación: si dos pedidos
      // llegaron casi al mismo tiempo (por ejemplo, doble clic en "Crear
      // proyecto"), el "is ms_group_id null" hace que solo el primero en
      // escribir gane. El grupo del segundo queda huérfano en Microsoft (se
      // puede borrar a mano desde admin.microsoft.com); no se automatiza el
      // borrado para no complejizar la función.
      const { data: actualizado } = await supabaseAdmin
        .from("proyectos")
        .update({ ms_group_id: groupId, ms_group_email: groupEmail })
        .eq("id", proyecto.id)
        .is("ms_group_id", null)
        .select("id")
        .maybeSingle();

      if (!actualizado) {
        errores.push("Otro pedido concurrente ya había creado el grupo de este proyecto; se usa ese en vez del recién creado");
        const { data: proyectoActual } = await supabaseAdmin
          .from("proyectos")
          .select("ms_group_id, ms_group_email")
          .eq("id", proyecto.id)
          .maybeSingle();
        groupId = proyectoActual?.ms_group_id || groupId;
        groupEmail = proyectoActual?.ms_group_email || groupEmail;
      }

      carpetasCreadas = await crearCarpetas(accessToken, groupId!, errores);
    }

    // Membresía: aditiva únicamente. Se arma sin duplicados y se resuelve
    // el email de cada perfil vía la tabla "perfiles". ASUNCIÓN A VERIFICAR:
    // se asume que perfiles.email coincide con el userPrincipalName de esa
    // persona en Microsoft/Entra ID -- evita necesitar "User.Read.All" para
    // resolver ids, pero si en algún caso no coincide (alias, dominio
    // distinto), agregar a esa persona fallará y quedará en "errores", sin
    // bloquear al resto.
    const perfilIds = [...new Set(
      [proyecto.responsable_comercial_id, proyecto.project_manager_id, perfil_id_extra].filter(Boolean)
    )];

    const miembrosAgregados: string[] = [];

    if (groupId && perfilIds.length > 0) {
      const { data: perfiles } = await supabaseAdmin
        .from("perfiles")
        .select("id, email")
        .in("id", perfilIds);

      for (const perfil of perfiles || []) {
        if (!perfil.email) {
          errores.push(`Perfil ${perfil.id} sin email registrado, no se pudo agregar al grupo`);
          continue;
        }

        const miembroResp = await fetch(`https://graph.microsoft.com/v1.0/groups/${groupId}/members/$ref`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            "@odata.id": `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(perfil.email)}`,
          }),
        });

        if (miembroResp.ok) {
          miembrosAgregados.push(perfil.email);
          continue;
        }

        const errorData = await miembroResp.json().catch(() => ({}));
        const mensaje: string = errorData.error?.message || "";

        // "ya es miembro" no es un error real para este flujo aditivo.
        if (miembroResp.status === 400 && /already exist/i.test(mensaje)) {
          miembrosAgregados.push(perfil.email);
        } else {
          errores.push(`Miembro ${perfil.email}: ${mensaje || miembroResp.status}`);
        }
      }
    }

    return jsonResponse({
      grupo_creado: grupoCreado,
      ms_group_id: groupId,
      ms_group_email: groupEmail,
      carpetas_creadas: carpetasCreadas,
      miembros_agregados: miembrosAgregados,
      errores,
    });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});
