-- Pega este script una sola vez en el SQL Editor de tu panel de Supabase
-- (Dashboard -> SQL Editor -> New query -> pegar -> Run).

-- 1) Tabla de proyectos
create table if not exists proyectos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  estado text not null default 'Pendiente',
  fecha date,
  created_at timestamptz not null default now()
);

-- 2) Activar Row Level Security.
-- A partir de aquí, por defecto NADIE puede leer ni escribir la tabla
-- hasta que se creen políticas explícitas (estado seguro por defecto).
alter table proyectos enable row level security;

-- 3) Políticas: solo usuarios autenticados (con sesión iniciada) pueden
-- leer y escribir. El rol "anon" (no autenticado / público) no tiene
-- ninguna política a su favor, así que queda bloqueado.
-- Como es una lista compartida, no se filtra por usuario: cualquier
-- empleado autenticado puede ver y modificar cualquier proyecto.

create policy "Usuarios autenticados pueden leer proyectos"
  on proyectos for select
  to authenticated
  using (true);

create policy "Usuarios autenticados pueden crear proyectos"
  on proyectos for insert
  to authenticated
  with check (true);

create policy "Usuarios autenticados pueden editar proyectos"
  on proyectos for update
  to authenticated
  using (true)
  with check (true);

create policy "Usuarios autenticados pueden borrar proyectos"
  on proyectos for delete
  to authenticated
  using (true);

-- 4) Permiso de tabla (GRANT). RLS decide QUÉ filas puede tocar un rol,
-- pero antes de eso Postgres exige que el rol tenga permiso básico sobre
-- la tabla para esa operación. Sin este GRANT, las políticas de arriba
-- nunca llegan a evaluarse y Postgres responde "permission denied".
grant select, insert, update, delete on public.proyectos to authenticated;

-- 5) Tabla de clientes (mismo patrón que proyectos: RLS + políticas +
-- GRANT, lista compartida entre todos los empleados autenticados).
create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text,
  telefono text,
  empresa text,
  notas text,
  created_at timestamptz not null default now()
);

alter table clientes enable row level security;

create policy "Usuarios autenticados pueden leer clientes"
  on clientes for select
  to authenticated
  using (true);

create policy "Usuarios autenticados pueden crear clientes"
  on clientes for insert
  to authenticated
  with check (true);

create policy "Usuarios autenticados pueden editar clientes"
  on clientes for update
  to authenticated
  using (true)
  with check (true);

create policy "Usuarios autenticados pueden borrar clientes"
  on clientes for delete
  to authenticated
  using (true);

grant select, insert, update, delete on public.clientes to authenticated;

-- 6) Relación: cada proyecto pertenece opcionalmente a un cliente.
-- "references clientes(id)" = clave foránea: cliente_id solo puede ser
-- el id de un cliente que de verdad existe (o NULL, si no se asigna).
-- "on delete set null" = si se borra ese cliente, el proyecto NO se borra;
-- simplemente queda con cliente_id en NULL ("sin cliente").
alter table proyectos
  add column if not exists cliente_id uuid references clientes(id) on delete set null;

-- 7) Roles: tabla "perfiles" (una fila por usuario, vinculada a auth.users)
-- con el rol de cada uno. Las asignaciones de rol las hace el administrador
-- manualmente desde el SQL Editor / Table Editor de Supabase, nunca desde
-- la app.
create table if not exists perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  rol text not null default 'empleado' check (rol in ('admin', 'empleado'))
);

alter table perfiles enable row level security;

-- Cada usuario puede leer SOLO su propio perfil. A propósito no se crea
-- ninguna política de insert/update para "authenticated": nadie puede
-- crear ni modificar su propio perfil (ni su rol) desde la app.
create policy "Cada usuario lee su propio perfil"
  on perfiles for select
  to authenticated
  using (id = auth.uid());

grant select on public.perfiles to authenticated;

-- Función "security definer": se ejecuta con los permisos de quien la creó
-- (no de quien la llama), así que esta consulta a "perfiles" no vuelve a
-- pasar por las políticas de RLS de perfiles. Esto evita la recursión
-- infinita que ocurriría si las políticas de proyectos/clientes consultaran
-- "perfiles" directamente (lo cual a su vez aplicaría RLS sobre perfiles,
-- en un ciclo). Centralizar la pregunta "¿es admin?" aquí también la hace
-- reutilizable y más eficiente.
create or replace function public.es_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from perfiles where id = auth.uid() and rol = 'admin'
  );
