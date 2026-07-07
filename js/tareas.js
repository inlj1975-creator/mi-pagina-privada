// CRUD de la tabla "tareas" (usada en tareas.html).

const tableBody = document.getElementById("tasks-table-body");
const form = document.getElementById("task-form");
const formError = document.getElementById("form-error");
const submitButton = document.getElementById("submit-button");
const cancelEditButton = document.getElementById("cancel-edit-button");

const idInput = document.getElementById("task-id");
const tituloInput = document.getElementById("titulo");
const descripcionInput = document.getElementById("descripcion");
const proyectoInput = document.getElementById("proyecto");
const responsableInput = document.getElementById("responsable_id");
const estadoInput = document.getElementById("estado");
const fechaInicioInput = document.getElementById("fecha_inicio");
const fechaTerminoInput = document.getElementById("fecha_termino");

// Mapas id → nombre/email para mostrar en la tabla sin consultas adicionales.
let proyectosPorId = new Map();
let perfilesPorId = new Map();

function estadoClass(estado) {
  if (estado === "En curso") return "estado-en-curso";
  if (estado === "Hecha") return "estado-completado";
  return "estado-pendiente";
}

function clearForm() {
  form.reset();
  idInput.value = "";
  submitButton.textContent = "Crear tarea";
  cancelEditButton.style.display = "none";
}

function renderTareas(tareas) {
  tableBody.innerHTML = "";

  for (const tarea of tareas) {
    const row = document.createElement("tr");

    const tituloCell = document.createElement("td");
    tituloCell.textContent = tarea.titulo;

    const proyectoCell = document.createElement("td");
    proyectoCell.textContent = proyectosPorId.get(tarea.proyecto_id) || "(sin proyecto)";

    const responsableCell = document.createElement("td");
    if (tarea.responsable_id && perfilesPorId.has(tarea.responsable_id)) {
      responsableCell.textContent = perfilesPorId.get(tarea.responsable_id);
    } else if (tarea.responsable_nombre) {
      responsableCell.textContent = tarea.responsable_nombre + " (sin usuario vinculado)";
    } else {
      responsableCell.textContent = "Sin responsable";
    }

    const estadoCell = document.createElement("td");
    estadoCell.textContent = tarea.estado;
    estadoCell.className = estadoClass(tarea.estado);

    const inicioCell = document.createElement("td");
    inicioCell.textContent = tarea.fecha_inicio || "";

    const terminoCell = document.createElement("td");
    terminoCell.textContent = tarea.fecha_termino || "";

    const actionsCell = document.createElement("td");
    actionsCell.className = "actions";

    const editButton = document.createElement("button");
    editButton.textContent = "Editar";
    editButton.className = "btn-secondary";
    editButton.addEventListener("click", () => startEdit(tarea));

    actionsCell.appendChild(editButton);

    if (window.puedeBorrar) {
      const deleteButton = document.createElement("button");
      deleteButton.textContent = "Borrar";
      deleteButton.className = "btn-danger";
      deleteButton.addEventListener("click", () => deleteTarea(tarea.id));
      actionsCell.appendChild(deleteButton);
    }

    row.append(tituloCell, proyectoCell, responsableCell, estadoCell, inicioCell, terminoCell, actionsCell);
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

async function loadPerfilesOptions() {
  const session = await ensureSession();
  if (!session) return;

  const { data, error } = await window.supabaseClient
    .from("perfiles")
    .select("id, email")
    .order("email", { ascending: true });

  if (error) return;

  perfilesPorId = new Map(data.map((p) => [p.id, p.email]));

  responsableInput.innerHTML = "";

  const sinOpcion = document.createElement("option");
  sinOpcion.value = "";
  sinOpcion.textContent = "(sin responsable)";
  responsableInput.appendChild(sinOpcion);

  for (const perfil of data) {
    const option = document.createElement("option");
    option.value = perfil.id;
    option.textContent = perfil.email;
    responsableInput.appendChild(option);
  }
}

async function loadTareas() {
  const session = await ensureSession();
  if (!session) return;

  const { data, error } = await window.supabaseClient
    .from("tareas")
    .select("id, titulo, descripcion, proyecto_id, responsable_id, responsable_nombre, estado, fecha_inicio, fecha_termino")
    .order("fecha_inicio", { ascending: false });

  if (error) {
    formError.textContent = "No se pudieron cargar las tareas.";
    return;
  }

  renderTareas(data);
}

function startEdit(tarea) {
  idInput.value = tarea.id;
  tituloInput.value = tarea.titulo;
  descripcionInput.value = tarea.descripcion || "";
  proyectoInput.value = tarea.proyecto_id || "";
  responsableInput.value = tarea.responsable_id || "";
  estadoInput.value = tarea.estado;
  fechaInicioInput.value = tarea.fecha_inicio || "";
  fechaTerminoInput.value = tarea.fecha_termino || "";

  submitButton.textContent = "Guardar cambios";
  cancelEditButton.style.display = "inline-block";
}

async function deleteTarea(id) {
  const confirmed = confirm("¿Seguro que quieres borrar esta tarea?");
  if (!confirmed) return;

  const session = await ensureSession();
  if (!session) {
    formError.textContent = "Tu sesión expiró. Vuelve a iniciar sesión.";
    return;
  }

  const { error } = await window.supabaseClient
    .from("tareas")
    .delete()
    .eq("id", id);

  if (error) {
    formError.textContent = "No se pudo borrar la tarea.";
    return;
  }

  loadTareas();
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
    descripcion: descripcionInput.value,
    proyecto_id: proyectoInput.value || null,
    responsable_id: responsableInput.value || null,
    estado: estadoInput.value,
    fecha_inicio: fechaInicioInput.value || null,
    fecha_termino: fechaTerminoInput.value || null,
  };

  const editingId = idInput.value;

  const { error } = editingId
    ? await window.supabaseClient.from("tareas").update(payload).eq("id", editingId)
    : await window.supabaseClient.from("tareas").insert(payload);

  if (error) {
    formError.textContent = "No se pudo guardar la tarea. Revisa que la fecha de término no sea anterior a la de inicio.";
    return;
  }

  clearForm();
  loadTareas();
});

cancelEditButton.addEventListener("click", clearForm);

async function init() {
  await window.authReady;
  await loadProyectoOptions();
  await loadPerfilesOptions();
  await loadTareas();
}

init();
