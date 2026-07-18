// Ficha de solo lectura de un proyecto (usada en proyecto.html).
// El id del proyecto viene en la URL como ?id=... (query string).

const errorMessage = document.getElementById("proyecto-error");
const detalle = document.getElementById("proyecto-detalle");

const nombreEl = document.getElementById("proyecto-nombre");
const descripcionEl = document.getElementById("proyecto-descripcion");
const estadoEl = document.getElementById("proyecto-estado");
const fechaEl = document.getElementById("proyecto-fecha");
const tipoEl = document.getElementById("proyecto-tipo");
const filialClienteEl = document.getElementById("proyecto-filial-cliente");
const responsableComercialEl = document.getElementById("proyecto-responsable-comercial");
const pmEl = document.getElementById("proyecto-pm");
const valorVentaEl = document.getElementById("proyecto-valor-venta");
const valorCostoEl = document.getElementById("proyecto-valor-costo");
const rentabilidadEl = document.getElementById("proyecto-rentabilidad");
const condPagoEl = document.getElementById("proyecto-cond-pago");
const fechaKickoffEl = document.getElementById("proyecto-fecha-kickoff");
const plazoDiasEl = document.getElementById("proyecto-plazo-dias");
const fechaInicioRealEl = document.getElementById("proyecto-fecha-inicio-real");
const fechaTerminoRealEl = document.getElementById("proyecto-fecha-termino-real");
const contactoNombreEl = document.getElementById("proyecto-contacto-nombre");
const contactoEmailEl = document.getElementById("proyecto-contacto-email");
const contactoTelefonoEl = document.getElementById("proyecto-contacto-telefono");
const frecuenciaEl = document.getElementById("proyecto-frecuencia");
const direccionInstalacionEl = document.getElementById("proyecto-direccion-instalacion");

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

const equiposSection = document.getElementById("equipos-section");
const equiposTabla = document.getElementById("equipos-tabla");
const equiposTbody = document.getElementById("equipos-tbody");
const sinEquipos = document.getElementById("sin-equipos");

function formatEquipoLabel(equipo) {
  if (!equipo) return "(sin equipo)";
  return [equipo.tipo, equipo.marca, equipo.modelo].filter(Boolean).join(" — ");
}

async function ensureSession() {
  const { data } = await window.supabaseClient.auth.getSession();
  return data.session;
}

function mostrarError(mensaje) {
  errorMessage.textContent = mensaje;
  detalle.style.display = "none";
}