$$;

grant execute on function public.es_admin() to authenticated;

-- 8) Solo admins pueden borrar. Se reemplazan las políticas de delete de
-- proyectos y clientes; select/insert/update quedan igual que antes.
drop policy "Usuarios autenticados pueden borrar proyectos" on proyectos;

create policy "Solo admins pueden borrar proyectos"
  on proyectos for delete
  to authenticated
  using (public.es_admin());

drop policy "Usuarios autenticados pueden borrar clientes" on clientes;

create policy "Solo admins pueden borrar clientes"
  on clientes for delete
  to authenticated
  using (public.es_admin());

-- 9) Tabla de proveedores (mismo patrón que clientes: RLS + políticas +
-- GRANT, lista compartida; el delete ya queda restringido a admins desde
-- el inicio, usando la misma función public.es_admin()).
create table if not exists proveedores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text,
  telefono text,
  rubro text,
  notas text,
  created_at timestamptz not null default now()
);

alter table proveedores enable row level security;

create policy "Usuarios autenticados pueden leer proveedores"
  on proveedores for select
  to authenticated
  using (true);

create policy "Usuarios autenticados pueden crear proveedores"
  on proveedores for insert
  to authenticated
  with check (true);

create policy "Usuarios autenticados pueden editar proveedores"
  on proveedores for update
  to authenticated
  using (true)
  with check (true);

create policy "Solo admins pueden borrar proveedores"
  on proveedores for delete
  to authenticated
  using (public.es_admin());

grant select, insert, update, delete on public.proveedores to authenticated;

-- 10) Tabla de ofertas (relacionada opcionalmente con clientes, monto en
-- "numeric" para dinero exacto, y "estado" restringido a 3 valores fijos
-- con un check, además del <select> del formulario).
create table if not exists ofertas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  monto numeric(12, 2) not null,
  cliente_id uuid references clientes(id) on delete set null,
  estado text not null default 'Pendiente' check (estado in ('Pendiente', 'Aprobada', 'Rechazada')),
  fecha date,
  created_at timestamptz not null default now()
);

alter table ofertas enable row level security;

create policy "Usuarios autenticados pueden leer ofertas"
  on ofertas for select
  to authenticated
  using (true);

create policy "Usuarios autenticados pueden crear ofertas"
  on ofertas for insert
  to authenticated
  with check (true);

create policy "Usuarios autenticados pueden editar ofertas"
  on ofertas for update
  to authenticated
  using (true)
  with check (true);

create policy "Solo admins pueden borrar ofertas"
  on ofertas for delete
  to authenticated
  using (public.es_admin());

grant select, insert, update, delete on public.ofertas to authenticated;

-- 11) Tabla de facturas (relacionada opcionalmente con proyectos, monto en
-- "numeric" para dinero exacto, y "estado" restringido a 3 valores fijos
-- con un check, además del <select> del formulario).
create table if not exists facturas (
  id uuid primary key default gen_random_uuid(),
  numero text not null,
  monto numeric(12, 2) not null,
  proyecto_id uuid references proyectos(id) on delete set null,
  estado text not null default 'Pendiente' check (estado in ('Pendiente', 'Pagada', 'Vencida')),
  fecha date,
  created_at timestamptz not null default now()
);

alter table facturas enable row level security;

create policy "Usuarios autenticados pueden leer facturas"
  on facturas for select
  to authenticated
  using (true);

create policy "Usuarios autenticados pueden crear facturas"
  on facturas for insert
  to authenticated
  with check (true);

create policy "Usuarios autenticados pueden editar facturas"
  on facturas for update
  to authenticated
  using (true)
  with check (true);

create policy "Solo admins pueden borrar facturas"
  on facturas for delete
  to authenticated
  using (public.es_admin());

grant select, insert, update, delete on public.facturas to authenticated;

-- 12) Tabla de tareas (relacionada opcionalmente con proyectos, "estado"
-- restringido a 3 valores fijos, y un check de fechas: fecha_termino no
-- puede ser anterior a fecha_inicio. Un check solo RECHAZA la fila cuando
-- da "false"; si fecha_inicio o fecha_termino son NULL, la comparación da
-- NULL, y Postgres trata NULL como "constraint cumplida" — por eso esta
-- única línea ya permite que falte una fecha, la otra, o ambas.
create table if not exists tareas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text,
  proyecto_id uuid references proyectos(id) on delete set null,
  responsable_nombre text,
  responsable_email text,
  estado text not null default 'Pendiente' check (estado in ('Pendiente', 'En curso', 'Hecha')),
  fecha_inicio date,
  fecha_termino date,
  created_at timestamptz not null default now(),
  check (fecha_termino >= fecha_inicio)
);

