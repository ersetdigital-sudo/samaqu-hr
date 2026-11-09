create index if not exists contract_history_changed_by_idx on public.contract_history (changed_by);
create index if not exists contracts_previous_contract_id_idx on public.contracts (previous_contract_id);
create index if not exists employee_status_history_changed_by_idx on public.employee_status_history (changed_by);
create index if not exists user_access_history_changed_by_idx on public.user_access_history (changed_by);
create index if not exists user_profiles_employee_id_idx on public.user_profiles (employee_id);
create index if not exists user_roles_created_by_idx on public.user_roles (created_by);
create index if not exists user_roles_role_id_idx on public.user_roles (role_id);

alter policy user_profiles_read_self on public.user_profiles
  using ((id = (select auth.uid())) or current_has_role(array['admin'::text]));
alter policy user_roles_read_self on public.user_roles
  using ((user_id = (select auth.uid())) or current_has_role(array['admin'::text]));
