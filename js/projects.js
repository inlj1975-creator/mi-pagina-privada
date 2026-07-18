// CRUD de la tabla "proyectos" (usada en proyectos.html).

const tableBody = document.getElementById("projects-table-body");
const form = document.getElementById("project-form");
const formError = document.getElementById("form-error");
const submitButton = document.getElementById("submit-button");
const cancelEditButton = document.getElementById("cancel-edit-button");

const idInput = document.getElementById("project-id");
const nombreInput = document.getElementById("nombre");
const descripcionInput = document.getElementById("descripcion");
const estadoInput = document.getElementById("estado");
const fechaInput = document.getElementById("fecha");
const clienteInput = document.getElementById("cliente");
const tipoProyectoInput = document.getElementById("tipo-proyecto");
const filialClienteInput = document.getElementById("filial-cliente");
const responsableComercialInput = document.getElementById("responsable-comercial");
const projectManagerInput = document.getElementById("project-manager");
const contactoNombreInput = document.getElementById("contacto-nombre");
const contactoEmailInput = document.getElementById("contacto-email");
const contactoTelefonoInput = document.getElementById("contacto-telefono");
const frecuenciaComunicacionInput = document.getElementById("frecuencia-comunicacion");
const fechaKickoffInput = document.getElementById("fecha-kickoff");
const plazoDiasInput = document.getElementById("plazo-dias");
const valorVentaInput = document.getElementById("valor-venta");
const valorCostoInput = document.getElementById("valor-costo");
const direccionInstalacionInput = document.getElementById("direccion-instalacion");
const fechaInicioRealInput = document.getElementById("fecha-inicio-real");
const fechaTerminoRealInput = document.getElementById("fecha-termino-real");
const condPagoInput = document.getElementById("cond-pago");

// Mapa id -> nombre de los clientes, para mostrar el nombre en la tabla
// sin tener que volver a consultar la base de datos por cada fila.
let clientesPorId = new Map();

// Mapa id -> email de perfiles, para los selects de Responsable comercial
// y Project Manager (mismo patrón que loadPerfilesOptions en ofertas.js).
let perfilesPorId = new Map();

function estadoClass(estado) {
  return estado === "Cerrado" ? "estado-cerrado" : "estado-abierto";
}

function clearForm() {
  form.reset();
  idInput.value = "";
  submitButton.textContent = "Crear proyecto";
  cancelEditButton.style.display = "none";
}

function renderProjects(projects) {
  tableBody.innerHTML = "";

  for (const project of projects) {
    const row = document.createElement("tr");

    const nombreCell = document.createElement("td");
    nombreCell.textContent = project.nombre;

    const descripcionCell = document.createElement("td");
    descripcionCell.textContent = project.descripcion || "";

    const clienteCell = document.createElement("td");
    clienteCell.textContent = clientesPorId.get(project.cliente_id) || "(sin cliente)";

    const estadoCell = document.createElement("td");
    estadoCell.textContent = project.estado;
    estadoCell.className = estadoClass(project.estado);

    const fechaCell = document.createElement("td");
    fechaCell.textContent = project.fecha || "";

    const actionsCell = document.createElement("td");
    actionsCell.className = "actions";

    const viewButton = document.createElement("button");
    viewButton.textContent = "Ver";
    viewButton.className = "btn-secondary";
    viewButton.addEventListener("click", () => {
      window.location.href = "proyecto.html?id=" + project.id;
    });
    actionsCell.appendChild(viewButton);

    const editButton = document.createElement("button");
    editButton.textContent = "Editar";
    editButton.className = "btn-secondary";
    editButton.addEventListener("click", () => startEdit(project));

    actionsCell.appendChild(editButton);

    if (window.puedeBorrar) {
      const deleteButton = document.createElement("button");
      deleteButton.textContent = "Borrar";
      deleteButton.className = "btn-danger";
      deleteButton.addEventListener("click", () => deleteProject(project.id));
      actionsCell.appendChild(deleteButton);
    }

    row.append(nombreCell, descripcionCell, clienteCell, estadoCell, fechaCell, actionsCell);
    tableBody.appendChild(row);
  }
}

// Confirma que la sesión ya está cargada en el cliente de Supabase antes de
// hacer cualquier petición a la base de datos. Sin esto, una petición podía
// salir justo antes de que el cliente terminara de prepararse, llegando al
// servidor sin la cabecera de autorización (Supabase la trataba como una
// petición anónima y las políticas de RLS la rechazaban con 403).
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