alter table tareas enable row level security;

create policy "Usuarios autenticados pueden leer tareas"
  on tareas for select
  to authenticated
  using (true);

create policy "Usuarios autenticados pueden crear tareas"
  on tareas for insert
  to authenticated
  with check (true);

create policy "Usuarios autenticados pueden editar tareas"
  on tareas for update
  to authenticated
  using (true)
  with check (true);

create policy "Solo admins pueden borrar tareas"
  on tareas for delete
  to authenticated
  using (public.es_admin());

grant select, insert, update, delete on public.tareas to authenticated;

-- 13) Ampliar los roles permitidos en perfiles: se agregan
-- 'director_comercial' y 'gerente_general' junto a los dos existentes.
-- Por ahora esto NO cambia ninguna política ni la función es_admin(): los
-- roles nuevos hoy se comportan igual que 'empleado' (no son admin), hasta
-- que se decida más adelante qué permisos tiene cada uno.
alter table perfiles drop constraint perfiles_rol_check;

alter table perfiles
  add constraint perfiles_rol_check
  check (rol in ('admin', 'empleado', 'director_comercial', 'gerente_general'));

-- 14) Sistema de aprobaciones (paso 1): columna calculada
-- "nivel_aprobacion" en ofertas, según el monto.
--
-- UMBRALES (cambiarlos aquí si cambian las reglas de negocio):
--   - monto <= 1.000.000                     -> 'ninguno'
--   - monto > 1.000.000 y <= 10.000.000      -> 'director'
--   - monto > 10.000.000                     -> 'gerente'
alter table ofertas
  add column if not exists nivel_aprobacion text
  generated always as (
    case
      when monto <= 1000000 then 'ninguno'    -- UMBRAL 1: tope sin aprobación
      when monto <= 10000000 then 'director'  -- UMBRAL 2: tope aprobación director
      else 'gerente'
    end
  ) stored;

-- 15) Sistema de aprobaciones (paso 2): función que decide si el usuario
-- actual puede aprobar una oferta concreta, según su nivel_aprobacion y el
-- rol del usuario en perfiles. security definer + search_path fijo, igual
-- que es_admin(), para leer perfiles sin pasar de nuevo por su RLS.
create or replace function public.puede_aprobar_oferta(oferta_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (
      select case o.nivel_aprobacion
        when 'ninguno' then true
        when 'director' then exists (
          select 1 from perfiles p
          where p.id = auth.uid() and p.rol in ('director_comercial', 'gerente_general')
        )
        when 'gerente' then exists (
          select 1 from perfiles p
          where p.id = auth.uid() and p.rol = 'gerente_general'
        )
        else false
      end
      from ofertas o
      where o.id = oferta_id
    ),
    false
  );
$$;

grant execute on function public.puede_aprobar_oferta(uuid) to authenticated;

-- 16) Aplicar la aprobación: se reemplaza la política de update de
-- ofertas. La cláusula USING no cambia (cualquiera puede seguir
-- localizando/editando cualquier oferta); lo que cambia es el WITH CHECK,
-- que valida la fila DESPUÉS del cambio: se permite cualquier edición
-- excepto que la fila quede con estado = 'Aprobada' sin que
-- puede_aprobar_oferta(id) sea true para quien hace la petición.
drop policy "Usuarios autenticados pueden editar ofertas" on ofertas;

create policy "Usuarios autenticados editan ofertas, aprobar requiere permiso"
  on ofertas for update
  to authenticated
  using (true)
  with check (
    estado <> 'Aprobada' or public.puede_aprobar_oferta(id)
  );

-- 17) Paso 1 de "convertir oferta aprobada en proyecto": columna opcional
-- en proyectos que indica de qué oferta nació (si nació de alguna), más
-- una regla que impide que dos proyectos apunten a la misma oferta.
alter table proyectos
  add column if not exists oferta_id uuid references ofertas(id) on delete set null;

