// Menú de navegación, compartido por todas las páginas privadas.
// Para agregar/quitar una sección (ej. Calendario), tocar solo esta lista.
const navLinks = [
  { label: "Tablero", href: "proyectos-tablero.html" },
  { label: "Calendario", href: "calendario.html" },
  { label: "Mi cuenta", href: "configuracion.html" },
  {
    label: "Proyectos",
    items: [
      { label: "Proyectos", href: "proyectos.html" },
      { label: "Tareas", href: "tareas.html" },
      { label: "Facturas", href: "facturas.html" },
    ],
  },
  {
    label: "Comercial",
    items: [
      { label: "Clientes", href: "clientes.html" },
      { label: "Proveedores", href: "proveedores.html" },
      { label: "Ofertas", href: "ofertas.html" },
    ],
  },
];

const nav = document.getElementById("main-nav");
const dropdowns = [];
const currentUrl = window.location.origin + window.location.pathname;

for (const entry of navLinks) {
  if (entry.href) {
    const link = document.createElement("a");
    link.href = entry.href;
    link.textContent = entry.label;
    if (link.href === currentUrl) link.classList.add("nav-active");
    nav.appendChild(link);
    continue;
  }

  const details = document.createElement("details");
  details.className = "nav-dropdown";

  const summary = document.createElement("summary");
  summary.textContent = entry.label;
  details.appendChild(summary);

  const menu = document.createElement("div");
  menu.className = "nav-dropdown-menu";

  for (const item of entry.items) {
    const link = document.createElement("a");
    link.href = item.href;
    link.textContent = item.label;
    if (link.href === currentUrl) link.classList.add("nav-active");
    menu.appendChild(link);
  }

  details.appendChild(menu);
  nav.appendChild(details);
  dropdowns.push(details);
}

// Solo un desplegable abierto a la vez: al abrir uno, cierra los demás.
for (const dropdown of dropdowns) {
  dropdown.addEventListener("toggle", () => {
    if (!dropdown.open) return;
    for (const otro of dropdowns) {
      if (otro !== dropdown) otro.open = false;
    }
  });
}

// Clic fuera del menú cierra el desplegable que esté abierto.
document.addEventListener("click", (event) => {
  for (const dropdown of dropdowns) {
    if (dropdown.open && !dropdown.contains(event.target)) {
      dropdown.open = false;
    }
  }
});
