# Proyecto

Sistema de gestión de proyectos de práctica, con datos inventados. Pensado para
una empresa pequeña: grupo cerrado de empleados, sin registro público (las
cuentas se crean manualmente desde el panel de Supabase).

## Tecnologías

HTML/CSS/JS plano, sin paso de build. Backend: Supabase (BaaS) — Auth +
Postgres + RLS. En el navegador solo se usa la **publishable key**
(`sb_publishable_...`); nunca una clave secreta.

## Estructura

- `index.html` — login (email + contraseña vía Supabase Auth).
- `proyectos.html` / `clientes.html` / `proveedores.html` / `ofertas.html` / `facturas.html` / `tareas.html` — páginas privadas con formulario + lista (CRUD).
- `proyecto.html` / `proyectos-tablero.html` / `calendario.html` — vistas de solo lectura (ver sección "Páginas de detalle y vistas").
- `css/style.css` — estilos compartidos por todas las páginas.
- `js/config.js` — URL, publishable key y datos de la app de Microsoft
  (client_id/tenant_id/redirect_uri). Sí se sube a git: ninguno de estos
  valores es secreto (están pensados para vivir en el navegador; la
  protección real es RLS del lado de Supabase y el consentimiento OAuth del
  lado de Microsoft), y el repo necesita este archivo para que el sitio
  publicado en GitHub Pages funcione. El client_secret de Microsoft es lo
  único realmente sensible acá — ese nunca está en este archivo, vive solo
  como Supabase Function secret.
- `js/config.example.js` — mismo contenido que `config.js`, como plantilla
  para levantar el proyecto en otra cuenta de Supabase/Azure.
- `js/supabaseClient.js` — crea el cliente único de Supabase (`window.supabaseClient`).
- `js/auth.js` — lógica de login (usada en `index.html`).
- `js/auth-guard.js` — protege las páginas privadas; redirige si no hay sesión; maneja logout; carga el rol del usuario actual (`window.currentUserRole`) y expone `window.authReady`. Compartido por todas las páginas privadas, sin cambios por entidad.
- `js/projects.js` / `js/clients.js` / `js/proveedores.js` / `js/ofertas.js` / `js/facturas.js` / `js/tareas.js` — CRUD de cada entidad.
- `js/proyecto.js` / `js/proyectos-tablero.js` / `js/calendario.js` — lógica de las vistas de solo lectura.
- `js/nav.js` — construye el menú de navegación (ver sección "Menú de navegación"). Compartido por las 9 páginas privadas.
- `sql/schema.sql` — referencia: tablas, RLS, políticas y GRANT (se pega manualmente en el SQL Editor de Supabase).

## Entidades actuales

- **Proyectos**: nombre, descripción, estado (`Abierto`/`Cerrado`, con
  check; antes 3 valores libres sin check — `Pendiente`/`En curso` →
  `Abierto`, `Completado` → `Cerrado`, migrados en la Fase 1 de ampliación),
  fecha, cliente (opcional). Fase 1 (ampliación de la ficha de proyecto):
  tipo_proyecto (check: Venta / Importación / Instalación / Llave en mano),
  filial_cliente (texto libre, sin tabla ni FK), responsable_comercial_id y
  project_manager_id (FK → perfiles, on delete set null),
  contacto_nombre/contacto_email/contacto_telefono (texto libre del
  proyecto, sin FK a perfiles ni clientes), frecuencia_comunicacion (check:
  Semanal / Quincenal / Mensual), fecha_kickoff, plazo_dias, valor_venta y
  valor_costo (`numeric(12,2)`), direccion_instalacion, fecha_inicio_real,
  fecha_termino_real, cond_pago (texto libre). rentabilidad_esperada es una
  columna calculada (`(valor_venta - valor_costo) / valor_venta * 100`,
  redondeada a 2 decimales; `NULL` si valor_venta no es mayor que 0), mismo
  patrón que `ofertas.nivel_aprobacion`. Pendiente: Fase 2 (crear un Grupo
  de Microsoft 365 por proyecto, con carpetas/eventos/miembros).
