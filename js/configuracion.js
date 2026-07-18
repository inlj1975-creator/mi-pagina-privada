// Conexión de la cuenta de Microsoft Outlook del usuario actual (usada en
// configuracion.html). Guarda/borra la fila propia en "ms_conexiones";
// el intercambio real del código OAuth por tokens ocurre en la Edge
// Function "ms-oauth-exchange" (invocada desde oauth-callback.js), nunca acá.

const estadoBadge = document.getElementById("ms-estado-badge");
const connectButton = document.getElementById("ms-connect-button");
const disconnectButton = document.getElementById("ms-disconnect-button");
const errorEl = document.getElementById("ms-error");

async function ensureSession() {
  const { data } = await window.supabaseClient.auth.getSession();
  return data.session;
}

async function cargarEstado() {
  const session = await ensureSession();
  if (!session) return;

  const { data, error } = await window.supabaseClient
    .from("ms_conexiones")
    .select("updated_at")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error) {
    errorEl.textContent = "No se pudo consultar el estado de la conexión.";
    return;
  }

  if (data) {
    estadoBadge.textContent = "Conectado";
    estadoBadge.className = "badge badge-completado";
    connectButton.style.display = "none";
    disconnectButton.style.display = "inline-block";
  } else {
    estadoBadge.textContent = "No conectado";
    estadoBadge.className = "badge badge-gris";
    connectButton.style.display = "inline-block";
    disconnectButton.style.display = "none";
  }
}

connectButton.addEventListener("click", () => {
  // "state" evita que otra página redirija a la vuelta de Microsoft en
  // nombre de otro usuario (CSRF básico): se genera acá y se vuelve a
  // comprobar en oauth-callback.js.
  const state = crypto.randomUUID();
  sessionStorage.setItem("ms_oauth_state", state);

  const params = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    response_type: "code",
    redirect_uri: MS_REDIRECT_URI,
    response_mode: "query",
    scope: "offline_access Calendars.ReadWrite Group.ReadWrite.All",
    state,
  });

  window.location.href =
    `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/authorize?${params.toString()}`;
});

disconnectButton.addEventListener("click", async () => {
  const confirmed = confirm("¿Desconectar tu cuenta de Outlook? Las tareas dejarán de sincronizarse.");
  if (!confirmed) return;

  const session = await ensureSession();
  if (!session) return;

  const { error } = await window.supabaseClient
    .from("ms_conexiones")
    .delete()
    .eq("user_id", session.user.id);

  if (error) {
    errorEl.textContent = "No se pudo desconectar la cuenta.";
    return;
  }

  cargarEstado();
});

function mostrarMensajeDeRegreso() {
  const params = new URLSearchParams(window.location.search);
  const ms = params.get("ms");

  if (ms === "conectado") {
    errorEl.style.color = "#16a34a";
    errorEl.textContent = "¡Cuenta de Outlook conectada correctamente!";
  } else if (ms === "error") {
    errorEl.style.color = "";
    errorEl.textContent = params.get("msg") || "No se pudo conectar la cuenta de Outlook.";
  }

  if (ms) {
    window.history.replaceState({}, "", "configuracion.html");
  }
}

async function init() {
  await window.authReady;
  mostrarMensajeDeRegreso();
  await cargarEstado();
}

init();
