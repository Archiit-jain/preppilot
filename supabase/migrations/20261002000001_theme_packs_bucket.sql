-- Downloadable themes (DECISIONS.md, D106).
--
-- The theme catalog, packs and fonts are public, read-only files: the app
-- fetches them over plain HTTPS from /storage/v1/object/public/themes/... when a
-- student opens Settings -> Themes, and only then. A public bucket serves reads
-- without any policy, and no insert, update or delete policy is created, so
-- only the service role (the maintainer's CLI) can change what is offered.
--
-- 2 MB per file is well above the largest font (~260 KB) and stops the bucket
-- being used for anything else.

insert into storage.buckets (id, name, public, file_size_limit)
values ('themes', 'themes', true, 2097152)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;