- **Clientes**: nombre, email, teléfono, empresa, notas.
- **Proveedores**: nombre, email, teléfono, rubro, notas. Mismo modelo que Clientes.
- **Ofertas**: título, monto (`numeric(12,2)`), cliente (opcional), estado,
  fecha, responsable_id y aprobador_id (FK → perfiles, on delete set null,
  ambos solo informativos: no disparan mail ni cambian quién puede aprobar
  — eso lo sigue decidiendo `puede_aprobar_oferta()` por monto).
- **Facturas**: número, monto (`numeric(12,2)`), proyecto (opcional), estado, fecha.
- **Tareas**: título, descripción, proyecto (opcional), responsable_id (FK →
  perfiles, on delete set null), estado, fecha_inicio, fecha_termino. Las
  columnas responsable_nombre / responsable_email se conservan como respaldo
  histórico; el flujo principal es responsable_id.
- **Equipos**: tipo, marca, modelo. Catálogo reutilizable (mismo modelo que
  Clientes/Proveedores); se elige desde el Detalle de una Oferta, y si no
  existe el que hace falta, se crea ahí mismo con una opción "+ Crear
  equipo nuevo" en el propio selector.
- **Detalle de Ofertas** (`detalle_ofertas`): una línea por equipo instalado
  en una oferta puntual — oferta_id (FK → ofertas, **on delete cascade**,
  a diferencia del resto del proyecto: una línea de detalle no tiene
  sentido sin su oferta), equipo_id (FK → equipos, on delete set null),
  cantidad, plazo_entrega_dias, proveedor_id (FK → proveedores, on delete
  set null), fecha_instalacion, duracion_instalacion, responsable_instalacion_id
  (FK → perfiles, on delete set null), fecha_comisionamiento, fecha_pruebas,
  fecha_puesta_servicio, criterio_aceptacion, inicio_garantia. Se gestiona
  desde `ofertas.html`, en una sección que solo aparece editando una oferta
  ya guardada; alcance acotado a agregar y borrar líneas, sin edición
  in-place.

Relación: un proyecto, una oferta o una tarea pertenecen a lo más a un
cliente/proyecto (`cliente_id`/`proyecto_id`, clave foránea con `on delete
set null` — si se borra el cliente/proyecto relacionado, la fila queda sin
relación en vez de borrarse); una factura pertenece a lo más a un proyecto
igual. El `estado` de Ofertas tiene un `check` que solo permite
`'Pendiente'`, `'Aprobada'` o `'Rechazada'`; el de Facturas, `'Pendiente'`,
`'Pagada'` o `'Vencida'`; el de Tareas, `'Pendiente'`, `'En curso'` o
`'Hecha'`. Tareas además tiene un `check (fecha_termino >= fecha_inicio)`
(NULL en cualquiera de las dos no rompe la validación).

Las ocho con **lista compartida**: cualquier usuario autenticado ve, crea
y edita cualquier fila (no hay filtro por dueño/usuario). **Borrar es para
admin, director_comercial y gerente_general** (ver sección Roles).

## Roles (admin / empleado / director_comercial / gerente_general)

Tabla `perfiles` (1 fila por usuario, `id` = id de `auth.users`, columnas
`rol` y `email`). `email` espeja `auth.users.email` — se rellena en la
migración y debe completarse a mano al crear un perfil nuevo. Cualquier
autenticado puede leer **todos** los perfiles (cambio deliberado respecto al
"solo su propio perfil" original, necesario para poblar el selector de
responsables en Tareas); nadie puede crear ni modificar perfiles desde la
app — los roles y emails se asignan a mano desde el SQL Editor / Table
Editor de Supabase.

Función `public.es_admin()` (`security definer`, evita recursión de RLS):
sigue existiendo, disponible para cualquier chequeo futuro de "es admin"
(hoy no la usa ninguna política de `delete`).

Función `public.puede_borrar()` (mismo patrón `security definer`) decide
quién borra: usa una lista de roles permitidos (`rol in ('admin',
'director_comercial', 'gerente_general')`), no una exclusión de
`'empleado'`, para que un usuario sin perfil (o con un rol futuro no
contemplado) falle de forma segura. La usan las políticas de `delete` de
`proyectos`, `clientes`, `proveedores`, `ofertas`, `facturas` y `tareas`.
En el frontend, la regla está centralizada en `js/auth-guard.js` como
`window.puedeBorrar` (calculado junto a `window.currentUserRole`); los 6
archivos CRUD solo revisan `if (window.puedeBorrar)` para mostrar el botón
"Borrar" — ocultarlo es comodidad, la política de cada tabla es la
protección real.

