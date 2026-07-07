// CRUD de la tabla "clientes" (usada en clientes.html).

const tableBody = document.getElementById("clients-table-body");
const form = document.getElementById("client-form");
const formError = document.getElementById("form-error");
const submitButton = document.getElementById("submit-button");
const cancelEditButton = document.getElementById("cancel-edit-button");

const idInput = document.getElementById("client-id");
const nombreInput = document.getElementById("nombre");
const emailInput = document.getElementById("email");
const telefonoInput = document.getElementById("telefono");
const empresaInput = document.getElementById("empresa");
const notasInput = document.getElementById("notas");

function clearForm() {
  form.reset();
  idInput.value = "";
  submitButton.textContent = "Crear cliente";
  cancelEditButton.style.display = "none";
}

function renderClients(clients) {
  tableBody.innerHTML = "";

  for (const client of clients) {
    const row = document.createElement("tr");

    const nombreCell = document.createElement("td");
    nombreCell.textContent = client.nombre;

    const emailCell = document.createElement("td");
    emailCell.textContent = client.email || "";

    const telefonoCell = document.createElement("td");
    telefonoCell.textContent = client.telefono || "";

    const empresaCell = document.createElement("td");
    empresaCell.textContent = client.empresa || "";

    const notasCell = document.createElement("td");
    notasCell.textContent = client.notas || "";

    const actionsCell = document.createElement("td");
    actionsCell.className = "actions";

    const editButton = document.createElement("button");
    editButton.textContent = "Editar";
    editButton.className = "btn-secondary";
    editButton.addEventListener("click", () => startEdit(client));

    actionsCell.appendChild(editButton);

    if (window.puedeBorrar) {
      const deleteButton = document.createElement("button");
      deleteButton.textContent = "Borrar";
      deleteButton.className = "btn-danger";
      deleteButton.addEventListener("click", () => deleteClient(client.id));
      actionsCell.appendChild(deleteButton);
    }

    row.append(nombreCell, emailCell, telefonoCell, empresaCell, notasCell, actionsCell);
    tableBody.appendChild(row);
  }
}

// Confirma que la sesión ya está cargada en el cliente de Supabase antes de
// hacer cualquier petición a la base de datos (ver explicación en projects.js).
async function ensureSession() {
  const { data } = await window.supabaseClient.auth.getSession();
  return data.session;
}

async function loadClients() {
  const session = await ensureSession();
  if (!session) return;

  const { data, error } = await window.supabaseClient
    .from("clientes")
    .select("*")
    .order("nombre", { ascending: true });

  if (error) {
    formError.textContent = "No se pudieron cargar los clientes.";
    return;
  }

  renderClients(data);
}

function startEdit(client) {
  idInput.value = client.id;
  nombreInput.value = client.nombre;
  emailInput.value = client.email || "";
  telefonoInput.value = client.telefono || "";
  empresaInput.value = client.empresa || "";
  notasInput.value = client.notas || "";

  submitButton.textContent = "Guardar cambios";
  cancelEditButton.style.display = "inline-block";
}

async function deleteClient(id) {
  const confirmed = confirm("¿Seguro que quieres borrar este cliente?");
  if (!confirmed) return;

  const session = await ensureSession();
  if (!session) {
    formError.textContent = "Tu sesión expiró. Vuelve a iniciar sesión.";
    return;
  }

  const { error } = await window.supabaseClient
    .from("clientes")
    .delete()
    .eq("id", id);

  if (error) {
    formError.textContent = "No se pudo borrar el cliente.";
    return;
  }

  loadClients();
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
    empresa: empresaInput.value,
    notas: notasInput.value,
  };

  const editingId = idInput.value;

  const { error } = editingId
    ? await window.supabaseClient.from("clientes").update(payload).eq("id", editingId)
    : await window.supabaseClient.from("clientes").insert(payload);

  if (error) {
    formError.textContent = "No se pudo guardar el cliente.";
    return;
  }

  clearForm();
  loadClients();
});

cancelEditButton.addEventListener("click", clearForm);

async function init() {
  await window.authReady;
  await loadClients();
}

init();
