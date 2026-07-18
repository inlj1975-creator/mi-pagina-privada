// Tablero visual de proyectos (usado en proyectos-tablero.html).
// Solo lectura: cada tarjeta lleva a la ficha proyecto.html?id=...

const grid = document.getElementById("tablero-grid");
const errorMessage = document.getElementById("tablero-error");

async function ensureSession() {
  const { data } = await window.supabaseClient.auth.getSession();
  return data.session;
}

function badgeClass(estado) {
  return estado === "Cerrado" ? "badge-cerrado" : "badge-abierto";
}

function renderTablero(proyectos, clientesPorId, tareasPorProyecto, facturasPorProyecto) {
  grid.innerHTML = "";

  if (proyectos.length === 0) {
    const msg = document.createElement("p");
    msg.className = "tablero-vacio";
    msg.textContent = "No hay proyectos todavía.";
    grid.appendChild(msg);
    return;
  }

  for (const proyecto of proyectos) {
    const card = document.createElement("div");
    card.className = "tablero-card";
    card.addEventListener("click", () => {
      window.location.href = "proyecto.html?id=" + proyecto.id;
    });

    const header = document.createElement("div");
    header.className = "tablero-card-header";

    const titulo = document.createElement("h3");
    titulo.textContent = proyecto.nombre;

    const badge = document.createElement("span");
    badge.className = "badge " + badgeClass(proyecto.estado);
    badge.textContent = proyecto.estado;

    header.append(titulo, badge);

    const clienteP = document.createElement("p");
    clienteP.className = "tablero-cliente";
    clienteP.textContent = "Cliente: " + (clientesPorId.get(proyecto.cliente_id) || "(sin cliente)");

    const nTareas = tareasPorProyecto.get(proyecto.id) || 0;
    const nFacturas = facturasPorProyecto.get(proyecto.id) || 0;

    const resumenP = document.createElement("p");
    resumenP.className = "tablero-resumen";
    resumenP.textContent = `${nTareas} tareas · ${nFacturas} facturas`;

    card.append(header, clienteP, resumenP);
    grid.appendChild(card);
  }
}

// Cuenta cuántas filas de "filas" tienen cada valor de proyecto_id,
// recorriendo la lista una sola vez (en vez de una consulta por proyecto).
function contarPorProyecto(filas) {
  const conteo = new Map();

  for (const fila of filas) {
    if (!fila.proyecto_id) continue;
    conteo.set(fila.proyecto_id, (conteo.get(fila.proyecto_id) || 0) + 1);
  }

  return conteo;
}

async function loadTablero() {
  const session = await ensureSession();
  if (!session) return;

  const [
    { data: proyectos, error: errorProyectos },
    { data: clientes },
    { data: tareas },
    { data: facturas },
  ] = await Promise.all([
    window.supabaseClient.from("proyectos").select("*").order("fecha", { ascending: false }),
    window.supabaseClient.from("clientes").select("id, nombre"),
    window.supabaseClient.from("tareas").select("proyecto_id"),
    window.supabaseClient.from("facturas").select("proyecto_id"),
  ]);

  if (errorProyectos) {
    errorMessage.textContent = "No se pudieron cargar los proyectos.";
    return;
  }

  const clientesPorId = new Map((clientes || []).map((cliente) => [cliente.id, cliente.nombre]));
  const tareasPorProyecto = contarPorProyecto(tareas || []);
  const facturasPorProyecto = contarPorProyecto(facturas || []);

  renderTablero(proyectos, clientesPorId, tareasPorProyecto, facturasPorProyecto);
}

async function init() {
  await window.authReady;
  await loadTablero();
}

init();