**Nota:** cada usuario nuevo necesita su propia fila en `perfiles` (si no la
tiene, se trata como no-admin por defecto).

Desde julio 2026, esa fila se crea **sola**: un trigger
(`sql/schema.sql`, sección 22) sobre `auth.users` inserta automáticamente
la fila en `perfiles` (con `email` ya completo y `rol` en su valor por
defecto `'empleado'`) apenas se crea el usuario en Authentication. Antes
era un segundo paso manual (Table Editor → insertar fila), y nada
garantizaba que se hiciera ni que el email quedara bien cargado — un
`email` vacío en `perfiles` rompe en silencio cualquier flujo que
dependa de él (pasó armando el ambiente de staging: un perfil de prueba
sin email hizo fallar el aviso de Outlook de forma difícil de
diagnosticar). El alta del usuario en sí sigue siendo 100% manual desde
el panel de Supabase — el trigger no abre ningún registro público, solo
automatiza la fila de `perfiles` que sigue a esa alta. Asignar un rol
distinto de `'empleado'` sigue siendo manual, editando la fila que ya
existe.

## Aprobaciones de Ofertas

`ofertas.nivel_aprobacion` es una columna **generada** (calculada sola
desde `monto`, no se puede escribir a mano): hasta 1.000.000 → `'ninguno'`;
más de 1.000.000 y hasta 10.000.000 → `'director'`; más de 10.000.000 →
`'gerente'`. Los umbrales (1M/10M) están en `sql/schema.sql` marcados como
"UMBRAL" para encontrarlos fácil si cambian.

Función `public.puede_aprobar_oferta(oferta_id)` (`security definer`,
mismo motivo que `es_admin()`) decide si el usuario actual puede aprobar
una oferta concreta: `'ninguno'` → cualquier autenticado; `'director'` →
`director_comercial` o `gerente_general`; `'gerente'` → solo
`gerente_general` (el gerente cubre también el nivel director). `admin` y
`empleado` no aprueban por sí solos.

La política de `update` de `ofertas` permite editar libremente excepto que
la fila *termine* en `estado = 'Aprobada'` sin que `puede_aprobar_oferta()`
sea `true` — eso incluye volver a guardar una oferta ya aprobada sin tener
permiso. En la UI, el botón "Aprobar" (`js/ofertas.js`) solo se muestra si
el RPC a `puede_aprobar_oferta` devuelve `true`; ocultarlo es solo comodidad,
la protección real es la política. El menú desplegable de estado del
formulario ya no ofrece "Aprobada" como opción elegible a mano (solo
Pendiente/Rechazada) — la única vía a "Aprobada" es ese botón.

## Conversión de oferta en proyecto

`proyectos.oferta_id` es una FK opcional hacia `ofertas` (`on delete set
null`), con un índice único parcial (`where oferta_id is not null`) que
impide que dos proyectos nazcan de la misma oferta, sin limitar cuántos
proyectos pueden tener `oferta_id` nulo (la mayoría).

Función `public.convertir_oferta_en_proyecto(oferta_id)` (`security
definer`) crea el proyecto: valida que la oferta esté `'Aprobada'`, que el
usuario actual tenga rol `director_comercial` o `gerente_general`, y que
esa oferta no tenga ya un proyecto asociado; si todo pasa, inserta un
proyecto heredando `nombre` (= título de la oferta) y `cliente_id`. Cada
chequeo que falla lanza un `raise exception` con un mensaje claro, que el
frontend muestra tal cual (única función donde se hace así, a propósito).
En la UI, el botón "Convertir en proyecto" (`js/ofertas.js`) solo se
muestra para `director_comercial`/`gerente_general` en ofertas `'Aprobada'`
sin proyecto todavía; la protección real es la función, no el botón.

## Páginas de detalle y vistas

