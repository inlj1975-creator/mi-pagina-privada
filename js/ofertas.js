// CRUD de la tabla "ofertas" (usada en ofertas.html).

const tableBody = document.getElementById("offers-table-body");
const form = document.getElementById("offer-form");
const formError = document.getElementById("form-error");
const submitButton = document.getElementById("submit-button");
const cancelEditButton = document.getElementById("cancel-edit-button");

const idInput = document.getElementById("offer-id");
const tituloInput = document.getElementById("titulo");
const montoInput = document.getElementById("monto");
const clienteInput = document.getElementById("cliente");
const estadoInput = document.getElementById("estado");
const fechaInput = document.getElementById("fecha");
const responsableInput = document.getElementById("responsable");
const aprobadorInput = document.getElementById("aprobador");

const detalleSection = document.getElementById("detalle-section");
const detalleTableBody = document.getElementById("detalle-table-body");
const detalleForm = document.getElementById("detalle-form");
const detalleFormError = document.getElementById("detalle-form-error");
const detalleEquipoInput = document.getElementById("detalle-equipo");
const detalleEquipoTipoField = document.getElementById("detalle-equipo-tipo-field");
const detalleEquipoMarcaField = document.getElementById("detalle-equipo-marca-field");
const detalleEquipoModeloField = document.getElementById("detalle-equipo-modelo-field");
const detalleEquipoTipoInput = document.getElementById("detalle-equipo-tipo");
const detalleEquipoMarcaInput = document.getElementById("detalle-equipo-marca");
const detalleEquipoModeloInput = document.getElementById("detalle-equipo-modelo");
const detalleCantidadInput = document.getElementById("detalle-cantidad");
const detallePlazoEntregaInput = document.getElementById("detalle-plazo-entrega");
const detalleProveedorInput = document.getElementById("detalle-proveedor");
const detalleFechaInstalacionInput = document.getElementById("detalle-fecha-instalacion");
const detalleDuracionInstalacionInput = document.getElementById("detalle-duracion-instalacion");
const detalleResponsableInstalacionInput = document.getElementById("detalle-responsable-instalacion");
const detalleFechaComisionamientoInput = document.getElementById("detalle-fecha-comisionamiento");
const detalleFechaPruebasInput = document.getElementById("detalle-fecha-pruebas");
const detalleFechaPuestaServicioInput = document.getElementById("detalle-fecha-puesta-servicio");
const detalleCriterioAceptacionInput = document.getElementById("detalle-criterio-aceptacion");
const detalleInicioGarantiaInput = document.getElementById("detalle-inicio-garantia");

// Mapa id -> nombre de los clientes, para mostrar el nombre en la tabla
// sin tener que volver a consultar la base de datos por cada fila.
let clientesPorId = new Map();

// Mapas id -> email/nombre para Responsable/Aprobador (perfiles), Proveedor
// y Equipo del detalle, para mostrar el dato en las tablas sin consultas
// adicionales por fila.
let perfilesPorId = new Map();
let proveedoresPorId = new Map();
let equiposPorId = new Map();

function formatEquipoLabel(equipo) {
  return [equipo.tipo, equipo.marca, equipo.modelo].filter(Boolean).join(" — ");
}

// Ids de las ofertas (no aprobadas) que el usuario actual puede aprobar,
// según public.puede_aprobar_oferta(). Solo decide si se MUESTRA el botón
// "Aprobar" — la protección real está en la política de update de ofertas.
let ofertasAprobablesPorMi = new Set();

// Ids de ofertas que ya tienen un proyecto asociado (proyectos.oferta_id),
// para no ofrecer "Convertir en proyecto" dos veces sobre la misma oferta.
let proyectosConOfertaId = new Set();

function estadoClass(estado) {
  if (estado === "Aprobada") return "estado-completado";
  if (estado === "Rechazada") return "estado-en-curso";
  return "estado-pendiente";
}

function clearForm() {
  form.reset();
  idInput.value = "";
  submitButton.textContent = "Crear oferta";
  cancelEditButton.style.display = "none";

  const aprobadaOption = estadoInput.querySelector('option[value="Aprobada"]');
  if (aprobadaOption) aprobadaOption.remove();

  detalleSection.style.display = "none";
  detalleForm.reset();
  detalleFormError.textContent = "";
  detalleTableBody.innerHTML = "";
}

