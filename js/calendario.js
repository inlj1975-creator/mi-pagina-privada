// Calendario mensual de tareas (solo lectura).
// Cada tarea aparece en todos los días entre fecha_inicio y fecha_termino.
// Si le falta una fecha, se trata como tarea de un solo día en la que sí tiene.
// Si le faltan las dos, no se muestra.

const mesLabel = document.getElementById("mes-label");
const grid = document.getElementById("calendario-grid");
const errorEl = document.getElementById("calendario-error");
const btnAnterior = document.getElementById("btn-mes-anterior");
const btnSiguiente = document.getElementById("btn-mes-siguiente");

const hoy = new Date();
hoy.setHours(0, 0, 0, 0);

let currentYear = hoy.getFullYear();
let currentMonth = hoy.getMonth();
let tareasCache = null;

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function badgeClass(estado) {
  if (estado === "En curso") return "badge-en-curso";
  if (estado === "Hecha") return "badge-hecha";
  return "badge-pendiente";
}

function parseDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function actualizarLabel() {
  const label = new Date(currentYear, currentMonth, 1).toLocaleDateString("es-CL", {
    month: "long",
    year: "numeric",
  });
  mesLabel.textContent = label.charAt(0).toUpperCase() + label.slice(1);
}

function renderCalendario(tareas) {
  grid.innerHTML = "";

  for (const dia of DIAS_SEMANA) {
    const h = document.createElement("div");
    h.className = "calendario-cabecera";
    h.textContent = dia;
    grid.appendChild(h);
  }

  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);

  // Offset de lunes (Mon=0 ... Dom=6).
  const offset = (firstDay.getDay() + 6) % 7;
  const totalCells = Math.ceil((offset + lastDay.getDate()) / 7) * 7;

  // Normalizar rangos: si falta una fecha, la otra oficia de ambas extremos.
  const tareasConFecha = tareas
    .filter(t => t.fecha_inicio || t.fecha_termino)
    .map(t => {
      const inicio = parseDate(t.fecha_inicio) ?? parseDate(t.fecha_termino);
      const termino = parseDate(t.fecha_termino) ?? parseDate(t.fecha_inicio);
      return { titulo: t.titulo, estado: t.estado, inicio, termino };
    });

  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - offset + 1;
    const cellDate = new Date(currentYear, currentMonth, dayNum);
    cellDate.setHours(0, 0, 0, 0);

    const inMonth = cellDate.getMonth() === currentMonth;

    const cell = document.createElement("div");
    const esFinDeSemana = i % 7 >= 5;
    cell.className = "calendario-dia"
      + (inMonth ? "" : " fuera-del-mes")
      + (esFinDeSemana ? " calendar-weekend" : "");

    const numEl = document.createElement("div");
    numEl.className =
      "calendario-dia-numero" + (cellDate.getTime() === hoy.getTime() ? " hoy" : "");
    numEl.textContent = cellDate.getDate();
    cell.appendChild(numEl);

    for (const t of tareasConFecha) {
      if (cellDate >= t.inicio && cellDate <= t.termino) {
        const chip = document.createElement("span");
        chip.className = "calendario-tarea " + badgeClass(t.estado);
        chip.textContent = t.titulo;
        cell.appendChild(chip);
      }
    }

    grid.appendChild(cell);
  }
}

async function loadTareas() {
  const { data, error } = await window.supabaseClient
    .from("tareas")
    .select("titulo, estado, fecha_inicio, fecha_termino");

  if (error) {
    errorEl.textContent = "No se pudieron cargar las tareas.";
    return;
  }

  tareasCache = data || [];
  actualizarLabel();
  renderCalendario(tareasCache);
}

btnAnterior.addEventListener("click", () => {
  currentMonth--;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  actualizarLabel();
  if (tareasCache) renderCalendario(tareasCache);
});

btnSiguiente.addEventListener("click", () => {
  currentMonth++;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  actualizarLabel();
  if (tareasCache) renderCalendario(tareasCache);
});

async function init() {
  await window.authReady;
  await loadTareas();
}

init();
