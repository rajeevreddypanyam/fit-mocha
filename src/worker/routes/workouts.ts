import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { CreateWorkoutSchema, AddExerciseToWorkoutSchema, CreateWorkoutSetSchema, UpdateWorkoutSetSchema } from "@/shared/types";

const workouts = new Hono<{ Bindings: Env }>();

// Clean up blank workout entries
workouts.post('/cleanup', async (c) => {
  try {
    const db = c.env.DB;
    // Delete workouts that have no exercises and were never started (older than 5 minutes)
    // Use a more aggressive cleanup to prevent accumulation
    const result = await db.prepare(`
      DELETE FROM workouts 
      WHERE completed_at IS NULL 
        AND started_at IS NULL 
        AND id NOT IN (SELECT DISTINCT workout_id FROM workout_exercises)
        AND created_at < datetime('now', '-5 minutes')
    `).run();
    
    return c.json({ 
      message: 'Cleanup completed', 
      deletedCount: result.meta.changes 
    });
  } catch (error) {
    console.error('Error cleaning up workouts:', error);
    return c.json({ error: 'Failed to cleanup workouts' }, 500);
  }
});

// Get active workout (not completed)
workouts.get('/active', async (c) => {
  try {
    const db = c.env.DB;
    
    console.log('====== BACKEND: FETCHING ACTIVE WORKOUT ======');
    
    // Get active workout with exercise count in single query
    const activeWithContent = await db.prepare(`
      SELECT 
        w.*,
        COUNT(we.id) as exercise_count
      FROM workouts w
      LEFT JOIN workout_exercises we ON w.id = we.workout_id
      WHERE w.completed_at IS NULL 
      GROUP BY w.id
      HAVING (w.started_at IS NOT NULL OR COUNT(we.id) > 0)
      ORDER BY w.created_at DESC
      LIMIT 1
    `).first();
    
    console.log('Active workout found:', activeWithContent?.id, 'with', activeWithContent?.exercise_count, 'exercises');
    
    return c.json(activeWithContent || null);
  } catch (error) {
    console.error('Error fetching active workout:', error);
    return c.json({ error: 'Failed to fetch active workout' }, 500);
  }
});

// Get workout history
workouts.get('/history', async (c) => {
  try {
    const db = c.env.DB;
    
    // Get workouts with muscle groups
    const workouts = await db.prepare(`
      SELECT 
        w.id,
        w.name,
        w.duration_minutes,
        w.completed_at,
        w.notes,
        w.intensity_level,
        COUNT(DISTINCT we.id) as exercise_count
      FROM workouts w
      LEFT JOIN workout_exercises we ON w.id = we.workout_id
      WHERE w.completed_at IS NOT NULL
      GROUP BY w.id
      ORDER BY w.completed_at DESC
      LIMIT 50
    `).all();

    // Get muscle groups for each workout
    const workoutsWithMuscleGroups = await Promise.all(
      workouts.results.map(async (workout: any) => {
        const muscleGroups = await db.prepare(`
          SELECT DISTINCT e.muscle_group
          FROM workout_exercises we
          JOIN exercises e ON we.exercise_id = e.id
          WHERE we.workout_id = ?
          ORDER BY e.muscle_group
        `).bind(workout.id).all();

        return {
          ...workout,
          muscle_groups: muscleGroups.results.map((mg: any) => mg.muscle_group)
        };
      })
    );
    
    return c.json(workoutsWithMuscleGroups);
  } catch (error) {
    console.error('Error fetching workout history:', error);
    return c.json({ error: 'Failed to fetch workout history' }, 500);
  }
});