function renderOfertas(ofertas) {
  tableBody.innerHTML = "";

  for (const oferta of ofertas) {
    const row = document.createElement("tr");

    const tituloCell = document.createElement("td");
    tituloCell.textContent = oferta.titulo;

    const montoCell = document.createElement("td");
    montoCell.textContent = oferta.monto;

    const clienteCell = document.createElement("td");
    clienteCell.textContent = clientesPorId.get(oferta.cliente_id) || "(sin cliente)";

    const estadoCell = document.createElement("td");
    estadoCell.textContent = oferta.estado;
    estadoCell.className = estadoClass(oferta.estado);

    const fechaCell = document.createElement("td");
    fechaCell.textContent = oferta.fecha || "";

    const responsableCell = document.createElement("td");
    responsableCell.textContent = perfilesPorId.get(oferta.responsable_id) || "";

    const aprobadorCell = document.createElement("td");
    aprobadorCell.textContent = perfilesPorId.get(oferta.aprobador_id) || "";

    const actionsCell = document.createElement("td");
    actionsCell.className = "actions";

    const editButton = document.createElement("button");
    editButton.textContent = "Editar";
    editButton.className = "btn-secondary";
    editButton.addEventListener("click", () => startEdit(oferta));

    actionsCell.appendChild(editButton);

    if (oferta.estado !== "Aprobada" && ofertasAprobablesPorMi.has(oferta.id)) {
      const approveButton = document.createElement("button");
      approveButton.textContent = "Aprobar";
      approveButton.className = "btn-primary";
      approveButton.addEventListener("click", () => aprobarOferta(oferta.id));
      actionsCell.appendChild(approveButton);
    }

    const puedeConvertir =
      window.currentUserRole === "director_comercial" || window.currentUserRole === "gerente_general";

    if (oferta.estado === "Aprobada" && !proyectosConOfertaId.has(oferta.id) && puedeConvertir) {
      const convertButton = document.createElement("button");
      convertButton.textContent = "Convertir en proyecto";
      convertButton.className = "btn-primary";
      convertButton.addEventListener("click", () => convertirOfertaEnProyecto(oferta.id));
      actionsCell.appendChild(convertButton);
    }

    if (window.puedeBorrar) {
      const deleteButton = document.createElement("button");
      deleteButton.textContent = "Borrar";
      deleteButton.className = "btn-danger";
      deleteButton.addEventListener("click", () => deleteOferta(oferta.id));
      actionsCell.appendChild(deleteButton);
    }

    row.append(tituloCell, montoCell, clienteCell, estadoCell, fechaCell, responsableCell, aprobadorCell, actionsCell);
    tableBody.appendChild(row);
  }
}

// Confirma que la sesión ya está cargada en el cliente de Supabase antes de
// hacer cualquier petición a la base de datos (ver explicación en projects.js).
async function ensureSession() {
  const { data } = await window.supabaseClient.auth.getSession();
  return data.session;
}

async function loadClienteOptions() {
  const session = await ensureSession();
  if (!session) return;

  const { data, error } = await window.supabaseClient
    .from("clientes")
    .select("id, nombre")
    .order("nombre", { ascending: true });

  if (error) return;

  clientesPorId = new Map(data.map((cliente) => [cliente.id, cliente.nombre]));

  clienteInput.innerHTML = "";

  const sinClienteOption = document.createElement("option");
  sinClienteOption.value = "";
  sinClienteOption.textContent = "(sin cliente)";
  clienteInput.appendChild(sinClienteOption);

  for (const cliente of data) {
    const option = document.createElement("option");
    option.value = cliente.id;
    option.textContent = cliente.nombre;
    clienteInput.appendChild(option);
  }
}

// Carga perfiles una sola vez y llena los 3 selectores que apuntan a
// perfiles (Responsable y Aprobador de la oferta, Responsable de
// instalación del detalle) — mismo patrón que loadPerfilesOptions en
// tareas.js, adaptado para varios <select> a la vez.
async function loadPerfilesOptions() {
  const session = await ensureSession();
  if (!session) return;

  const { data, error } = await window.supabaseClient
    .from("perfiles")
    .select("id, email")
    .order("email", { ascending: true });

  if (error) return;

  perfilesPorId = new Map(data.map((p) => [p.id, p.email]));

  for (const select of [responsableInput, aprobadorInput, detalleResponsableInstalacionInput]) {
    select.innerHTML = "";

    const sinOpcion = document.createElement("option");
    sinOpcion.value = "";
    sinOpcion.textContent = "(sin responsable)";
    select.appendChild(sinOpcion);

    for (const perfil of data) {
      const option = document.createElement("option");
      option.value = perfil.id;
      option.textContent = perfil.email;
      select.appendChild(option);
    }
  }
}