- `proyecto.html` / `js/proyecto.js` — ficha de solo lectura de un proyecto.
  Lee el `id` desde la URL (`?id=...`, vía `URLSearchParams`), busca ese
  proyecto y muestra sus datos, los de su cliente (si tiene), y las listas
  de sus tareas y facturas (filtradas por `proyecto_id`). Sin formularios.
  La columna Responsable de tareas usa la misma lógica que `js/tareas.js`:
  busca en `perfiles` por `responsable_id`; si no hay, muestra
  `responsable_nombre` con marca de legacy; si no hay ninguno, queda vacío.
  Si el proyecto tiene `oferta_id` (nació de una oferta), se agrega una
  sección "Detalle de equipos" con las líneas de `detalle_ofertas` de esa
  oferta de origen (mismo patrón de solo lectura que tareas/facturas); si
  no tiene `oferta_id` (la mayoría), la sección queda oculta en vez de
  mostrar una tabla vacía.
- `proyectos-tablero.html` / `js/proyectos-tablero.js` — tablero visual:
  todos los proyectos como tarjetas en una grilla responsive. Cada tarjeta
  muestra nombre, estado (badge de color), cliente y un resumen "N tareas ·
  N facturas"; clic en la tarjeta lleva a `proyecto.html?id=...`. Los
  conteos se calculan en el navegador (se traen las listas completas de
  `tareas`/`facturas` con solo la columna `proyecto_id`, y se cuenta con un
  `Map`) — simple y suficiente para la cantidad de filas de esta app, sin
  necesitar una vista o función SQL nueva. Si no hay proyectos, muestra un
  mensaje vacío (`.tablero-vacio`) en vez de una grilla en blanco.

- `calendario.html` / `js/calendario.js` — calendario mensual de solo lectura.
  Muestra Tareas en una grilla de 7 columnas (semana lunes→domingo). Cada tarea
  aparece en todos los días entre `fecha_inicio` y `fecha_termino` (si falta una,
  se trata como tarea de un día; si faltan las dos, no se muestra). Controles de
  mes anterior/siguiente; la data se carga una sola vez y el cambio de mes
  re-renderiza en el navegador sin nueva consulta. No requirió cambios de base de
  datos ni de RLS.

Las tres reusan `js/auth-guard.js` y los estilos existentes; ninguna requirió
cambios de base de datos ni de RLS (solo leen datos ya permitidos).

## Menú de navegación

`js/nav.js` arma el menú de las 9 páginas privadas a partir de una sola
lista (`navLinks`) — para agregar/quitar una sección, se edita solo ahí,
no cada página. Estructura actual: "Tablero" y "Calendario" sueltos, y dos
desplegables nativos (`<details>/<summary>`, sin librerías): "Proyectos"
(Proyectos / Tareas / Facturas) y "Comercial" (Clientes / Proveedores /
Ofertas). El
mismo script coordina que solo un desplegable esté abierto a la vez
(escucha el evento `toggle` de cada `<details>`) y que un clic fuera del
menú cierre el que esté abierto.

Convive con `js/auth-guard.js` sin pisarse: `nav.js` solo llena el
`<nav id="main-nav">`; `auth-guard.js` sigue siendo el único que toca
`#user-email` y `#logout-button`, que quedan estáticos en el HTML de cada
página (no los genera `nav.js`).

## Integración con Microsoft Outlook

El sitio está publicado en GitHub Pages (`https://inlj1975-creator.github.io/mi-pagina-privada/`),
necesario porque Microsoft exige una URL `https://` pública como redirect
URI de OAuth — hasta esta integración el proyecto no estaba hosteado en
ningún lado.

Alcance: (a) sync de un solo sentido, Tareas → evento en el calendario de
Outlook del **responsable** de la tarea (no al revés); (b) email de aviso
al asignar una tarea a alguien, desde `info@aitbp.com`.

Se registró una app en Azure/Entra ID (tenant "Melirrepu") con permisos
Graph delegados (`Calendars.ReadWrite`, `offline_access`, `User.Read`) y de
aplicación (`Mail.Send`, con admin consent). El `client_id`/`tenant_id`
(no son secretos) van en `js/config.js`; el `client_secret` (sí es
secreto) vive únicamente como Supabase Function secret, nunca en el repo.

