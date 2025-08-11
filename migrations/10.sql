
-- Remove superset-related columns from workout_exercises table
ALTER TABLE workout_exercises DROP COLUMN superset_id;
ALTER TABLE workout_exercises DROP COLUMN order_in_superset;