-- Índice único PARCIAL: la regla de "no repetir oferta_id" solo aplica a
-- filas con oferta_id no nulo. Los proyectos sin oferta (oferta_id = NULL)
-- quedan fuera del índice, así que puede haber cualquier cantidad de ellos.
create unique index if not exists proyectos_oferta_id_unique_idx
  on proyectos (oferta_id)
  where oferta_id is not null;

-- 18) Paso 2: función que convierte una oferta aprobada en un proyecto
-- nuevo. plpgsql (no sql) porque necesita varias validaciones secuenciales
-- y un INSERT condicional, no solo una expresión.
create or replace function public.convertir_oferta_en_proyecto(oferta_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_oferta ofertas%rowtype;
  v_rol text;
  v_nuevo_id uuid;
begin
  select * into v_oferta from ofertas where id = oferta_id;

  if v_oferta is null then
    raise exception 'La oferta no existe';
  end if;

  if v_oferta.estado <> 'Aprobada' then
    raise exception 'Solo se pueden convertir ofertas en estado Aprobada (esta está en %)', v_oferta.estado;
  end if;

  select rol into v_rol from perfiles where id = auth.uid();

  if v_rol is null or v_rol not in ('director_comercial', 'gerente_general') then
    raise exception 'No tienes permiso para convertir ofertas en proyectos';
  end if;

  if exists (select 1 from proyectos p where p.oferta_id = v_oferta.id) then
    raise exception 'Esta oferta ya fue convertida en un proyecto';
  end if;

  insert into proyectos (nombre, cliente_id, oferta_id)
  values (v_oferta.titulo, v_oferta.cliente_id, v_oferta.id)
  returning id into v_nuevo_id;

  return v_nuevo_id;
end;
$$;

grant execute on function public.convertir_oferta_en_proyecto(uuid) to authenticated;

-- 20) Responsable vinculado en tareas.
--
-- a) Columna email en perfiles (espeja auth.users.email para que el frontend
--    pueda consultar perfiles directamente y armar el selector de responsables).
alter table perfiles
  add column if not exists email text;

-- b) FK responsable_id en tareas hacia perfiles (no hacia auth.users directamente:
--    perfiles ya garantiza que son usuarios activos del equipo).
--    "on delete set null": si se borra el perfil, la tarea queda sin responsable.
--    Las columnas responsable_nombre / responsable_email se conservan como respaldo
--    histórico de datos anteriores a esta migración.
alter table tareas
  add column if not exists responsable_id uuid references public.perfiles(id) on delete set null;

-- c) Ampliar política de select de perfiles: cualquier autenticado puede leer
--    TODOS los perfiles (antes solo el propio). Cambio deliberado y necesario
--    para poblar el selector de responsables en el formulario de Tareas.
--    Las políticas de insert/update/delete permanecen sin cambios — los roles
--    siguen asignándose solo desde el SQL Editor / Table Editor de Supabase.
drop policy if exists "Cada usuario lee su propio perfil" on perfiles;

create policy "Usuarios autenticados pueden leer todos los perfiles"
  on perfiles for select
  to authenticated
  using (true);
-- GRANT select on public.perfiles ya existe desde la sección 7; no se repite.

-- 19) Nueva regla de borrado: admin, director_comercial y gerente_general
-- pueden borrar (antes solo admin). Se usa una lista de roles permitidos
-- ("rol in (...)"), no "rol <> 'empleado'": así, un usuario sin fila en
-- perfiles (o con un rol futuro no contemplado) no aparece en la lista y
-- el exists() da false — falla de forma segura, no permite de más.
create or replace function public.puede_borrar()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from perfiles
    where id = auth.uid()
    and rol in ('admin', 'director_comercial', 'gerente_general')
  );
$$;

grant execute on function public.puede_borrar() to authenticated;

drop policy "Solo admins pueden borrar proyectos" on proyectos;

create policy "Admin, director o gerente pueden borrar proyectos"
  on proyectos for delete
  to authenticated
  using (public.puede_borrar());

drop policy "Solo admins pueden borrar clientes" on clientes;

create policy "Admin, director o gerente pueden borrar clientes"
  on clientes for delete
  to authenticated
  using (public.puede_borrar());

drop policy "Solo admins pueden borrar proveedores" on proveedores;

create policy "Admin, director o gerente pueden borrar proveedores"
  on proveedores for delete
  to authenticated
  using (public.puede_borrar());

