// CRUD de la tabla "facturas" (usada en facturas.html).

const tableBody = document.getElementById("invoices-table-body");
const form = document.getElementById("invoice-form");
const formError = document.getElementById("form-error");
const submitButton = document.getElementById("submit-button");
const cancelEditButton = document.getElementById("cancel-edit-button");

const idInput = document.getElementById("invoice-id");
const numeroInput = document.getElementById("numero");
const montoInput = document.getElementById("monto");
const proyectoInput = document.getElementById("proyecto");
const estadoInput = document.getElementById("estado");
const fechaInput = document.getElementById("fecha");

// Mapa id -> nombre de los proyectos, para mostrar el nombre en la tabla
// sin tener que volver a consultar la base de datos por cada fila.
let proyectosPorId = new Map();

function estadoClass(estado) {
  if (estado === "Pagada") return "estado-completado";
  if (estado === "Vencida") return "estado-en-curso";
  return "estado-pendiente";
}

function clearForm() {
  form.reset();
  idInput.value = "";
  submitButton.textContent = "Crear factura";
  cancelEditButton.style.display = "none";
}

function renderFacturas(facturas) {
  tableBody.innerHTML = "";

  for (const factura of facturas) {
    const row = document.createElement("tr");

    const numeroCell = document.createElement("td");
    numeroCell.textContent = factura.numero;

    const montoCell = document.createElement("td");
    montoCell.textContent = factura.monto;

    const proyectoCell = document.createElement("td");
    proyectoCell.textContent = proyectosPorId.get(factura.proyecto_id) || "(sin proyecto)";

    const estadoCell = document.createElement("td");
    estadoCell.textContent = factura.estado;
    estadoCell.className = estadoClass(factura.estado);

    const fechaCell = document.createElement("td");
    fechaCell.textContent = factura.fecha || "";

    const actionsCell = document.createElement("td");
    actionsCell.className = "actions";

    const editButton = document.createElement("button");
    editButton.textContent = "Editar";
    editButton.className = "btn-secondary";
    editButton.addEventListener("click", () => startEdit(factura));

    actionsCell.appendChild(editButton);

    if (window.puedeBorrar) {
      const deleteButton = document.createElement("button");
      deleteButton.textContent = "Borrar";
      deleteButton.className = "btn-danger";
      deleteButton.addEventListener("click", () => deleteFactura(factura.id));
      actionsCell.appendChild(deleteButton);
    }

    row.append(numeroCell, montoCell, proyectoCell, estadoCell, fechaCell, actionsCell);
    tableBody.appendChild(row);
  }
}

// Confirma que la sesión ya está cargada en el cliente de Supabase antes de
// hacer cualquier petición a la base de datos (ver explicación en projects.js).
async function ensureSession() {
  const { data } = await window.supabaseClient.auth.getSession();
  return data.session;
}

async function loadProyectoOptions() {
  const session = await ensureSession();
  if (!session) return;

  const { data, error } = await window.supabaseClient
    .from("proyectos")
    .select("id, nombre")
    .order("nombre", { ascending: true });

  if (error) return;

  proyectosPorId = new Map(data.map((proyecto) => [proyecto.id, proyecto.nombre]));

  proyectoInput.innerHTML = "";

  const sinProyectoOption = document.createElement("option");
  sinProyectoOption.value = "";
  sinProyectoOption.textContent = "(sin proyecto)";
  proyectoInput.appendChild(sinProyectoOption);

  for (const proyecto of data) {
    const option = document.createElement("option");
    option.value = proyecto.id;
    option.textContent = proyecto.nombre;
    proyectoInput.appendChild(option);
  }
}

async function loadFacturas() {
  const session = await ensureSession();
  if (!session) return;

  const { data, error } = await window.supabaseClient
    .from("facturas")
    .select("*")
    .order("fecha", { ascending: false });

  if (error) {
    formError.textContent = "No se pudieron cargar las facturas.";
    return;
  }

  renderFacturas(data);
}

function startEdit(factura) {
  idInput.value = factura.id;
  numeroInput.value = factura.numero;
  montoInput.value = factura.monto;
  proyectoInput.value = factura.proyecto_id || "";
  estadoInput.value = factura.estado;
  fechaInput.value = factura.fecha || "";

  submitButton.textContent = "Guardar cambios";
  cancelEditButton.style.display = "inline-block";
}

async function deleteFactura(id) {
  const confirmed = confirm("¿Seguro que quieres borrar esta factura?");
  if (!confirmed) return;

  const session = await ensureSession();
  if (!session) {
    formError.textContent = "Tu sesión expiró. Vuelve a iniciar sesión.";
    return;
  }

  const { error } = await window.supabaseClient
    .from("facturas")
    .delete()
    .eq("id", id);

  if (error) {
    formError.textContent = "No se pudo borrar la factura.";
    return;
  }

  loadFacturas();
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
    numero: numeroInput.value,
    monto: montoInput.value,
    proyecto_id: proyectoInput.value || null,
    estado: estadoInput.value,
    fecha: fechaInput.value || null,
  };

  const editingId = idInput.value;

  const { error } = editingId
    ? await window.supabaseClient.from("facturas").update(payload).eq("id", editingId)
    : await window.supabaseClient.from("facturas").insert(payload);

  if (error) {
    formError.textContent = "No se pudo guardar la factura.";
    return;
  }

  clearForm();
  loadFacturas();
});

cancelEditButton.addEventListener("click", clearForm);

async function init() {
  await window.authReady;
  await loadProyectoOptions();
  await loadFacturas();
}

init();
