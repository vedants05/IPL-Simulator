-- Usernames. Supabase Auth only knows emails, so the app maps a username to
-- an internal address and keeps the real username here, unique and public
-- enough for an availability check before sign-up.
alter table public.profiles add column if not exists username text;
create unique index if not exists profiles_username_key on public.profiles (lower(username));

-- Copy the username from sign-up metadata into profiles automatically.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, display_name)
  values (new.id, new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'username')
  on conflict (id) do update set username = excluded.username;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Anyone (including signed-out visitors on the sign-up form) may ask whether a
-- username is taken. Returns only a boolean, never the row.
create or replace function public.username_available(candidate text)
returns boolean language sql security definer stable set search_path = public as $$
  select not exists (select 1 from public.profiles where lower(username) = lower(candidate));
$$;
grant execute on function public.username_available(text) to anon, authenticated;

-- Side data the game keeps in browser storage (stadium builder, career
-- snapshots, SMAT, news) travels with the save.
alter table public.saves add column if not exists local_storage jsonb not null default '{}'::jsonb;