async function loadProveedorOptions() {
  const session = await ensureSession();
  if (!session) return;

  const { data, error } = await window.supabaseClient
    .from("proveedores")
    .select("id, nombre")
    .order("nombre", { ascending: true });

  if (error) return;

  proveedoresPorId = new Map(data.map((proveedor) => [proveedor.id, proveedor.nombre]));

  detalleProveedorInput.innerHTML = "";

  const sinProveedorOption = document.createElement("option");
  sinProveedorOption.value = "";
  sinProveedorOption.textContent = "(sin proveedor)";
  detalleProveedorInput.appendChild(sinProveedorOption);

  for (const proveedor of data) {
    const option = document.createElement("option");
    option.value = proveedor.id;
    option.textContent = proveedor.nombre;
    detalleProveedorInput.appendChild(option);
  }
}

async function loadEquipoOptions() {
  const session = await ensureSession();
  if (!session) return;

  const { data, error } = await window.supabaseClient
    .from("equipos")
    .select("id, tipo, marca, modelo")
    .order("tipo", { ascending: true });

  if (error) return;

  equiposPorId = new Map(data.map((equipo) => [equipo.id, formatEquipoLabel(equipo)]));

  detalleEquipoInput.innerHTML = "";

  for (const equipo of data) {
    const option = document.createElement("option");
    option.value = equipo.id;
    option.textContent = formatEquipoLabel(equipo);
    detalleEquipoInput.appendChild(option);
  }

  const nuevoOption = document.createElement("option");
  nuevoOption.value = "__nuevo__";
  nuevoOption.textContent = "+ Crear equipo nuevo";
  detalleEquipoInput.appendChild(nuevoOption);

  toggleEquipoNuevoFields();
}

function toggleEquipoNuevoFields() {
  const esNuevo = detalleEquipoInput.value === "__nuevo__";
  detalleEquipoTipoField.style.display = esNuevo ? "" : "none";
  detalleEquipoMarcaField.style.display = esNuevo ? "" : "none";
  detalleEquipoModeloField.style.display = esNuevo ? "" : "none";
}

detalleEquipoInput.addEventListener("change", toggleEquipoNuevoFields);

function renderDetalleOfertas(lineas) {
  detalleTableBody.innerHTML = "";

  for (const linea of lineas) {
    const row = document.createElement("tr");

    const equipoCell = document.createElement("td");
    equipoCell.textContent = equiposPorId.get(linea.equipo_id) || "(sin equipo)";

    const cantidadCell = document.createElement("td");
    cantidadCell.textContent = linea.cantidad ?? "";

    const proveedorCell = document.createElement("td");
    proveedorCell.textContent = proveedoresPorId.get(linea.proveedor_id) || "";

    const fechaInstalacionCell = document.createElement("td");
    fechaInstalacionCell.textContent = linea.fecha_instalacion || "";

    const responsableInstalacionCell = document.createElement("td");
    responsableInstalacionCell.textContent = perfilesPorId.get(linea.responsable_instalacion_id) || "";

    const actionsCell = document.createElement("td");
    actionsCell.className = "actions";

    if (window.puedeBorrar) {
      const deleteButton = document.createElement("button");
      deleteButton.textContent = "Borrar";
      deleteButton.className = "btn-danger";
      deleteButton.addEventListener("click", () => deleteDetalleLinea(linea.id));
      actionsCell.appendChild(deleteButton);
    }

    row.append(equipoCell, cantidadCell, proveedorCell, fechaInstalacionCell, responsableInstalacionCell, actionsCell);
    detalleTableBody.appendChild(row);
  }
}

async function loadDetalleOfertas(ofertaId) {
  const session = await ensureSession();
  if (!session) return;

  const { data, error } = await window.supabaseClient
    .from("detalle_ofertas")
    .select("*")
    .eq("oferta_id", ofertaId)
    .order("created_at", { ascending: true });

  if (error) {
    detalleFormError.textContent = "No se pudo cargar el detalle de la oferta.";
    return;
  }

  renderDetalleOfertas(data);
}