// Get workout by ID
workouts.get('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const db = c.env.DB;
    
    console.log('Fetching workout details for ID:', id);
    
    // Get workout with exercises and sets in optimized queries
    const workout = await db.prepare(`
      SELECT * FROM workouts WHERE id = ?
    `).bind(id).first();
    
    if (!workout) {
      console.log('Workout not found for ID:', id);
      return c.json({ error: 'Workout not found' }, 404);
    }
    
    // Get workout exercises with exercise details
    const exercises = await db.prepare(`
      SELECT 
        we.*,
        e.name,
        e.category,
        e.muscle_group,
        e.equipment,
        e.video_url
      FROM workout_exercises we
      JOIN exercises e ON we.exercise_id = e.id
      WHERE we.workout_id = ?
      ORDER BY we.order_index ASC
    `).bind(id).all();
    
    // Get sets for each exercise efficiently
    const exercisesWithSets = await Promise.all(
      exercises.results.map(async (exercise: any) => {
        const sets = await db.prepare(`
          SELECT * FROM workout_sets 
          WHERE workout_exercise_id = ?
          ORDER BY set_number ASC
        `).bind(exercise.id).all();
        
        return {
          ...exercise,
          sets: sets.results
        };
      })
    );
    
    const finalResult = {
      ...workout,
      exercises: exercisesWithSets
    };
    
    console.log('Loaded workout with', finalResult.exercises?.length || 0, 'exercises');
    
    return c.json(finalResult);
  } catch (error) {
    console.error('Error fetching workout:', error);
    return c.json({ error: 'Failed to fetch workout' }, 500);
  }
});

// Create new workout
workouts.post('/', zValidator('json', CreateWorkoutSchema), async (c) => {
  try {
    const data = c.req.valid('json');
    const db = c.env.DB;
    
    // Check if there's already a recent blank workout to prevent duplicates
    const existingBlank = await db.prepare(`
      SELECT id FROM workouts 
      WHERE completed_at IS NULL 
        AND started_at IS NULL
        AND id NOT IN (SELECT DISTINCT workout_id FROM workout_exercises)
        AND created_at > datetime('now', '-1 minute')
      ORDER BY created_at DESC
      LIMIT 1
    `).first();
    
    if (existingBlank) {
      // Return the existing blank workout instead of creating a new one
      const existing = await db.prepare(`
        SELECT * FROM workouts WHERE id = ?
      `).bind(existingBlank.id).first();
      
      if (!existing) {
        return c.json({ error: 'Existing workout not found' }, 404);
      }
      
      return c.json(existing, 200);
    }
    
    const result = await db.prepare(`
      INSERT INTO workouts (name, notes, is_template)
      VALUES (?, ?, ?)
    `).bind(
      data.name || null,
      data.notes || null,
      data.is_template
    ).run();
    
    if (!result.success) {
      return c.json({ error: 'Failed to create workout' }, 500);
    }
    
    // Fetch the created workout
    const created = await db.prepare(`
      SELECT * FROM workouts WHERE id = ?
    `).bind(result.meta.last_row_id).first();
    
    if (!created) {
      return c.json({ error: 'Failed to fetch created workout' }, 500);
    }
    
    return c.json(created, 201);
  } catch (error) {
    console.error('Error creating workout:', error);
    return c.json({ error: 'Failed to create workout' }, 500);
  }
});

// Update workout details (for summary page)
workouts.patch('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const { name, notes, intensity_level, started_at, completed_at, duration_minutes } = await c.req.json();
    const db = c.env.DB;
    
    // Build dynamic update query based on provided fields
    const updateFields = [];
    const bindValues = [];
    
    if (name !== undefined) {
      updateFields.push('name = ?');
      bindValues.push(name);
    }
    
    if (notes !== undefined) {
      updateFields.push('notes = ?');
      bindValues.push(notes);
    }
    
    if (intensity_level !== undefined) {
      updateFields.push('intensity_level = ?');
      bindValues.push(intensity_level);
    }
    
    if (started_at !== undefined) {
      updateFields.push('started_at = ?');
      bindValues.push(started_at);
    }
    
    if (completed_at !== undefined) {
      updateFields.push('completed_at = ?');
      bindValues.push(completed_at);
    }
    
    if (duration_minutes !== undefined) {
      updateFields.push('duration_minutes = ?');
      bindValues.push(duration_minutes);
    }
    
    // Always update the updated_at field
    updateFields.push('updated_at = datetime(\'now\')');
    bindValues.push(id);
    
    if (updateFields.length === 1) {
      // Only updated_at field, no actual changes
      return c.json({ error: 'No fields provided to update' }, 400);
    }
    
    const result = await db.prepare(`
      UPDATE workouts 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `).bind(...bindValues).run();
    
    if (!result.success || result.meta.changes === 0) {
      return c.json({ error: 'Workout not found' }, 404);
    }
    
    // Fetch the updated workout
    const updated = await db.prepare(`
      SELECT * FROM workouts WHERE id = ?
    `).bind(id).first();
    
    return c.json(updated);
  } catch (error) {
    console.error('Error updating workout:', error);
    return c.json({ error: 'Failed to update workout' }, 500);
  }
});

