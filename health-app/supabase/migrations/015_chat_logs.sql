-- 015_chat_logs.sql
-- Per-user AI chat-log counter backing the free tier's 10 chat logs/day
-- (enforced in app/api/chat/analyze/route.ts).
--
-- Rewritten to be idempotent: the original used bare `create policy` /
-- `create index`, so a partial application left the table and one policy in
-- place and every re-run aborted with 42710. Safe to run repeatedly.

create table if not exists chat_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table chat_logs enable row level security;

drop policy if exists "Users select own chat logs" on chat_logs;
create policy "Users select own chat logs"
  on chat_logs for select using (auth.uid() = user_id);

drop policy if exists "Users insert own chat logs" on chat_logs;
create policy "Users insert own chat logs"
  on chat_logs for insert with check (auth.uid() = user_id);

create index if not exists chat_logs_user_date_idx on chat_logs (user_id, created_at);
