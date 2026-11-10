-- Hardening fungsi template onboarding: kunci search_path sesuai advisor.
alter function public.onboarding_template_items()
  set search_path = pg_catalog, pg_temp;