// Complete workout
workouts.patch('/:id/complete', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const db = c.env.DB;
    
    // Calculate duration
    const workout = await db.prepare(`
      SELECT started_at FROM workouts WHERE id = ?
    `).bind(id).first();
    
    if (!workout) {
      return c.json({ error: 'Workout not found' }, 404);
    }
    
    const startTime = new Date(workout.started_at as string);
    const endTime = new Date();
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
    
    const result = await db.prepare(`
      UPDATE workouts 
      SET completed_at = datetime('now'), 
          duration_minutes = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(durationMinutes, id).run();
    
    if (!result.success || result.meta.changes === 0) {
      return c.json({ error: 'Workout not found' }, 404);
    }
    
    // Fetch the updated workout
    const updated = await db.prepare(`
      SELECT * FROM workouts WHERE id = ?
    `).bind(id).first();
    
    return c.json(updated);
  } catch (error) {
    console.error('Error completing workout:', error);
    return c.json({ error: 'Failed to complete workout' }, 500);
  }
});

// Add exercise to workout
workouts.post('/:id/exercises', zValidator('json', AddExerciseToWorkoutSchema), async (c) => {
  try {
    const workoutId = parseInt(c.req.param('id'));
    const data = c.req.valid('json');
    const db = c.env.DB;
    
    console.log('Adding exercise to workout:', { workoutId, exerciseId: data.exercise_id, orderIndex: data.order_index });
    
    // First, verify the workout exists
    const workout = await db.prepare(`
      SELECT id FROM workouts WHERE id = ?
    `).bind(workoutId).first();
    
    if (!workout) {
      console.error('Workout not found:', workoutId);
      return c.json({ error: `Workout ${workoutId} not found` }, 404);
    }
    
    // Verify the exercise exists
    const exercise = await db.prepare(`
      SELECT id, name FROM exercises WHERE id = ?
    `).bind(data.exercise_id).first();
    
    if (!exercise) {
      console.error('Exercise not found:', data.exercise_id);
      return c.json({ error: `Exercise ${data.exercise_id} not found` }, 404);
    }
    
    console.log('Verified exercise exists:', exercise.name);
    
    // Allow duplicate exercises in workout for different phases (warm-up, main, finisher)
    // No need to check for existing entries - users should be able to add same exercise multiple times
    
    // Calculate the next order_index dynamically to ensure proper ordering
    const maxOrderIndexResult = await db.prepare(`
      SELECT COALESCE(MAX(order_index), -1) AS max_index, COUNT(*) as count
      FROM workout_exercises
      WHERE workout_id = ?
    `).bind(workoutId).first();
    
    const nextOrderIndex = (maxOrderIndexResult?.max_index as number || -1) + 1;
    const existingCount = maxOrderIndexResult?.count || 0;
    
    console.log('Existing exercises count:', existingCount);
    console.log('Next order_index:', nextOrderIndex);
    
    const isFirstExercise = existingCount === 0;
    
    // Only start the workout timer if this is the first exercise AND the workout hasn't been completed yet
    if (isFirstExercise && !workout.completed_at) {
      console.log('Starting workout timer for first exercise');
      const updateResult = await db.prepare(`
        UPDATE workouts 
        SET started_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).bind(workoutId).run();
      console.log('Workout timer update result:', updateResult);
      
      if (!updateResult.success) {
        console.error('Failed to update workout start time');
        return c.json({ error: 'Failed to start workout timer' }, 500);
      }
    } else if (isFirstExercise && workout.completed_at) {
      console.log('Adding exercise to completed workout - not updating start time');
    }
    
    const result = await db.prepare(`
      INSERT INTO workout_exercises (workout_id, exercise_id, order_index)
      VALUES (?, ?, ?)
    `).bind(
      workoutId,
      data.exercise_id,
      nextOrderIndex // Use the calculated next order_index
    ).run();
    
    console.log('Insert workout exercise result:', result);
    
    if (!result.success) {
      console.error('Failed to insert workout exercise. Error details:', result.error);
      return c.json({ 
        error: `Failed to add exercise ${data.exercise_id} to workout`, 
        details: result.error || 'Database insert failed'
      }, 500);
    }
    
    // Fetch the created workout exercise
    const created = await db.prepare(`
      SELECT 
        we.*,
        e.name,
        e.category,
        e.muscle_group,
        e.equipment,
        e.video_url
      FROM workout_exercises we
      JOIN exercises e ON we.exercise_id = e.id
      WHERE we.id = ?
    `).bind(result.meta.last_row_id).first();
    
    console.log('Created workout exercise:', created);
    
    if (!created) {
      console.error('Failed to fetch created workout exercise');
      return c.json({ error: 'Exercise was added but failed to retrieve details' }, 500);
    }
    
    return c.json(created, 201);
  } catch (error) {
    console.error('Error adding exercise to workout. Full error:', error);
    
    // Return more specific error information
    if (error instanceof Error) {
      return c.json({ 
        error: `Failed to add exercise to workout`, 
        details: error.message 
      }, 500);
    }
    
    return c.json({ 
      error: `Failed to add exercise to workout`,
      details: 'Unknown error occurred'
    }, 500);
  }
});

