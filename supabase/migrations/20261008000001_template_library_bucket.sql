-- Cloud template library (DECISIONS.md, D111).
--
-- Syllabus templates beyond the core bundled with the app live here as public,
-- read-only JSON: catalog.json lists them, templates/<id>.json holds each one.
-- The app fetches a template only when a student picks it. As with themes, a
-- public bucket needs no read policy, and with no write policy only the service
-- role (the maintainer's CLI) can change what is offered.

insert into storage.buckets (id, name, public, file_size_limit)
values ('templates', 'templates', true, 1048576)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;
