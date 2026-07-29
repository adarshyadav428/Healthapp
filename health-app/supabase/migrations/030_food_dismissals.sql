-- 030_food_dismissals.sql
-- Left-swipes from the meal suggestion deck.
--
-- A suggestion engine that keeps re-offering a rejected dish reads as not
-- listening, and one bad card poisons the whole feature — so a dismissal is
-- permanent rather than session-scoped.

create table if not exists food_dismissals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  food_id uuid not null references foods(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Swiping the same dish twice is a no-op rather than a duplicate row.
  unique (user_id, food_id)
);

alter table food_dismissals enable row level security;

-- Unlike the streak rescue, there is nothing to police here: dismissing a
-- suggestion costs nothing and affects nobody else, so users write their own.
create policy "Users select own food dismissals"
  on food_dismissals for select using (auth.uid() = user_id);

create policy "Users insert own food dismissals"
  on food_dismissals for insert with check (auth.uid() = user_id);

create policy "Users delete own food dismissals"
  on food_dismissals for delete using (auth.uid() = user_id);

create index if not exists food_dismissals_user_idx
  on food_dismissals (user_id);
