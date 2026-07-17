-- 025_start_weight.sql
-- Immutable "start weight" baseline so "since start" doesn't reset to the first
-- weigh-in (audit P1-9b). Set once at onboarding, never overwritten by weight
-- logs. Backfills existing users from their current profile weight.

alter table profiles add column if not exists start_weight_kg numeric;

update profiles
  set start_weight_kg = current_weight_kg
  where start_weight_kg is null and current_weight_kg is not null;