Tabla nueva `ms_conexiones` (`sql/schema.sql`, sección 21): guarda el token
OAuth de cada usuario que conectó su Outlook. Es la **única** tabla del
proyecto que no sigue el patrón "lista compartida" — cada fila es
visible/editable solo por su dueño (`using (user_id = auth.uid())`),
porque son credenciales de acceso a un calendario personal de terceros,
no datos de negocio. Columna nueva `tareas.outlook_event_id` (misma
sección): id del evento ya creado en Outlook, para poder actualizarlo o
borrarlo en vez de duplicarlo.

Primer uso de **Supabase Edge Functions** en el proyecto (hasta ahora todo
era `sql/schema.sql` pegado a mano). Se despliegan a mano desde el editor
del dashboard de Supabase (Edge Functions → Via Editor), no con el CLI: en
esta red el CLI no logra conectarse (error de red/certificados desde el
binario, no reproducible desde el navegador ni desde `npm`/PowerShell), así
que quedó descartado como flujo de trabajo para este proyecto.

Secrets del proyecto (Edge Functions → Secrets, no van en el repo):
`MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_REMITENTE_EMAIL`,
`PROJECT_SECRET_KEY` y `MS_TOKEN_ENCRYPTION_KEY`. `PROJECT_SECRET_KEY` es
la "secret key" (`sb_secret_...`) del sistema nuevo de claves de Supabase
(Project Settings → API Keys), que NO se inyecta sola con el nombre
clásico `SUPABASE_SERVICE_ROLE_KEY`, y que tampoco se puede guardar como
secreto con un nombre que empiece con `SUPABASE_` (prefijo reservado por
la plataforma) — por eso el nombre `PROJECT_SECRET_KEY`. Hay que usarla
explícitamente en cualquier función que necesite saltarse RLS (ver
`ms-sync-evento-tarea`, que lee la tarea y la conexión de Outlook de un
usuario que no es quien hizo el pedido).

Desde julio 2026, `ms_access_token`/`ms_refresh_token` se guardan
**cifrados** (AES-GCM, Web Crypto nativo de Deno, sin librerías externas)
en vez de en texto plano — así, tener `PROJECT_SECRET_KEY` (que bypassea
RLS) ya no alcanza para leer el token de alguien, hace falta además
`MS_TOKEN_ENCRYPTION_KEY`. El cifrado/descifrado está duplicado en
`ms-oauth-exchange` (cifra al guardar) y `ms-sync-evento-tarea` (descifra
al leer, vuelve a cifrar al refrescar) — mismo patrón que
`obtenerInfoProyecto`, ya duplicada entre dos funciones. Importante,
porque es distinto a rotar los otros secrets: rotar o perder
`MS_TOKEN_ENCRYPTION_KEY` invalida **para siempre** todas las conexiones
ya guardadas (nadie puede recuperar su token cifrado con la clave vieja),
obligando a que todos reconecten su Outlook — por eso este secret no se
rota "por las dudas" como los demás, solo si se sabe que se filtró, y
conviene tener una copia guardada en un lugar seguro (Supabase no permite
volver a ver el valor de un secret ya guardado).

## Grupo de Microsoft 365 por proyecto (Fase 2)

Cada proyecto tiene un Grupo de Microsoft 365 propio (carpetas, calendario
compartido, membresía), creado la primera vez que hace falta — **no** se
crea retroactivamente para proyectos ya existentes.

Disparadores de creación (Edge Function `ms-sync-grupo-proyecto`, `{
proyecto_id, perfil_id_extra? }`):
- Alta o edición manual en `proyectos.html` (`js/projects.js`).
- Conversión de oferta aprobada en proyecto (`js/ofertas.js`,
  `convertir_oferta_en_proyecto`).
- Guardado de una tarea con `proyecto_id` (`js/tareas.js`), pasando el
  `responsable_id` de esa tarea como `perfil_id_extra`.

