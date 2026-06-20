-- 004_foods_search_trgm.sql
-- Speed up ILIKE searches on foods.name

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS foods_name_trgm_idx
  ON foods USING gin (name gin_trgm_ops);
