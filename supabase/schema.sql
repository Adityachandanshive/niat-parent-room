-- ============================================================
-- NIAT Parent Decision Room — Supabase Schema
-- ============================================================

-- leads table
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  parent_name text not null,
  child_name text not null,
  phone text,
  city text,
  campus text,
  budget_range text,
  language text default 'en',
  primary_concern text,
  objection_category text,
  intent_score int default 0,
  report_completed boolean default false,
  voice_call_done boolean default false,
  counselor_booked boolean default false,
  report_text text,
  counselor_brief text,
  call_summary text,
  session_id text unique,
  is_synthetic boolean default false
);

-- chat_messages
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  role text not null check (role in ('user','assistant','system','tool')),
  content text not null,
  created_at timestamptz default now()
);
create index on chat_messages(session_id, created_at);

-- objection_ledger
create table if not exists objection_ledger (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  lead_id uuid references leads(id) on delete cascade,
  objection_category text,
  campus text,
  language text
);

-- outbox (for simulated WhatsApp inbox)
create table if not exists outbox (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  lead_id uuid references leads(id) on delete cascade,
  phone text,
  message_type text not null, -- 'report_link', 'call_confirmation', 'counselor_brief'
  message_text text not null,
  delivered boolean default false
);

-- ============================================================
-- Row Level Security
-- Enable RLS on all tables, deny all direct client access.
-- The service_role key bypasses RLS by default in Supabase.
-- ============================================================

alter table leads enable row level security;
alter table chat_messages enable row level security;
alter table objection_ledger enable row level security;
alter table outbox enable row level security;

-- Restrictive policies (service role bypasses RLS by default)
create policy "No direct access to leads" on leads for all using (false);
create policy "No direct access to chat_messages" on chat_messages for all using (false);
create policy "No direct access to objection_ledger" on objection_ledger for all using (false);
create policy "No direct access to outbox" on outbox for all using (false);