drop policy "Solo admins pueden borrar ofertas" on ofertas;

create policy "Admin, director o gerente pueden borrar ofertas"
  on ofertas for delete
  to authenticated
  using (public.puede_borrar());

drop policy "Solo admins pueden borrar facturas" on facturas;

create policy "Admin, director o gerente pueden borrar facturas"
  on facturas for delete
  to authenticated
  using (public.puede_borrar());

drop policy "Solo admins pueden borrar tareas" on tareas;

create policy "Admin, director o gerente pueden borrar tareas"
  on tareas for delete
  to authenticated
  using (public.puede_borrar());

-- 21) Integración con Microsoft Outlook (Microsoft Graph API).
--
-- a) ms_conexiones: guarda el token OAuth de cada usuario que conectó su
--    cuenta de Outlook (para poder crear eventos en SU calendario). A
--    diferencia de las 6 tablas "lista compartida" del proyecto
--    (using(true) en select/insert/update), esta es una excepción
--    deliberada: son credenciales de acceso al calendario personal de un
--    tercero (Microsoft), y filtrarlas entre compañeros permitiría leer o
--    escribir el calendario ajeno desde fuera de la app. Por eso cada fila
--    es visible/editable solo por su propio dueño (auth.uid()). Las Edge
--    Functions leen/escriben filas ajenas usando la service role key, que
--    en Supabase evita RLS por diseño, sin necesitar una política aparte.
--
-- Nota (2026-07): ms_access_token/ms_refresh_token viajan cifrados
-- (AES-GCM) desde la aplicación antes de llegar acá — la columna sigue
-- siendo "text" sin cambios de tipo, pero el contenido ya no es el token
-- en texto plano, sino base64(IV || ciphertext). El cifrado/descifrado
-- vive en las Edge Functions (ms-oauth-exchange, ms-sync-evento-tarea),
-- nunca en SQL, para que la clave de cifrado (secret
-- MS_TOKEN_ENCRYPTION_KEY) nunca tenga que pasar por la base. Motivo: RLS
-- protege esta tabla de OTROS usuarios de la app, pero no de alguien con
-- la secret key (PROJECT_SECRET_KEY) — el cifrado sube esa barra. Filas
-- guardadas antes de este cambio quedan en texto plano hasta que su
-- dueño reconecte su Outlook (el intento de descifrarlas falla y se
-- tratan como "sin conexión", nunca como error).
create table if not exists ms_conexiones (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ms_access_token text not null,
  ms_refresh_token text not null,
  ms_token_expires_at timestamptz not null,
  ms_scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table ms_conexiones enable row level security;

create policy "Usuario ve solo su propia conexión"
  on ms_conexiones for select
  to authenticated
  using (user_id = auth.uid());

create policy "Usuario crea solo su propia conexión"
  on ms_conexiones for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Usuario actualiza solo su propia conexión"
  on ms_conexiones for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Usuario borra solo su propia conexión"
  on ms_conexiones for delete
  to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on public.ms_conexiones to authenticated;

-- b) outlook_event_id en tareas: id del evento ya creado en Outlook para
--    esa tarea (si el responsable conectó su cuenta). Permite actualizar o
--    borrar el evento correcto en vez de crear uno nuevo cada vez que se
--    edita la tarea. La escriben las Edge Functions (vía service role);
--    no requiere cambios de política porque insert/update de tareas ya
--    son using(true)/with check(true).
alter table tareas
  add column if not exists outlook_event_id text;

-- c) A diferencia de "authenticated" (usado por el navegador), a
--    "service_role" (el rol de la secret key, usado por las Edge
--    Functions) nunca se le habían dado permisos sobre ninguna tabla en
--    este proyecto — RLS y GRANT son independientes: bypassear RLS no
--    alcanza, Postgres igual exige el GRANT explícito. ms-sync-evento-tarea
--    lo necesita para leer/actualizar tareas y ms_conexiones de un usuario
--    que no es quien hizo el pedido (el responsable de la tarea).
grant usage on schema public to service_role;
grant select, insert, update, delete on public.tareas to service_role;
grant select, insert, update, delete on public.perfiles to service_role;
grant select, insert, update, delete on public.ms_conexiones to service_role;

