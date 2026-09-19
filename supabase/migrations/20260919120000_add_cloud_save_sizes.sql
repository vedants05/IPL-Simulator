-- Store an authoritative estimate of each cloud save's PostgreSQL payload.
-- This covers the main Zustand state plus the side-storage JSON bundled with it.
alter table public.saves add column if not exists size_bytes bigint;

create or replace function public.set_cloud_save_size()
returns trigger language plpgsql set search_path = public as $$
begin
  new.size_bytes := pg_column_size(new.state) + pg_column_size(new.local_storage);
  return new;
end $$;

drop trigger if exists set_cloud_save_size on public.saves;
create trigger set_cloud_save_size
  before insert or update of state, local_storage on public.saves
  for each row execute function public.set_cloud_save_size();

update public.saves
set size_bytes = pg_column_size(state) + pg_column_size(local_storage)
where size_bytes is null;
