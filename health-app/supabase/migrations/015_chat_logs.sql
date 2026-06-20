create table if not exists chat_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table chat_logs enable row level security;

create policy "Users select own chat logs"
  on chat_logs for select using (auth.uid() = user_id);

create policy "Users insert own chat logs"
  on chat_logs for insert with check (auth.uid() = user_id);

create index chat_logs_user_date_idx on chat_logs (user_id, created_at);
