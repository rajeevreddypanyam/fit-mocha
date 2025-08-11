
ALTER TABLE exercises DROP COLUMN is_favourite;
ALTER TABLE exercises DROP COLUMN usage_count;
ALTER TABLE exercises DROP COLUMN last_used_at;

DELETE FROM exercises WHERE id >= 1311201 AND id <= 1991201;
