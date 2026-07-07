// CRUD de la tabla "proveedores" (usada en proveedores.html).

const tableBody = document.getElementById("providers-table-body");
const form = document.getElementById("provider-form");
const formError = document.getElementById("form-error");
const submitButton = document.getElementById("submit-button");
const cancelEditButton = document.getElementById("cancel-edit-button");

const idInput = document.getElementById("provider-id");
const nombreInput = document.getElementById("nombre");
const emailInput = document.getElementById("email");
const telefonoInput = document.getElementById("telefono");
const rubroInput = document.getElementById("rubro");
const notasInput = document.getElementById("notas");

function clearForm() {
  form.reset();
  idInput.value = "";
  submitButton.textContent = "Crear proveedor";
  cancelEditButton.style.display = "none";
}

function renderProveedores(proveedores) {
  tableBody.innerHTML = "";

  for (const proveedor of proveedores) {
    const row = document.createElement("tr");

    const nombreCell = document.createElement("td");
    nombreCell.textContent = proveedor.nombre;

    const emailCell = document.createElement("td");
    emailCell.textContent = proveedor.email || "";

    const telefonoCell = document.createElement("td");
    telefonoCell.textContent = proveedor.telefono || "";

    const rubroCell = document.createElement("td");
    rubroCell.textContent = proveedor.rubro || "";

    const notasCell = document.createElement("td");
    notasCell.textContent = proveedor.notas || "";

    const actionsCell = document.createElement("td");
    actionsCell.className = "actions";

    const editButton = document.createElement("button");
    editButton.textContent = "Editar";
    editButton.className = "btn-secondary";
    editButton.addEventListener("click", () => startEdit(proveedor));

    actionsCell.appendChild(editButton);

    if (window.puedeBorrar) {
      const deleteButton = document.createElement("button");
      deleteButton.textContent = "Borrar";
      deleteButton.className = "btn-danger";
      deleteButton.addEventListener("click", () => deleteProveedor(proveedor.id));
      actionsCell.appendChild(deleteButton);
    }

    row.append(nombreCell, emailCell, telefonoCell, rubroCell, notasCell, actionsCell);
    tableBody.appendChild(row);
  }
}

// Confirma que la sesión ya está cargada en el cliente de Supabase antes de
// hacer cualquier petición a la base de datos (ver explicación en projects.js).
async function ensureSession() {
  const { data } = await window.supabaseClient.auth.getSession();
  return data.session;
}

async function loadProveedores() {
  const session = await ensureSession();
  if (!session) return;

  const { data, error } = await window.supabaseClient
    .from("proveedores")
    .select("*")
    .order("nombre", { ascending: true });

  if (error) {
    formError.textContent = "No se pudieron cargar los proveedores.";
    return;
  }

  renderProveedores(data);
}

function startEdit(proveedor) {
  idInput.value = proveedor.id;
  nombreInput.value = proveedor.nombre;
  emailInput.value = proveedor.email || "";
  telefonoInput.value = proveedor.telefono || "";
  rubroInput.value = proveedor.rubro || "";
  notasInput.value = proveedor.notas || "";

  submitButton.textContent = "Guardar cambios";
  cancelEditButton.style.display = "inline-block";
}

async function deleteProveedor(id) {
  const confirmed = confirm("¿Seguro que quieres borrar este proveedor?");
  if (!confirmed) return;

  const session = await ensureSession();
  if (!session) {
    formError.textContent = "Tu sesión expiró. Vuelve a iniciar sesión.";
    return;
  }

  const { error } = await window.supabaseClient
    .from("proveedores")
    .delete()
    .eq("id", id);

  if (error) {
    formError.textContent = "No se pudo borrar el proveedor.";
    return;
  }

  loadProveedores();
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
    email: emailInput.value,
    telefono: telefonoInput.value,
    rubro: rubroInput.value,
    notas: notasInput.value,
  };

  const editingId = idInput.value;

  const { error } = editingId
    ? await window.supabaseClient.from("proveedores").update(payload).eq("id", editingId)
    : await window.supabaseClient.from("proveedores").insert(payload);

  if (error) {
    formError.textContent = "No se pudo guardar el proveedor.";
    return;
  }

  clearForm();
  loadProveedores();
});

cancelEditButton.addEventListener("click", clearForm);

async function init() {
  await window.authReady;
  await loadProveedores();
}

init();