// Add set to workout exercise
workouts.post('/exercises/:exerciseId/sets', zValidator('json', CreateWorkoutSetSchema), async (c) => {
  try {
    const data = c.req.valid('json');
    const db = c.env.DB;
    
    console.log('Adding set with validated data:', data);
    
    // Only mark as completed if we have actual data (weight or reps)
    const hasData = (data.weight_lbs && data.weight_lbs > 0) || (data.reps && data.reps > 0);
    const completedAt = hasData ? 'CURRENT_TIMESTAMP' : 'NULL';
    
    console.log('Has data:', hasData, 'Completed at:', completedAt);
    
    const result = await db.prepare(`
      INSERT INTO workout_sets (
        workout_exercise_id, set_number, weight_lbs, reps, 
        duration_seconds, distance_miles, notes, completed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ${completedAt})
    `).bind(
      data.workout_exercise_id,
      data.set_number,
      data.weight_lbs || null,
      data.reps || null,
      data.duration_seconds || null,
      data.distance_miles || null,
      data.notes || null
    ).run();
    
    if (!result.success) {
      console.error('Database insert failed:', result);
      return c.json({ error: 'Database insert failed' }, 500);
    }
    
    console.log('Set inserted successfully, ID:', result.meta.last_row_id);
    
    // Fetch the created set
    const created = await db.prepare(`
      SELECT * FROM workout_sets WHERE id = ?
    `).bind(result.meta.last_row_id).first();
    
    console.log('Created set:', created);
    
    return c.json(created, 201);
  } catch (error) {
    console.error('Error adding set:', error);
    
    // Return more specific error information
    if (error instanceof Error) {
      return c.json({ error: error.message }, 500);
    }
    
    return c.json({ error: 'Unknown error occurred while adding set' }, 500);
  }
});

// Update exercise order in workout
workouts.put('/:id/exercises/reorder', async (c) => {
  try {
    const workoutId = parseInt(c.req.param('id'));
    const { exerciseIds } = await c.req.json();
    const db = c.env.DB;
    
    if (!exerciseIds || !Array.isArray(exerciseIds)) {
      return c.json({ error: 'Invalid exercise order data' }, 400);
    }
    
    // Update the order_index for each exercise based on the new order
    const updatePromises = exerciseIds.map((exerciseId: number, index: number) => {
      return db.prepare(`
        UPDATE workout_exercises 
        SET order_index = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND workout_id = ?
      `).bind(index, exerciseId, workoutId).run();
    });
    
    await Promise.all(updatePromises);
    
    return c.json({ message: 'Exercise order updated successfully' });
  } catch (error) {
    console.error('Error updating exercise order:', error);
    return c.json({ error: 'Failed to update exercise order' }, 500);
  }
});

