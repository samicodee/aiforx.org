create extension if not exists pgcrypto;

create table if not exists public.aiforx_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  phone text not null,
  email text not null,
  program text not null check (
    program in ('founders', 'operators', 'doctors', 'engineers', 'businesses')
  ),
  source_domain text not null default 'aiforx.org',
  business text not null,
  role text not null,
  business_stage text,
  problem_statement text not null,
  status text not null default 'new' check (
    status in ('new', 'contacted', 'qualified', 'accepted', 'rejected')
  ),
  notes text,
  last_contacted_at timestamptz
);

alter table public.aiforx_leads enable row level security;

drop policy if exists "No public lead reads" on public.aiforx_leads;
drop policy if exists "No public lead writes" on public.aiforx_leads;

create policy "No public lead reads"
  on public.aiforx_leads
  for select
  to anon, authenticated
  using (false);

create policy "No public lead writes"
  on public.aiforx_leads
  for insert
  to anon, authenticated
  with check (false);

create index if not exists aiforx_leads_created_at_idx
  on public.aiforx_leads (created_at desc);

create index if not exists aiforx_leads_program_idx
  on public.aiforx_leads (program);

create index if not exists aiforx_leads_source_domain_idx
  on public.aiforx_leads (source_domain);
