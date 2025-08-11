
-- Re-add superset-related columns to workout_exercises table
ALTER TABLE workout_exercises ADD COLUMN superset_id INTEGER;
ALTER TABLE workout_exercises ADD COLUMN order_in_superset INTEGER;
