-- MIGRACIÓN DE UNA SOLA VEZ — ejecutar manualmente en el SQL Editor de Supabase
-- DESPUÉS de haber aplicado la sección 20 del schema.sql.
-- No forma parte del schema permanente; corre una vez y puede descartarse.

-- Paso 1: rellenar perfiles.email desde auth.users.
-- Si un perfil ya tiene email (ej. se corrió esto antes), el UPDATE es idempotente.
update perfiles p
  set email = u.email
  from auth.users u
  where p.id = u.id;

-- Paso 2: vincular tareas existentes que tienen responsable_email con un usuario real.
-- Solo actúa sobre filas con responsable_email no nulo y responsable_id aún vacío.
-- La comparación es case-insensitive. Las tareas que no matcheen quedan con
-- responsable_id = null y conservan responsable_nombre / responsable_email intactos.
update tareas t
  set responsable_id = p.id
  from auth.users u
  join perfiles p on p.id = u.id
  where t.responsable_email is not null
    and lower(t.responsable_email) = lower(u.email)
    and t.responsable_id is null;

-- Verificación: tareas con email que NO matchearon (revisar a mano).
-- Estos quedarán con responsable_id = null hasta que se reasignen desde el formulario.
select id, titulo, responsable_nombre, responsable_email
from tareas
where responsable_email is not null
  and responsable_id is null;