-- d) Mismo motivo que (c): ms-sync-evento-tarea y ms-enviar-notificacion
--    necesitan leer el proyecto (y su cliente) de una tarea para incluir
--    esa info en el evento de Outlook y el email. El "alter default
--    privileges" de arriba no alcanza acá porque solo cubre tablas creadas
--    DESPUÉS de esa línea — proyectos y clientes son de antes.
grant select on public.proyectos to service_role;
grant select on public.clientes to service_role;

-- Para que cualquier tabla nueva que se agregue después también quede
-- accesible a service_role sin tener que acordarse de este paso cada vez.
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

-- 22) Autocompletar perfiles al crear un usuario nuevo.
--
-- Antes, dar de alta un usuario eran dos pasos manuales separados
-- (crearlo en Authentication, después insertar a mano su fila en
-- perfiles) y nada garantizaba que el segundo paso se hiciera ni que el
-- email quedara bien cargado — un email vacío en perfiles rompe en
-- silencio cualquier flujo que dependa de él (ej. el aviso por mail de
-- Outlook). Este trigger crea la fila de perfiles automáticamente apenas
-- se crea el usuario en auth.users, con el email ya completo y rol en su
-- valor por defecto ('empleado'). Seguir sin abrir alta pública: el
-- usuario en Authentication lo sigue creando un admin a mano desde el
-- panel, esto solo automatiza el paso de después. Cambiar el rol a algo
-- distinto de 'empleado' sigue siendo manual (Table Editor -> perfiles).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 23) Detalle de Ofertas: Responsable/Aprobador en la oferta, catálogo de
-- equipos reutilizable, y líneas de detalle con los datos de instalación
-- de cada equipo en esa oferta puntual. Responsable/Aprobador son solo
-- informativos (no disparan mail ni cambian quién puede aprobar — eso
-- sigue siendo puede_aprobar_oferta() por monto).
alter table ofertas
  add column if not exists responsable_id uuid references public.perfiles(id) on delete set null;
alter table ofertas
  add column if not exists aprobador_id uuid references public.perfiles(id) on delete set null;

-- Catálogo reutilizable: mismo patrón "lista compartida" que Clientes/Proveedores.
create table if not exists equipos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  marca text,
  modelo text,
  created_at timestamptz not null default now()
);

alter table equipos enable row level security;

create policy "Usuarios autenticados pueden leer equipos"
  on equipos for select to authenticated using (true);
create policy "Usuarios autenticados pueden crear equipos"
  on equipos for insert to authenticated with check (true);
create policy "Usuarios autenticados pueden editar equipos"
  on equipos for update to authenticated using (true) with check (true);
create policy "Admin, director o gerente pueden borrar equipos"
  on equipos for delete to authenticated using (public.puede_borrar());

grant select, insert, update, delete on public.equipos to authenticated;

-- Detalle: pertenece por completo a una oferta (on delete cascade, a
-- diferencia del resto del proyecto que usa "set null" para relaciones
-- opcionales) — una línea de detalle no tiene sentido sin su oferta.
create table if not exists detalle_ofertas (
  id uuid primary key default gen_random_uuid(),
  oferta_id uuid not null references public.ofertas(id) on delete cascade,
  equipo_id uuid references public.equipos(id) on delete set null,
  cantidad integer,
  plazo_entrega_dias integer,
  proveedor_id uuid references public.proveedores(id) on delete set null,
  fecha_instalacion date,
  duracion_instalacion text,
  responsable_instalacion_id uuid references public.perfiles(id) on delete set null,
  fecha_comisionamiento date,
  fecha_pruebas date,
  fecha_puesta_servicio date,
  criterio_aceptacion text,
  inicio_garantia date,
  created_at timestamptz not null default now()
);

alter table detalle_ofertas enable row level security;

create policy "Usuarios autenticados pueden leer detalle_ofertas"
  on detalle_ofertas for select to authenticated using (true);
create policy "Usuarios autenticados pueden crear detalle_ofertas"
  on detalle_ofertas for insert to authenticated with check (true);
create policy "Usuarios autenticados pueden editar detalle_ofertas"
  on detalle_ofertas for update to authenticated using (true) with check (true);
create policy "Admin, director o gerente pueden borrar detalle_ofertas"
  on detalle_ofertas for delete to authenticated using (public.puede_borrar());

grant select, insert, update, delete on public.detalle_ofertas to authenticated;
-- service_role queda cubierto solo por el "alter default privileges" de la
-- sección 21; no hace falta GRANT aparte (tablas creadas después de esa migración).
