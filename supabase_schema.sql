-- ============================================================
--  IT Helpdesk Pro — Supabase schema
--  Run this once in your Supabase project's SQL Editor:
--  Dashboard -> SQL Editor -> New query -> paste all of this -> Run
-- ============================================================

-- ---------- departments ----------
create table if not exists departments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text default '',
  created_at  timestamptz not null default now()
);

-- ---------- agents (IT staff accounts incl. the admin) ----------
create table if not exists agents (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  username    text not null unique,
  password    text not null,           -- demo-only; see note at bottom of file
  email       text default '',
  role        text not null default 'Agent' check (role in ('Admin', 'Agent')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------- tickets ----------
create table if not exists tickets (
  id                   uuid primary key default gen_random_uuid(),
  num                  bigint generated always as identity (start with 1044),
  title                text not null,
  description          text default '',
  category             text default 'Other',
  department           text default 'IT',
  priority             text not null default 'Medium' check (priority in ('Low','Medium','High','Critical')),
  status               text not null default 'Open' check (status in ('Open','In Progress','Resolved','Closed')),
  requester_name       text not null,
  requester_email      text default '',
  requester_phone      text default '',
  requester_type       text not null default 'Internal' check (requester_type in ('Internal','External')),
  requester_department text default '',
  assigned_to          text default '',
  tags                 text[] default '{}',
  sentiment            text default 'Calm',
  summary              text default '',
  ai_triaged           boolean default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  resolved_at          timestamptz
);

-- ---------- comments (public replies + internal notes) ----------
create table if not exists comments (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references tickets(id) on delete cascade,
  author      text not null,
  body        text not null,
  internal    boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists comments_ticket_id_idx on comments(ticket_id);
create index if not exists tickets_status_idx on tickets(status);

-- ============================================================
--  Row Level Security
--  The app uses the public "anon" key everywhere (no Supabase Auth
--  login flow — staff login is checked against the agents table by
--  the app itself). That means RLS policies here are the only thing
--  standing between the internet and your data, so:
--    - anyone can INSERT a ticket (that's the public request form)
--    - anyone can READ/UPDATE tickets, comments, agents, departments
--      using the anon key, same as the rest of this demo app
--  This matches the current app's trust model (no real auth yet).
--  Tighten these once you add Supabase Auth — see note at the end.
-- ============================================================

alter table departments enable row level security;
alter table agents       enable row level security;
alter table tickets      enable row level security;
alter table comments     enable row level security;

create policy "departments_select" on departments for select using (true);
create policy "departments_insert" on departments for insert with check (true);
create policy "departments_update" on departments for update using (true);
create policy "departments_delete" on departments for delete using (true);

create policy "agents_select" on agents for select using (true);
create policy "agents_insert" on agents for insert with check (true);
create policy "agents_update" on agents for update using (true);
create policy "agents_delete" on agents for delete using (true);

create policy "tickets_select" on tickets for select using (true);
create policy "tickets_insert" on tickets for insert with check (true);
create policy "tickets_update" on tickets for update using (true);
create policy "tickets_delete" on tickets for delete using (true);

create policy "comments_select" on comments for select using (true);
create policy "comments_insert" on comments for insert with check (true);
create policy "comments_update" on comments for update using (true);
create policy "comments_delete" on comments for delete using (true);

-- ---------- seed data (safe to skip/edit) ----------
insert into departments (name, description) values
  ('IT', 'Hardware, software, network & accounts'),
  ('Human Resources', 'Payroll, benefits, onboarding'),
  ('Finance', 'Invoices, expenses, procurement'),
  ('Operations', 'Facilities & general operations'),
  ('Sales', 'CRM & customer-facing tools'),
  ('Other', 'Anything that doesn''t fit above')
on conflict (name) do nothing;

insert into agents (name, username, password, email, role) values
  ('Admin', 'admin', 'admin123', 'admin@company.com', 'Admin')
on conflict (username) do nothing;

-- ============================================================
--  IMPORTANT — read before going live with real users
--
--  1. Plaintext passwords: the `agents.password` column is plain text,
--     matching how the original local-storage demo worked. Anyone with
--     your anon key can read it via "agents_select" above. For real use,
--     migrate to Supabase Auth (supabase.auth.signInWithPassword) and
--     drop the password column entirely — Auth handles hashing for you.
--
--  2. Wide-open RLS: every policy here uses `using (true)`, meaning the
--     anon key can read/write everything. That's required for the public
--     ticket form to work without a login, but it also means any visitor
--     could, in principle, call the API directly and edit other people's
--     tickets or staff accounts. Once you add Supabase Auth, tighten these
--     to check auth.uid() / auth.role() so only signed-in agents can
--     write to `agents`, `departments`, and update tickets, while the
--     public can still INSERT into tickets and SELECT their own by email.
-- ============================================================