function renderProyecto(proyecto, perfilesPorId) {
  nombreEl.textContent = proyecto.nombre;
  descripcionEl.textContent = proyecto.descripcion || "";
  estadoEl.textContent = proyecto.estado;
  fechaEl.textContent = proyecto.fecha || "";

  tipoEl.textContent = proyecto.tipo_proyecto || "(sin definir)";
  filialClienteEl.textContent = proyecto.filial_cliente || "";

  responsableComercialEl.textContent = perfilesPorId.get(proyecto.responsable_comercial_id) || "(sin asignar)";
  pmEl.textContent = perfilesPorId.get(proyecto.project_manager_id) || "(sin asignar)";
  valorVentaEl.textContent = proyecto.valor_venta != null ? proyecto.valor_venta : "";
  valorCostoEl.textContent = proyecto.valor_costo != null ? proyecto.valor_costo : "";
  rentabilidadEl.textContent = proyecto.rentabilidad_esperada != null ? proyecto.rentabilidad_esperada + "%" : "(no calculable)";
  condPagoEl.textContent = proyecto.cond_pago || "";

  fechaKickoffEl.textContent = proyecto.fecha_kickoff || "";
  plazoDiasEl.textContent = proyecto.plazo_dias != null ? proyecto.plazo_dias + " días" : "";
  fechaInicioRealEl.textContent = proyecto.fecha_inicio_real || "";
  fechaTerminoRealEl.textContent = proyecto.fecha_termino_real || "";

  contactoNombreEl.textContent = proyecto.contacto_nombre || "";
  contactoEmailEl.textContent = proyecto.contacto_email || "";
  contactoTelefonoEl.textContent = proyecto.contacto_telefono || "";
  frecuenciaEl.textContent = proyecto.frecuencia_comunicacion || "";

  direccionInstalacionEl.textContent = proyecto.direccion_instalacion || "";
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

function renderEquipos(lineas, equiposPorId, proveedoresPorId, perfilesPorId) {
  if (lineas.length === 0) {
    equiposTabla.style.display = "none";
    sinEquipos.style.display = "block";
    return;
  }

  equiposTbody.innerHTML = "";

  for (const linea of lineas) {
    const row = document.createElement("tr");

    const equipoCell = document.createElement("td");
    equipoCell.textContent = equiposPorId.get(linea.equipo_id) || "(sin equipo)";

    const cantidadCell = document.createElement("td");
    cantidadCell.textContent = linea.cantidad ?? "";

    const plazoEntregaCell = document.createElement("td");
    plazoEntregaCell.textContent = linea.plazo_entrega_dias ?? "";

    const proveedorCell = document.createElement("td");
    proveedorCell.textContent = proveedoresPorId.get(linea.proveedor_id) || "";

    const fechaInstalacionCell = document.createElement("td");
    fechaInstalacionCell.textContent = linea.fecha_instalacion || "";

    const duracionInstalacionCell = document.createElement("td");
    duracionInstalacionCell.textContent = linea.duracion_instalacion || "";

    const responsableCell = document.createElement("td");
    responsableCell.textContent = perfilesPorId.get(linea.responsable_instalacion_id) || "";

    const fechaComisionamientoCell = document.createElement("td");
    fechaComisionamientoCell.textContent = linea.fecha_comisionamiento || "";

    const fechaPruebasCell = document.createElement("td");
    fechaPruebasCell.textContent = linea.fecha_pruebas || "";

    const fechaPuestaServicioCell = document.createElement("td");
    fechaPuestaServicioCell.textContent = linea.fecha_puesta_servicio || "";

    const criterioAceptacionCell = document.createElement("td");
    criterioAceptacionCell.textContent = linea.criterio_aceptacion || "";

    const inicioGarantiaCell = document.createElement("td");
    inicioGarantiaCell.textContent = linea.inicio_garantia || "";

    row.append(
      equipoCell,
      cantidadCell,
      plazoEntregaCell,
      proveedorCell,
      fechaInstalacionCell,
      duracionInstalacionCell,
      responsableCell,
      fechaComisionamientoCell,
      fechaPruebasCell,
      fechaPuestaServicioCell,
      criterioAceptacionCell,
      inicioGarantiaCell
    );
    equiposTbody.appendChild(row);
  }
}

async function loadEquipoDetalle(ofertaId) {
  const session = await ensureSession();
  if (!session) return;

  const [{ data: lineas, error }, { data: equipos }, { data: proveedores }, { data: perfiles }] = await Promise.all([
    window.supabaseClient
      .from("detalle_ofertas")
      .select("*")
      .eq("oferta_id", ofertaId),
    window.supabaseClient.from("equipos").select("id, tipo, marca, modelo"),
    window.supabaseClient.from("proveedores").select("id, nombre"),
    window.supabaseClient.from("perfiles").select("id, email"),
  ]);

  if (error || !lineas) return;

  const equiposPorId = new Map((equipos || []).map((e) => [e.id, formatEquipoLabel(e)]));
  const proveedoresPorId = new Map((proveedores || []).map((p) => [p.id, p.nombre]));
  const perfilesPorId = new Map((perfiles || []).map((p) => [p.id, p.email]));

  renderEquipos(lineas, equiposPorId, proveedoresPorId, perfilesPorId);
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

  const { data: perfiles } = await window.supabaseClient.from("perfiles").select("id, email");
  const perfilesPorId = new Map((perfiles || []).map((p) => [p.id, p.email]));

  renderProyecto(proyecto, perfilesPorId);

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

  if (proyecto.oferta_id) {
    equiposSection.style.display = "";
    await loadEquipoDetalle(proyecto.oferta_id);
  }
}

init();