**Borrar un proyecto NO borra su grupo.** `deleteProject()` en
`js/projects.js` solo borra la fila de `proyectos`; el Grupo M365 asociado
queda huérfano en Microsoft (con su calendario y los archivos de las 3
carpetas intactos). Decisión deliberada: borrar el grupo automáticamente
sería irreversible desde la app (se pierden los archivos de SharePoint sin
forma de restaurarlos desde acá) por un borrado que puede ser accidental.
Si hace falta limpiar un grupo huérfano, se borra a mano desde
admin.microsoft.com → Grupos.

La función es idempotente vía `proyectos.ms_group_id` (columna nueva,
sección 25 de `sql/schema.sql`): si ya tiene valor, no se vuelve a crear el
grupo, solo se re-sincroniza membresía. `proyectos.ms_group_email` guarda
el correo del grupo, usado como remitente de `ms-enviar-notificacion`.

**Membresía**: aditiva únicamente — nunca se saca a nadie del grupo desde
la app, solo se agrega. Miembros: `responsable_comercial_id` +
`project_manager_id` del proyecto, más el `responsable_id` de cada tarea
(se agrega cada vez que se guarda una tarea de ese proyecto). Se resuelve
el email de cada perfil vía la tabla `perfiles` y se asume que coincide con
su userPrincipalName en Microsoft/Entra ID — si algún empleado tiene un
alias o dominio distinto en Microsoft, agregarlo al grupo falla (queda en
el campo `errores` de la respuesta) sin bloquear al resto.

**Carpetas**: "Propuesta" / "Factura Compras" / "Factura Ventas", creadas
en la raíz del drive (SharePoint) del grupo, solo en el momento en que se
crea el grupo (no se reintentan después si fallan parcialmente).

**Calendario**: cada tarea sincroniza su evento en DOS calendarios — el
personal del responsable (`tareas.outlook_event_id`) y el compartido del
grupo del proyecto (`tareas.ms_group_event_id`, columna nueva). Las dos
usan la **misma conexión OAuth delegada del responsable** — Microsoft
Graph no soporta escribir en el calendario de un grupo con un permiso de
aplicación (confirmado con la documentación oficial: `POST
/groups/{id}/events` dice explícitamente "Application: Not supported"),
solo con un permiso delegado de alguien que sea miembro del grupo. Por eso
acá **no hay independencia** entre ambas sync (a diferencia del resto de
la integración de Outlook): si el responsable no conectó su Outlook,
ninguna de las dos puede escribir nada (`ms-sync-evento-tarea` devuelve
`{ personal: {skipped}, grupo: {skipped} }` en ese caso).

En `js/tareas.js`, la sync de membresía (`ms-sync-grupo-proyecto`) se
llama **antes** que la de calendario (`ms-sync-evento-tarea`), a
propósito: el responsable tiene que ya ser miembro del grupo para que
Graph le deje escribir en su calendario compartido. La membresía puede
tardar unos segundos en propagarse del lado de Microsoft — el primer
guardado justo después de agregar a alguien nuevo al grupo podría fallar
igual; un segundo guardado (editar la tarea de nuevo) debería funcionar
una vez que propague. No hay reintento automático para esto.

**Email de avisos**: sigue siendo siempre desde la casilla fija
`MS_REMITENTE_EMAIL`, sin cambios respecto a antes de la Fase 2. Se probó
mandar "como" el grupo del proyecto, pero `POST /groups/{id}/sendMail` **no
existe** en Microsoft Graph — un grupo no tiene una acción de "enviar
mail" propia (solo Conversations/Threads, un mecanismo de lista de correo
interna, distinto a un mail 1 a 1 a una persona puntual). Se revirtió.

Permisos Graph nuevos (Azure Portal → Entra ID → App registrations →
Melirrepu → API permissions):
- `Group.ReadWrite.All` (**Application**, con admin consent) — crear el
  grupo y agregar miembros (`ms-sync-grupo-proyecto`).
- `Files.ReadWrite.All` (**Application**, con admin consent) — crear
  carpetas en el drive del grupo.
- `Group.ReadWrite.All` (**Delegated**, con admin consent para evitar un
  prompt de consentimiento por cada empleado) — para que la conexión de
  Outlook de cada responsable pueda escribir en el calendario del grupo.
  Va en el scope pedido al conectar Outlook (`js/configuracion.js`) y en
  los dos intercambios de token (`ms-oauth-exchange`, y el refresh dentro
  de `ms-sync-evento-tarea`) — los 3 tienen que pedir el mismo scope.