async function deleteDetalleLinea(id) {
  const confirmed = confirm("¿Seguro que quieres borrar esta línea de detalle?");
  if (!confirmed) return;

  const session = await ensureSession();
  if (!session) {
    detalleFormError.textContent = "Tu sesión expiró. Vuelve a iniciar sesión.";
    return;
  }

  const { error } = await window.supabaseClient.from("detalle_ofertas").delete().eq("id", id);

  if (error) {
    detalleFormError.textContent = "No se pudo borrar la línea de detalle.";
    return;
  }

  loadDetalleOfertas(idInput.value);
}

detalleForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  detalleFormError.textContent = "";

  const ofertaId = idInput.value;
  if (!ofertaId) return;

  const session = await ensureSession();
  if (!session) {
    detalleFormError.textContent = "Tu sesión expiró. Vuelve a iniciar sesión.";
    return;
  }

  let equipoId = detalleEquipoInput.value;

  if (equipoId === "__nuevo__") {
    if (!detalleEquipoTipoInput.value) {
      detalleFormError.textContent = "El tipo de equipo es obligatorio para crear un equipo nuevo.";
      return;
    }

    const { data: nuevoEquipo, error: equipoError } = await window.supabaseClient
      .from("equipos")
      .insert({
        tipo: detalleEquipoTipoInput.value,
        marca: detalleEquipoMarcaInput.value || null,
        modelo: detalleEquipoModeloInput.value || null,
      })
      .select()
      .single();

    if (equipoError) {
      detalleFormError.textContent = "No se pudo crear el equipo.";
      return;
    }

    equipoId = nuevoEquipo.id;
    await loadEquipoOptions();
  }

  const payload = {
    oferta_id: ofertaId,
    equipo_id: equipoId || null,
    cantidad: detalleCantidadInput.value || null,
    plazo_entrega_dias: detallePlazoEntregaInput.value || null,
    proveedor_id: detalleProveedorInput.value || null,
    fecha_instalacion: detalleFechaInstalacionInput.value || null,
    duracion_instalacion: detalleDuracionInstalacionInput.value || null,
    responsable_instalacion_id: detalleResponsableInstalacionInput.value || null,
    fecha_comisionamiento: detalleFechaComisionamientoInput.value || null,
    fecha_pruebas: detalleFechaPruebasInput.value || null,
    fecha_puesta_servicio: detalleFechaPuestaServicioInput.value || null,
    criterio_aceptacion: detalleCriterioAceptacionInput.value || null,
    inicio_garantia: detalleInicioGarantiaInput.value || null,
  };

  const { error } = await window.supabaseClient.from("detalle_ofertas").insert(payload);

  if (error) {
    detalleFormError.textContent = "No se pudo guardar la línea de detalle.";
    return;
  }

  detalleForm.reset();
  toggleEquipoNuevoFields();
  loadDetalleOfertas(ofertaId);
});

// Para cada oferta todavía no aprobada, pregunta vía RPC si el usuario
// actual puede aprobarla, y guarda los ids permitidos en
// ofertasAprobablesPorMi (usado solo para decidir si se muestra el botón).
async function loadAprobables(ofertas) {
  ofertasAprobablesPorMi = new Set();

  const pendientes = ofertas.filter((oferta) => oferta.estado !== "Aprobada");

  const resultados = await Promise.all(
    pendientes.map((oferta) =>
      window.supabaseClient.rpc("puede_aprobar_oferta", { oferta_id: oferta.id })
    )
  );

  let huboError = false;

  pendientes.forEach((oferta, i) => {
    const { data, error } = resultados[i];

    if (error) {
      huboError = true;
      console.error("puede_aprobar_oferta:", error);
      return;
    }

    if (data === true) {
      ofertasAprobablesPorMi.add(oferta.id);
    }
  });

  if (huboError) {
    formError.textContent = "No se pudo verificar quién puede aprobar (revisa la consola).";
  }
}

// Consulta simple: qué ofertas ya tienen un proyecto creado a partir de
// ellas, para no ofrecer convertirlas de nuevo.
async function loadProyectosConvertidos() {
  const session = await ensureSession();
  if (!session) return;

  const { data, error } = await window.supabaseClient
    .from("proyectos")
    .select("oferta_id")
    .not("oferta_id", "is", null);

  if (error) return;

  proyectosConOfertaId = new Set(data.map((proyecto) => proyecto.oferta_id));
}

async function loadOfertas() {
  const session = await ensureSession();
  if (!session) return;

  const { data, error } = await window.supabaseClient
    .from("ofertas")
    .select("*")
    .order("fecha", { ascending: false });

  if (error) {
    formError.textContent = "No se pudieron cargar las ofertas.";
    return;
  }

  await loadAprobables(data);
  await loadProyectosConvertidos();
  renderOfertas(data);
}

