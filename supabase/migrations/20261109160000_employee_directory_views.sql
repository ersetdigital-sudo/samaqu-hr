-- View baca untuk menggabungkan nama atasan tanpa query tambahan.
-- security_invoker memastikan RLS tabel employees tetap berlaku.
create or replace view public.employee_directory
with (security_invoker = true)
as
select
  e.id,
  e.full_name,
  e.position,
  e.department,
  e.location,
  e.manager_id,
  m.full_name as manager_name,
  e.joined_at,
  e.employment_type,
  e.status
from public.employees e
left join public.employees m on m.id = e.manager_id;

create or replace view public.employee_details
with (security_invoker = true)
as
select
  e.id,
  e.full_name,
  e.position,
  e.department,
  e.location,
  e.manager_id,
  m.full_name as manager_name,
  e.joined_at,
  e.employment_type,
  e.status,
  e.gender,
  e.birth_place,
  e.birth_date,
  e.address,
  e.nik,
  e.personal_email,
  e.work_email,
  e.phone,
  e.emergency_name,
  e.emergency_relation,
  e.emergency_phone,
  e.probation_start,
  e.probation_end
from public.employees e
left join public.employees m on m.id = e.manager_id;

revoke all on public.employee_directory from anon, public;
revoke all on public.employee_details from anon, public;
grant select on public.employee_directory to authenticated, service_role;
grant select on public.employee_details to authenticated, service_role;

notify pgrst, 'reload schema';
