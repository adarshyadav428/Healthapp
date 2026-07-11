-- 020_push_subscriptions.sql
-- Web Push subscriptions for meal reminders and streak-save nudges.
-- One user can have multiple subscriptions (multiple devices/browsers).
-- endpoint is unique — resubscribing the same device/browser upserts.

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

create policy "Users select own push subscriptions"
  on push_subscriptions for select using (auth.uid() = user_id);

create policy "Users insert own push subscriptions"
  on push_subscriptions for insert with check (auth.uid() = user_id);

create policy "Users delete own push subscriptions"
  on push_subscriptions for delete using (auth.uid() = user_id);

create index push_subscriptions_user_idx on push_subscriptions (user_id);
