// Ficha de solo lectura de un proyecto (usada en proyecto.html).
// El id del proyecto viene en la URL como ?id=... (query string).

const errorMessage = document.getElementById("proyecto-error");
const detalle = document.getElementById("proyecto-detalle");

const nombreEl = document.getElementById("proyecto-nombre");
const descripcionEl = document.getElementById("proyecto-descripcion");
const estadoEl = document.getElementById("proyecto-estado");
const fechaEl = document.getElementById("proyecto-fecha");

const clienteDetalle = document.getElementById("cliente-detalle");
const sinCliente = document.getElementById("sin-cliente");
const clienteNombreEl = document.getElementById("cliente-nombre");
const clienteEmailEl = document.getElementById("cliente-email");
const clienteTelefonoEl = document.getElementById("cliente-telefono");
const clienteEmpresaEl = document.getElementById("cliente-empresa");

const tareasTabla = document.getElementById("tareas-tabla");
const tareasTbody = document.getElementById("tareas-tbody");
const sinTareas = document.getElementById("sin-tareas");

const facturasTabla = document.getElementById("facturas-tabla");
const facturasTbody = document.getElementById("facturas-tbody");
const sinFacturas = document.getElementById("sin-facturas");

async function ensureSession() {
  const { data } = await window.supabaseClient.auth.getSession();
  return data.session;
}

function mostrarError(mensaje) {
  errorMessage.textContent = mensaje;
  detalle.style.display = "none";
}

function renderProyecto(proyecto) {
  nombreEl.textContent = proyecto.nombre;
  descripcionEl.textContent = proyecto.descripcion || "";
  estadoEl.textContent = proyecto.estado;
  fechaEl.textContent = proyecto.fecha || "";
}

function renderCliente(cliente) {
  clienteNombreEl.textContent = cliente.nombre;
  clienteEmailEl.textContent = cliente.email || "";
  clienteTelefonoEl.textContent = cliente.telefono || "";
  clienteEmpresaEl.textContent = cliente.empresa || "";
}

function renderTareas(tareas, perfilesPorId) {
  if (tareas.length === 0) {
    tareasTabla.style.display = "none";
    sinTareas.style.display = "block";
    return;
  }

  tareasTbody.innerHTML = "";

  for (const tarea of tareas) {
    const row = document.createElement("tr");

    const tituloCell = document.createElement("td");
    tituloCell.textContent = tarea.titulo;

    const estadoCell = document.createElement("td");
    estadoCell.textContent = tarea.estado;

    const responsableCell = document.createElement("td");
    if (tarea.responsable_id && perfilesPorId.has(tarea.responsable_id)) {
      responsableCell.textContent = perfilesPorId.get(tarea.responsable_id);
    } else if (tarea.responsable_nombre) {
      responsableCell.textContent = tarea.responsable_nombre + " (sin usuario vinculado)";
    } else {
      responsableCell.textContent = "";
    }

    const inicioCell = document.createElement("td");
    inicioCell.textContent = tarea.fecha_inicio || "";

    const terminoCell = document.createElement("td");
    terminoCell.textContent = tarea.fecha_termino || "";

    row.append(tituloCell, estadoCell, responsableCell, inicioCell, terminoCell);
    tareasTbody.appendChild(row);
  }
}

async function loadTareas(proyectoId) {
  const session = await ensureSession();
  if (!session) return;

  const [{ data: tareas, error }, { data: perfiles }] = await Promise.all([
    window.supabaseClient
      .from("tareas")
      .select("titulo, estado, responsable_id, responsable_nombre, fecha_inicio, fecha_termino")
      .eq("proyecto_id", proyectoId),
    window.supabaseClient
      .from("perfiles")
      .select("id, email"),
  ]);

  if (error || !tareas) return;

  const perfilesPorId = new Map((perfiles || []).map((p) => [p.id, p.email]));
  renderTareas(tareas, perfilesPorId);
}

function renderFacturas(facturas) {
  if (facturas.length === 0) {
    facturasTabla.style.display = "none";
    sinFacturas.style.display = "block";
    return;
  }

  facturasTbody.innerHTML = "";

  for (const factura of facturas) {
    const row = document.createElement("tr");

    const numeroCell = document.createElement("td");
    numeroCell.textContent = factura.numero;

    const montoCell = document.createElement("td");
    montoCell.textContent = factura.monto;

    const estadoCell = document.createElement("td");
    estadoCell.textContent = factura.estado;

    const fechaCell = document.createElement("td");
    fechaCell.textContent = factura.fecha || "";

    row.append(numeroCell, montoCell, estadoCell, fechaCell);
    facturasTbody.appendChild(row);
  }
}

async function loadFacturas(proyectoId) {
  const session = await ensureSession();
  if (!session) return;

  const { data, error } = await window.supabaseClient
    .from("facturas")
    .select("numero, monto, estado, fecha")
    .eq("proyecto_id", proyectoId);

  if (error || !data) return;

  renderFacturas(data);
}

async function init() {
  await window.authReady;

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (!id) {
    mostrarError("No se especificó un proyecto.");
    return;
  }

  const session = await ensureSession();
  if (!session) return;

  const { data: proyecto, error } = await window.supabaseClient
    .from("proyectos")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !proyecto) {
    mostrarError("Proyecto no encontrado.");
    return;
  }

  renderProyecto(proyecto);

  if (proyecto.cliente_id) {
    const { data: cliente } = await window.supabaseClient
      .from("clientes")
      .select("nombre, email, telefono, empresa")
      .eq("id", proyecto.cliente_id)
      .maybeSingle();

    if (cliente) {
      renderCliente(cliente);
    } else {
      clienteDetalle.style.display = "none";
      sinCliente.style.display = "block";
    }
  } else {
    clienteDetalle.style.display = "none";
    sinCliente.style.display = "block";
  }

  await loadTareas(proyecto.id);
  await loadFacturas(proyecto.id);
}

init();