`Group.ReadWrite.All` es un permiso amplio (control sobre todos los grupos
del tenant, no solo los creados por esta app) — no existe uno más angosto
en Graph que cubra creación + membresía.

**Usuarios que ya conectaron su Outlook antes de este permiso nuevo deben
reconectarlo una vez** desde "Mi cuenta" — su token actual no tiene el
scope `Group.ReadWrite.All`, y un refresh token no puede ampliar permisos
por su cuenta; hace falta un login nuevo (nueva pantalla de consentimiento).
Hasta que reconecten, la sync de calendario del grupo para sus tareas
seguirá devolviendo `skipped`.

**Pasos manuales pendientes del usuario** (nada de esto lo puede hacer
Claude Code):
1. Agregar los 3 permisos de arriba en Azure Portal y dar admin consent.
2. Pegar la sección 25 de `sql/schema.sql` en el editor SQL de Supabase
   (staging primero, después prod).
3. Desplegar a mano, vía el editor del dashboard de Supabase (Edge
   Functions → Via Editor): la función nueva `ms-sync-grupo-proyecto` y los
   cambios de código en `ms-sync-evento-tarea` y `ms-enviar-notificacion`
   (staging primero, después prod).
4. Reconectar Outlook (una vez) para cualquier usuario que ya lo hubiera
   conectado antes de este cambio.

## Ambiente de staging

Hasta acá cada push a `main` llegaba directo a producción (GitHub Pages
sirve `main` sin ningún paso intermedio, no hay CI/CD). Para poder probar
cambios antes de que sean visibles en el sitio real, existe una rama
`staging`, separada de `main` en tres capas:

- **Hosting**: `main` se sigue sirviendo desde GitHub Pages, sin ningún
  cambio. La rama `staging` se sirve desde **Cloudflare Pages**
  (`https://mi-pagina-privada.pages.dev`), conectado por git al mismo repo.
  Se eligió
  Cloudflare Pages y no un segundo repo con su propio GitHub Pages porque
  GitHub Pages solo puede servir una rama por repo — Cloudflare Pages
  soporta deploy nativo por rama (sin build, sin CLI), así que el flujo
  queda igual de simple que hoy: `git push` a la rama correspondiente y el
  sitio se actualiza solo.
- **Backend**: staging tiene su **propio proyecto Supabase** (free tier),
  con el mismo `sql/schema.sql` corrido una sola vez y las mismas 3 Edge
  Functions pegadas a mano (ninguna tiene una URL de prod hardcodeada,
  usan `Deno.env.get("SUPABASE_URL")`, así que el código es idéntico). Los
  secrets se configuran con los mismos nombres que en prod, salvo
  `PROJECT_SECRET_KEY` (la secret key propia de ese proyecto) y
  `MS_TOKEN_ENCRYPTION_KEY` (una clave nueva, generada aparte — **nunca**
  la misma que prod, mismo motivo que en la sección de Outlook: perderla
  invalida para siempre las conexiones cifradas con ella). Usuarios de
  prueba y sus filas en `perfiles` se crean a mano, igual que en prod.
- **Microsoft**: se reusa el mismo app registration de Azure ("Melirrepu")
  que usa prod, con un segundo redirect URI agregado
  (`https://mi-pagina-privada.pages.dev/oauth-callback.html`) — evita tener que
  volver a pedir el admin consent de `Mail.Send`, que ya está otorgado
  sobre ese app. `MS_CLIENT_ID`/`MS_TENANT_ID` quedan iguales en ambas
  ramas por eso mismo.

`js/config.js` diverge a propósito entre `main` y `staging` (Supabase y
`MS_REDIRECT_URI` distintos en cada rama) — es el único archivo del repo
donde eso pasa. `.gitattributes` lo marca con `merge=ours` (requiere,
**una sola vez por clon/máquina**, `git config merge.ours.driver true`),
pero **este driver casi nunca protege nada en la práctica**: Git solo lo
invoca cuando los DOS lados de un merge cambiaron el archivo desde el
ancestro común. Como `main` nunca toca `config.js` por su cuenta (solo lo
cambia `staging`), Git ve ese cambio como "sin conflicto" y aplica el de
la otra rama directo, sin pasar nunca por el driver — confirmado
reproduciendo el merge en una rama descartable. Esto ya pisó `config.js`
de producción con los valores de staging **tres veces** (los tres commits
"Corrige config.js..." del historial), con o sin `--no-ff`.

