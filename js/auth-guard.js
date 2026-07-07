// Guardia de acceso para las páginas privadas (proyectos.html, clientes.html).
// Nota importante: esto solo mejora la experiencia (redirige si no hay sesión,
// decide qué botones mostrar). La protección REAL de los datos la da Row
// Level Security en Supabase, así que aunque alguien se saltara este script,
// no podría leer/escribir las tablas sin sesión, ni borrar sin ser admin.

// Otras páginas (projects.js, clients.js) esperan esta promesa antes de
// pintar nada que dependa de la sesión o del rol, para evitar la misma
// condición de carrera que ya resolvimos con ensureSession().
window.authReady = (async function checkSession() {
  const { data } = await window.supabaseClient.auth.getSession();

  if (!data.session) {
    window.location.href = "index.html";
    return;
  }

  document.getElementById("user-email").textContent = data.session.user.email;

  // .maybeSingle() en vez de .single(): si todavía no existe la fila en
  // "perfiles" para este usuario, no falla, simplemente no hay rol asignado
  // (se trata como no-admin por defecto).
  const { data: perfil } = await window.supabaseClient
    .from("perfiles")
    .select("rol")
    .eq("id", data.session.user.id)
    .maybeSingle();

  window.currentUserRole = perfil ? perfil.rol : null;
  window.puedeBorrar = ["admin", "director_comercial", "gerente_general"].includes(window.currentUserRole);
})();

document.getElementById("logout-button").addEventListener("click", async () => {
  await window.supabaseClient.auth.signOut();
  window.location.href = "index.html";
});
