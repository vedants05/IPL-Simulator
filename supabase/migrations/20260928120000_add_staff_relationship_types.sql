-- Align the database catalog with the save-level staff relationship seeds.
insert into public.dynamic_types (id, name, category, default_is_bidirectional, description, is_custom)
values
  ('preferred_assistant', 'Preferred Assistant', 'staff_staff', true, 'An assistant the head coach repeatedly chooses to work with.', false),
  ('essential_staff', 'Essential Staff', 'staff_staff', true, 'A colleague the head coach explicitly asks the club to retain or appoint.', false)
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  default_is_bidirectional = excluded.default_is_bidirectional,
  description = excluded.description;