// Delete workout exercise
workouts.delete('/exercises/:exerciseId', async (c) => {
  try {
    const exerciseId = parseInt(c.req.param('exerciseId'));
    const db = c.env.DB;
    
    // Delete workout sets first (cascade delete)
    await db.prepare(`
      DELETE FROM workout_sets WHERE workout_exercise_id = ?
    `).bind(exerciseId).run();
    
    // Delete the workout exercise
    const result = await db.prepare(`
      DELETE FROM workout_exercises WHERE id = ?
    `).bind(exerciseId).run();
    
    if (!result.success || result.meta.changes === 0) {
      return c.json({ error: 'Workout exercise not found' }, 404);
    }
    
    return c.json({ message: 'Exercise deleted successfully' });
  } catch (error) {
    console.error('Error deleting workout exercise:', error);
    return c.json({ error: 'Failed to delete workout exercise' }, 500);
  }
});

// Get workout exercise by ID
workouts.get('/exercises/:exerciseId', async (c) => {
  try {
    const exerciseId = parseInt(c.req.param('exerciseId'));
    const db = c.env.DB;
    
    // Get workout exercise with exercise details and sets
    const exercise = await db.prepare(`
      SELECT 
        we.*,
        e.name,
        e.category,
        e.muscle_group,
        e.equipment,
        e.video_url,
        e.instructions
      FROM workout_exercises we
      JOIN exercises e ON we.exercise_id = e.id
      WHERE we.id = ?
    `).bind(exerciseId).first();
    
    if (!exercise) {
      return c.json({ error: 'Workout exercise not found' }, 404);
    }
    
    // Get sets for this exercise
    const sets = await db.prepare(`
      SELECT * FROM workout_sets 
      WHERE workout_exercise_id = ?
      ORDER BY set_number ASC
    `).bind(exerciseId).all();
    
    return c.json({
      ...exercise,
      notes: exercise.instructions, // Use instructions as notes for now
      sets: sets.results
    });
  } catch (error) {
    console.error('Error fetching workout exercise:', error);
    return c.json({ error: 'Failed to fetch workout exercise' }, 500);
  }
});

// Get exercise history
workouts.get('/exercises/:exerciseId/history', async (c) => {
  try {
    const exerciseId = parseInt(c.req.param('exerciseId'));
    const db = c.env.DB;
    
    // Get the exercise_id from the workout_exercise
    const workoutExercise = await db.prepare(`
      SELECT exercise_id FROM workout_exercises WHERE id = ?
    `).bind(exerciseId).first();
    
    if (!workoutExercise) {
      return c.json({ error: 'Workout exercise not found' }, 404);
    }
    
    // Get historical workouts for this exercise
    const history = await db.prepare(`
      SELECT DISTINCT
        w.completed_at as date,
        w.id as workout_id,
        julianday('now') - julianday(w.completed_at) as days_ago
      FROM workouts w
      JOIN workout_exercises we ON w.id = we.workout_id
      WHERE we.exercise_id = ? 
        AND w.completed_at IS NOT NULL
        AND w.id != (
          SELECT workout_id FROM workout_exercises WHERE id = ?
        )
      ORDER BY w.completed_at DESC
      LIMIT 10
    `).bind(workoutExercise.exercise_id, exerciseId).all();
    
    // Get sets for each historical workout, properly grouped by exercise instance
    const historicalWorkouts = await Promise.all(
      history.results.map(async (workout: any) => {
        // Get all exercise instances in this workout, ordered by when they appear in the workout
        const exerciseInstances = await db.prepare(`
          SELECT we.id as workout_exercise_id, we.order_index
          FROM workout_exercises we
          WHERE we.workout_id = ? AND we.exercise_id = ?
          ORDER BY we.order_index ASC, we.created_at ASC, we.id ASC
        `).bind(workout.workout_id, workoutExercise.exercise_id).all();
        
        // Get sets for each instance separately, keeping original set numbers within each instance
        const allSets = [];
        
        for (const instance of exerciseInstances.results) {
          const instanceSets = await db.prepare(`
            SELECT 
              ws.set_number,
              ws.weight_lbs,
              ws.reps,
              ws.duration_seconds,
              ws.notes,
              ws.workout_exercise_id
            FROM workout_sets ws
            WHERE ws.workout_exercise_id = ?
              AND ws.completed_at IS NOT NULL
            ORDER BY ws.set_number ASC
          `).bind(instance.workout_exercise_id).all();
          
          // Add instance sets keeping the original set numbers within each exercise instance
          for (const set of instanceSets.results) {
            allSets.push({
              set_number: set.set_number, // Keep original set number within this exercise instance
              weight_lbs: set.weight_lbs,
              reps: set.reps,
              duration_seconds: set.duration_seconds,
              notes: set.notes,
              workout_exercise_id: set.workout_exercise_id
            });
          }
        }
        
        return {
          date: workout.date,
          days_ago: Math.round(workout.days_ago),
          sets: allSets
        };
      })
    );
    
    return c.json(historicalWorkouts);
  } catch (error) {
    console.error('Error fetching exercise history:', error);
    return c.json({ error: 'Failed to fetch exercise history' }, 500);
  }
});