**La protección real es el hook `post-merge`** (`.githooks/post-merge`,
versionado en el repo). Después de CUALQUIER merge (en cualquier
dirección), compara `config.js` contra lo que la rama tenía antes de
mergear (`ORIG_HEAD`) y, si cambió, lo restaura y lo deja `staged` — sin
commitear solo, para revisarlo antes de confirmar. Requiere, **una sola
vez por clon/máquina**:
```
git config core.hooksPath .githooks
```
(además del `git config merge.ours.driver true` de arriba, que se deja
por las dudas pero no es la protección principal). Como red de seguridad
extra, después de cualquier merge entre `main` y `staging` conviene
igual confirmar a ojo que `js/config.js` apunta al Supabase correcto
(prod termina en `zurfciuqrsnlcafdatzf`).

Flujo de trabajo: se prueba en `staging` (viendo los cambios en la URL de
Cloudflare Pages) y, cuando está conforme, se promueve con
`git checkout main && git merge --no-ff staging` (el `--no-ff` sigue
siendo buena práctica para dejar rastro explícito del merge, aunque ya no
sea la única defensa de `config.js`), seguido del chequeo de arriba y
`git push origin main`.

## Patrón de seguridad al agregar una entidad nueva

1. `create table <entidad> (...)`
2. `alter table <entidad> enable row level security;`
3. Políticas para el rol `authenticated`: select/insert/update con `using (true)` / `with check (true)`; delete con `using (public.puede_borrar())`.
4. `grant select, insert, update, delete on public.<entidad> to authenticated;` — **no omitir este paso**, sin él las políticas nunca llegan a evaluarse.
5. `service_role` (la secret key, usada por Edge Functions) ya queda
   cubierto automáticamente gracias al `alter default privileges` de la
   sección 21 de `schema.sql` — no hace falta un GRANT aparte para tablas
   nuevas creadas después de esa migración.

## Próximos pasos pendientes

- **"Dejar de ser solo una app de práctica"** (seguridad/madurez del
  proyecto): ya se hicieron la rotación de secrets expuestos, el
  cifrado de tokens de Outlook (ver sección de Outlook) y el ambiente de
  staging (ver sección "Ambiente de staging" — rama `staging`, proyecto
  Supabase separado, Cloudflare Pages en `mi-pagina-privada.pages.dev` y
  redirect URI de Azure, todo ya creado y verificado: datos aislados de
  producción). Queda:
  - Conversación con la empresa sobre privacidad de datos reales (hoy
    `CLAUDE.md` asume "datos inventados"; si se usa con datos reales de
    empleados, hay que revisar consentimiento e implicancias de manejar
    su calendario/email vía Microsoft Graph).
- La conexión de Outlook creada el 2026-07-07 (antes de cifrar los
  tokens) sigue en texto plano — no rompe nada (se trata como "sin
  conexión válida"), pero esa persona debería reconectar desde "Mi
  cuenta" cuando pueda.
- **Fase 2 (Grupo M365 por proyecto) — pendiente de probar en staging**:
  código ya corregido y desplegado (ver sección "Grupo de Microsoft 365
  por proyecto"), pero falta el admin consent del permiso delegado
  `Group.ReadWrite.All` en Azure (ya agregado, esperando aprobación de un
  admin del tenant). Apenas se apruebe: reconectar Outlook del usuario de
  prueba (scope nuevo, el token viejo no alcanza) y repetir la
  verificación del calendario del grupo — hay un proyecto de prueba ya
  creado (`ms_group_id` `c4e24265-2c41-4527-9e24-3a73fb734a9d`) para no
  tener que armar el caso de cero. Si todo sale bien en staging, replicar
  SQL + despliegue de Edge Functions + permiso de Azure en producción.