async function loadPerfilesOptions() {
  const session = await ensureSession();
  if (!session) return;

  const { data, error } = await window.supabaseClient
    .from("perfiles")
    .select("id, email")
    .order("email", { ascending: true });

  if (error) return;

  perfilesPorId = new Map(data.map((p) => [p.id, p.email]));

  for (const select of [responsableComercialInput, projectManagerInput]) {
    select.innerHTML = "";

    const sinOpcion = document.createElement("option");
    sinOpcion.value = "";
    sinOpcion.textContent = "(sin asignar)";
    select.appendChild(sinOpcion);

    for (const perfil of data) {
      const option = document.createElement("option");
      option.value = perfil.id;
      option.textContent = perfil.email;
      select.appendChild(option);
    }
  }
}

async function loadProjects() {
  const session = await ensureSession();
  if (!session) return;

  const { data, error } = await window.supabaseClient
    .from("proyectos")
    .select("*")
    .order("fecha", { ascending: false });

  if (error) {
    formError.textContent = "No se pudieron cargar los proyectos.";
    return;
  }

  renderProjects(data);
}

function startEdit(project) {
  idInput.value = project.id;
  nombreInput.value = project.nombre;
  descripcionInput.value = project.descripcion || "";
  estadoInput.value = project.estado;
  fechaInput.value = project.fecha || "";
  clienteInput.value = project.cliente_id || "";
  tipoProyectoInput.value = project.tipo_proyecto || "";
  filialClienteInput.value = project.filial_cliente || "";
  responsableComercialInput.value = project.responsable_comercial_id || "";
  projectManagerInput.value = project.project_manager_id || "";
  contactoNombreInput.value = project.contacto_nombre || "";
  contactoEmailInput.value = project.contacto_email || "";
  contactoTelefonoInput.value = project.contacto_telefono || "";
  frecuenciaComunicacionInput.value = project.frecuencia_comunicacion || "";
  fechaKickoffInput.value = project.fecha_kickoff || "";
  plazoDiasInput.value = project.plazo_dias ?? "";
  valorVentaInput.value = project.valor_venta ?? "";
  valorCostoInput.value = project.valor_costo ?? "";
  direccionInstalacionInput.value = project.direccion_instalacion || "";
  fechaInicioRealInput.value = project.fecha_inicio_real || "";
  fechaTerminoRealInput.value = project.fecha_termino_real || "";
  condPagoInput.value = project.cond_pago || "";

  submitButton.textContent = "Guardar cambios";
  cancelEditButton.style.display = "inline-block";
}

async function deleteProject(id) {
  const confirmed = confirm("¿Seguro que quieres borrar este proyecto?");
  if (!confirmed) return;

  const session = await ensureSession();
  if (!session) {
    formError.textContent = "Tu sesión expiró. Vuelve a iniciar sesión.";
    return;
  }

  const { error } = await window.supabaseClient
    .from("proyectos")
    .delete()
    .eq("id", id);

  if (error) {
    formError.textContent = "No se pudo borrar el proyecto.";
    return;
  }

  loadProjects();
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
    nombre: nombreInput.value,
    descripcion: descripcionInput.value,
    estado: estadoInput.value,
    fecha: fechaInput.value,
    cliente_id: clienteInput.value || null,
    tipo_proyecto: tipoProyectoInput.value || null,
    filial_cliente: filialClienteInput.value || null,
    responsable_comercial_id: responsableComercialInput.value || null,
    project_manager_id: projectManagerInput.value || null,
    contacto_nombre: contactoNombreInput.value || null,
    contacto_email: contactoEmailInput.value || null,
    contacto_telefono: contactoTelefonoInput.value || null,
    frecuencia_comunicacion: frecuenciaComunicacionInput.value || null,
    fecha_kickoff: fechaKickoffInput.value || null,
    plazo_dias: plazoDiasInput.value ? Number(plazoDiasInput.value) : null,
    valor_venta: valorVentaInput.value ? Number(valorVentaInput.value) : null,
    valor_costo: valorCostoInput.value ? Number(valorCostoInput.value) : null,
    direccion_instalacion: direccionInstalacionInput.value || null,
    fecha_inicio_real: fechaInicioRealInput.value || null,
    fecha_termino_real: fechaTerminoRealInput.value || null,
    cond_pago: condPagoInput.value || null,
  };

  const editingId = idInput.value;

  const { error } = editingId
    ? await window.supabaseClient.from("proyectos").update(payload).eq("id", editingId)
    : await window.supabaseClient.from("proyectos").insert(payload);

  if (error) {
    formError.textContent = "No se pudo guardar el proyecto.";
    return;
  }

  clearForm();
  loadProjects();
});

cancelEditButton.addEventListener("click", clearForm);

async function init() {
  await window.authReady;
  await loadClienteOptions();
  await loadPerfilesOptions();
  await loadProjects();
}

init();
