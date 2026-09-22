-- Stores submissions from the public /contact form. Rows are written only
-- by the server (via the service-role client in a server function) — RLS is
-- enabled with no policies at all, so neither the anon nor authenticated
-- keys can read or write this table directly; only the service role
-- (which bypasses RLS) can. The admin /admin/contact page reads and updates
-- this table through the same service-role path, gated by requireAdmin()
-- at the application layer (see require-admin.server.ts) — the same
-- pattern already used for the other admin-only tables.
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text,
  message text not null,
  status text not null default 'new' check (status in ('new', 'read', 'resolved')),
  created_at timestamptz not null default now()
);

create index if not exists contact_messages_status_created_at_idx
  on public.contact_messages (status, created_at desc);

alter table public.contact_messages enable row level security;

comment on table public.contact_messages is
  'Submissions from the public /contact form, reviewed by admins on /admin/contact. Server-only access (service role) gated by requireAdmin(); no anon/authenticated RLS policies are defined on purpose.';
