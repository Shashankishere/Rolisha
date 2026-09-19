-- Adds real file/screenshot evidence to the task workspace, alongside the
-- existing written note + link (see 20260905020000_project_task_workspace).
-- A task still cannot be completed by uploading a file alone — that gate is
-- unchanged in projects.server.ts (a real >=20 character note is still
-- required). Evidence is optional supporting proof, stored privately.
--
-- Files live in a private ('public: false') Storage bucket, never a public
-- one — nothing here is fetchable without a signed URL minted for the
-- owning user. Metadata (who/which project/which task/file name/size/type)
-- lives in `task_evidence` so the workspace can list, associate, and delete
-- evidence without touching Storage for anything but the bytes themselves.
--
-- Path convention enforced by the storage policies below:
--   {user_id}/{project_id}/{task_index}/{uuid}-{sanitized file name}
-- `(storage.foldername(name))[1]` is the first path segment, i.e. user_id —
-- the same "own folder only" pattern Supabase's docs recommend for
-- per-user private buckets.

insert into storage.buckets (id, name, public)
values ('task-evidence', 'task-evidence', false)
on conflict (id) do nothing;

create table if not exists public.task_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  task_index integer not null check (task_index >= 0),
  storage_path text not null unique,
  file_name text not null,
  file_size integer not null check (file_size > 0),
  mime_type text not null,
  created_at timestamptz not null default now()
);

create index if not exists task_evidence_owner_task_idx
  on public.task_evidence (user_id, project_id, task_index);

alter table public.task_evidence enable row level security;

-- Same "own rows only" shape as the existing "own user_projects" policy —
-- a user can read/insert/delete only their own evidence rows. There is no
-- separate reviewer/admin role for project evidence today, so no bypass
-- policy is added; if one is introduced later it should follow the same
-- has_role() pattern used for contact-message admin access.
drop policy if exists "own task_evidence" on public.task_evidence;
create policy "own task_evidence" on public.task_evidence
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own task evidence objects read" on storage.objects;
create policy "own task evidence objects read"
  on storage.objects for select to authenticated
  using (bucket_id = 'task-evidence' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own task evidence objects insert" on storage.objects;
create policy "own task evidence objects insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'task-evidence' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own task evidence objects delete" on storage.objects;
create policy "own task evidence objects delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'task-evidence' and (storage.foldername(name))[1] = auth.uid()::text);

comment on table public.task_evidence is
  'Metadata for files/screenshots uploaded as evidence in the project task workspace. The bytes live in the private "task-evidence" Storage bucket at {user_id}/{project_id}/{task_index}/... — never publicly accessible. Evidence is optional supporting proof; the 20-character written note is still the only hard requirement to complete a task (see submitProjectTask in projects.server.ts).';
