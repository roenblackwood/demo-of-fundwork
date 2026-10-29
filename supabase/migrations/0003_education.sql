-- Mentor names and the first-commitment hold. Do not edit 0001 or 0002.

alter table public.projects
  add column mentor_name text;

alter table public.commitments
  add column counts_at timestamptz;

-- The first commitment of a new account counts 24 hours later.
-- Later commitments count right away. The app sets counts_at on insert.