function startEdit(oferta) {
  idInput.value = oferta.id;
  tituloInput.value = oferta.titulo;
  montoInput.value = oferta.monto;
  clienteInput.value = oferta.cliente_id || "";

  // "Aprobada" ya no es elegible a mano (solo vía el botón "Aprobar"), así
  // que no existe como <option> fija. Si la oferta ya está Aprobada, se
  // agrega aquí una opción deshabilitada solo para mostrar el valor actual
  // sin perderlo; no se puede volver a elegir desde la lista desplegada.
  if (oferta.estado === "Aprobada" && !estadoInput.querySelector('option[value="Aprobada"]')) {
    const aprobadaOption = document.createElement("option");
    aprobadaOption.value = "Aprobada";
    aprobadaOption.textContent = "Aprobada";
    aprobadaOption.disabled = true;
    estadoInput.appendChild(aprobadaOption);
  }

  estadoInput.value = oferta.estado;
  fechaInput.value = oferta.fecha || "";
  responsableInput.value = oferta.responsable_id || "";
  aprobadorInput.value = oferta.aprobador_id || "";

  submitButton.textContent = "Guardar cambios";
  cancelEditButton.style.display = "inline-block";

  detalleSection.style.display = "";
  detalleForm.reset();
  toggleEquipoNuevoFields();
  loadDetalleOfertas(oferta.id);
}

async function aprobarOferta(id) {
  const confirmed = confirm("¿Confirmas que quieres aprobar esta oferta?");
  if (!confirmed) return;

  const session = await ensureSession();
  if (!session) {
    formError.textContent = "Tu sesión expiró. Vuelve a iniciar sesión.";
    return;
  }

  const { error } = await window.supabaseClient
    .from("ofertas")
    .update({ estado: "Aprobada" })
    .eq("id", id);

  if (error) {
    formError.textContent = "No se pudo aprobar la oferta.";
    return;
  }

  loadOfertas();
}

async function convertirOfertaEnProyecto(id) {
  const confirmed = confirm("¿Convertir esta oferta en un proyecto nuevo?");
  if (!confirmed) return;

  const session = await ensureSession();
  if (!session) {
    formError.textContent = "Tu sesión expiró. Vuelve a iniciar sesión.";
    return;
  }

  const { error } = await window.supabaseClient.rpc("convertir_oferta_en_proyecto", {
    oferta_id: id,
  });

  // Acá sí mostramos error.message directo: la función fue diseñada para
  // lanzar un mensaje claro (sin permiso, ya convertida, etc.) y ese
  // mensaje es justamente lo que la persona necesita ver.
  if (error) {
    formError.textContent = error.message;
    return;
  }

  loadOfertas();
}

async function deleteOferta(id) {
  const confirmed = confirm("¿Seguro que quieres borrar esta oferta?");
  if (!confirmed) return;

  const session = await ensureSession();
  if (!session) {
    formError.textContent = "Tu sesión expiró. Vuelve a iniciar sesión.";
    return;
  }

  const { error } = await window.supabaseClient
    .from("ofertas")
    .delete()
    .eq("id", id);

  if (error) {
    formError.textContent = "No se pudo borrar la oferta.";
    return;
  }

  loadOfertas();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formError.textContent = "";

  const session = await ensureSession();
  if (!session) {
    formError.textContent = "Tu sesión expiró. Vuelve a iniciar sesión.";
    return;
  }

  const payload = {
    titulo: tituloInput.value,
    monto: montoInput.value,
    cliente_id: clienteInput.value || null,
    estado: estadoInput.value,
    fecha: fechaInput.value || null,
    responsable_id: responsableInput.value || null,
    aprobador_id: aprobadorInput.value || null,
  };

  const editingId = idInput.value;

  const { error } = editingId
    ? await window.supabaseClient.from("ofertas").update(payload).eq("id", editingId)
    : await window.supabaseClient.from("ofertas").insert(payload);

  if (error) {
    formError.textContent = "No se pudo guardar la oferta.";
    return;
  }

  clearForm();
  loadOfertas();
});

cancelEditButton.addEventListener("click", clearForm);

async function init() {
  await window.authReady;
  await loadClienteOptions();
  await loadPerfilesOptions();
  await loadProveedorOptions();
  await loadEquipoOptions();
  await loadOfertas();
}

init();
