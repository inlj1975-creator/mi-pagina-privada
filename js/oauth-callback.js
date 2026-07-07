// Destino del redirect_uri de Microsoft (oauth-callback.html). Recibe el
// "code" de vuelta, lo valida, y se lo pasa a la Edge Function
// "ms-oauth-exchange" para que lo cambie por tokens (eso requiere el
// client_secret, que nunca puede tocar esta página). Después vuelve a
// configuracion.html mostrando el resultado.

function volverAConfiguracion(resultado, mensaje) {
  const params = new URLSearchParams({ ms: resultado });
  if (mensaje) params.set("msg", mensaje);
  window.location.href = `configuracion.html?${params.toString()}`;
}

async function procesarCallback() {
  const mensajeEl = document.getElementById("oauth-callback-mensaje");
  const params = new URLSearchParams(window.location.search);

  const errorMicrosoft = params.get("error");
  if (errorMicrosoft) {
    volverAConfiguracion("error", params.get("error_description") || "Conexión cancelada.");
    return;
  }

  const code = params.get("code");
  const state = params.get("state");
  const stateGuardado = sessionStorage.getItem("ms_oauth_state");
  sessionStorage.removeItem("ms_oauth_state");

  if (!code || !state || state !== stateGuardado) {
    volverAConfiguracion("error", "No se pudo validar la respuesta de Microsoft. Intentá de nuevo.");
    return;
  }

  mensajeEl.textContent = "Confirmando la conexión con Microsoft…";

  const { error } = await window.supabaseClient.functions.invoke("ms-oauth-exchange", {
    body: { code, redirect_uri: MS_REDIRECT_URI },
  });

  if (error) {
    volverAConfiguracion("error", "No se pudo completar la conexión con Outlook.");
    return;
  }

  volverAConfiguracion("conectado");
}

async function init() {
  await window.authReady;
  procesarCallback();
}

init();