// Update workout set
workouts.put('/sets/:setId', zValidator('json', UpdateWorkoutSetSchema), async (c) => {
  try {
    const setId = parseInt(c.req.param('setId'));
    const data = c.req.valid('json');
    const db = c.env.DB;
    
    console.log('Updating set with validated data:', data);
    
    // Mark as completed if we have actual data (weight or reps)
    const hasData = (data.weight_lbs && data.weight_lbs > 0) || (data.reps && data.reps > 0);
    const completedAt = hasData ? 'CURRENT_TIMESTAMP' : 'NULL';
    
    const result = await db.prepare(`
      UPDATE workout_sets 
      SET weight_lbs = ?, reps = ?, duration_seconds = ?, distance_miles = ?, notes = ?, completed_at = ${completedAt}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      data.weight_lbs || null,
      data.reps || null,
      data.duration_seconds || null,
      data.distance_miles || null,
      data.notes || null,
      setId
    ).run();
    
    if (!result.success || result.meta.changes === 0) {
      console.error('Update failed or set not found:', result);
      return c.json({ error: 'Workout set not found' }, 404);
    }
    
    console.log('Set updated successfully');
    
    // Fetch the updated set
    const updated = await db.prepare(`
      SELECT * FROM workout_sets WHERE id = ?
    `).bind(setId).first();
    
    console.log('Updated set:', updated);
    
    return c.json(updated);
  } catch (error) {
    console.error('Error updating set:', error);
    
    // Return more specific error information
    if (error instanceof Error) {
      return c.json({ error: error.message }, 500);
    }
    
    return c.json({ error: 'Unknown error occurred while updating set' }, 500);
  }
});

// Delete workout set
workouts.delete('/sets/:setId', async (c) => {
  try {
    const setId = parseInt(c.req.param('setId'));
    const db = c.env.DB;
    
    // Get the set info before deleting to know the workout_exercise_id
    const setToDelete = await db.prepare(`
      SELECT workout_exercise_id, set_number FROM workout_sets WHERE id = ?
    `).bind(setId).first();
    
    if (!setToDelete) {
      return c.json({ error: 'Workout set not found' }, 404);
    }
    
    // Delete the set
    const result = await db.prepare(`
      DELETE FROM workout_sets WHERE id = ?
    `).bind(setId).run();
    
    if (!result.success || result.meta.changes === 0) {
      return c.json({ error: 'Failed to delete workout set' }, 500);
    }
    
    return c.json({ message: 'Set deleted successfully' });
  } catch (error) {
    console.error('Error deleting set:', error);
    return c.json({ error: 'Failed to delete set' }, 500);
  }
});

// Duplicate workout set
workouts.post('/sets/:setId/duplicate', async (c) => {
  try {
    const setId = parseInt(c.req.param('setId'));
    const db = c.env.DB;
    
    if (setId === 0) {
      // Handle empty set duplication - just return success, frontend will handle as add set
      return c.json({ message: 'Empty set duplication handled by frontend' }, 200);
    }
    
    // Get the original set
    const originalSet = await db.prepare(`
      SELECT * FROM workout_sets WHERE id = ?
    `).bind(setId).first();
    
    if (!originalSet) {
      return c.json({ error: 'Workout set not found' }, 404);
    }
    
    // Get the next set number for this exercise
    const nextSetNumber = await db.prepare(`
      SELECT COALESCE(MAX(set_number), 0) + 1 as next_set_number 
      FROM workout_sets 
      WHERE workout_exercise_id = ?
    `).bind(originalSet.workout_exercise_id).first();
    
    // Create the duplicate (always incomplete to allow editing)
    const result = await db.prepare(`
      INSERT INTO workout_sets (
        workout_exercise_id, set_number, weight_lbs, reps, 
        duration_seconds, distance_miles, notes, completed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
    `).bind(
      originalSet.workout_exercise_id,
      nextSetNumber?.next_set_number || 1,
      originalSet.weight_lbs,
      originalSet.reps,
      originalSet.duration_seconds,
      originalSet.distance_miles,
      originalSet.notes
    ).run();
    
    if (!result.success) {
      return c.json({ error: 'Failed to duplicate set' }, 500);
    }
    
    // Fetch the created set
    const created = await db.prepare(`
      SELECT * FROM workout_sets WHERE id = ?
    `).bind(result.meta.last_row_id).first();
    
    return c.json(created, 201);
  } catch (error) {
    console.error('Error duplicating set:', error);
    return c.json({ error: 'Failed to duplicate set' }, 500);
  }
});

// Replace exercise while preserving sets
workouts.put('/exercises/:exerciseId/replace', async (c) => {
  try {
    const exerciseId = parseInt(c.req.param('exerciseId'));
    const { new_exercise_id } = await c.req.json();
    const db = c.env.DB;
    
    if (!new_exercise_id) {
      return c.json({ error: 'new_exercise_id is required' }, 400);
    }
    
    // Verify the new exercise exists
    const newExercise = await db.prepare(`
      SELECT id, name FROM exercises WHERE id = ?
    `).bind(new_exercise_id).first();
    
    if (!newExercise) {
      return c.json({ error: 'New exercise not found' }, 404);
    }
    
    // Verify the workout exercise exists
    const workoutExercise = await db.prepare(`
      SELECT id, workout_id FROM workout_exercises WHERE id = ?
    `).bind(exerciseId).first();
    
    if (!workoutExercise) {
      return c.json({ error: 'Workout exercise not found' }, 404);
    }
    
    // Update the workout exercise to point to the new exercise
    // This preserves all existing sets since they reference workout_exercise_id
    const result = await db.prepare(`
      UPDATE workout_exercises 
      SET exercise_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(new_exercise_id, exerciseId).run();
    
    if (!result.success || result.meta.changes === 0) {
      return c.json({ error: 'Failed to replace exercise' }, 500);
    }
    
    // Fetch the updated workout exercise with new exercise details
    const updated = await db.prepare(`
      SELECT 
        we.*,
        e.name,
        e.category,
        e.muscle_group,
        e.equipment,
        e.video_url
      FROM workout_exercises we
      JOIN exercises e ON we.exercise_id = e.id
      WHERE we.id = ?
    `).bind(exerciseId).first();
    
    return c.json(updated);
  } catch (error) {
    console.error('Error replacing exercise:', error);
    return c.json({ error: 'Failed to replace exercise' }, 500);
  }
});

// Delete workout
workouts.delete('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const db = c.env.DB;
    
    // Delete workout sets first (cascade delete)
    await db.prepare(`
      DELETE FROM workout_sets 
      WHERE workout_exercise_id IN (
        SELECT id FROM workout_exercises WHERE workout_id = ?
      )
    `).bind(id).run();
    
    // Delete workout exercises
    await db.prepare(`
      DELETE FROM workout_exercises WHERE workout_id = ?
    `).bind(id).run();
    
    // Delete the workout itself
    const result = await db.prepare(`
      DELETE FROM workouts WHERE id = ?
    `).bind(id).run();
    
    if (!result.success || result.meta.changes === 0) {
      return c.json({ error: 'Workout not found' }, 404);
    }
    
    return c.json({ message: 'Workout deleted successfully' });
  } catch (error) {
    console.error('Error deleting workout:', error);
    return c.json({ error: 'Failed to delete workout' }, 500);
  }
});







export default workouts;
