import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { CreateExerciseSchema } from "@/shared/types";

const exercises = new Hono<{ Bindings: Env }>();

// Get all exercises
exercises.get('/', async (c) => {
  try {
    const db = c.env.DB;
    const result = await db.prepare(`
      SELECT * FROM exercises 
      ORDER BY name ASC
    `).all();
    
    return c.json(result.results);
  } catch (error) {
    console.error('Error fetching exercises:', error);
    return c.json({ error: 'Failed to fetch exercises' }, 500);
  }
});

// Get exercise by ID
exercises.get('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const db = c.env.DB;
    
    const result = await db.prepare(`
      SELECT * FROM exercises WHERE id = ?
    `).bind(id).first();
    
    if (!result) {
      return c.json({ error: 'Exercise not found' }, 404);
    }
    
    return c.json(result);
  } catch (error) {
    console.error('Error fetching exercise:', error);
    return c.json({ error: 'Failed to fetch exercise' }, 500);
  }
});

// Create new exercise
exercises.post('/', zValidator('json', CreateExerciseSchema), async (c) => {
  try {
    const data = c.req.valid('json');
    const db = c.env.DB;
    
    const result = await db.prepare(`
      INSERT INTO exercises (name, category, muscle_group, equipment, instructions, is_custom)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      data.name,
      data.category,
      data.muscle_group,
      data.equipment,
      data.instructions,
      data.is_custom
    ).run();
    
    if (!result.success) {
      return c.json({ error: 'Failed to create exercise' }, 500);
    }
    
    // Fetch the created exercise
    const created = await db.prepare(`
      SELECT * FROM exercises WHERE id = ?
    `).bind(result.meta.last_row_id).first();
    
    return c.json(created, 201);
  } catch (error) {
    console.error('Error creating exercise:', error);
    return c.json({ error: 'Failed to create exercise' }, 500);
  }
});

// Update exercise
exercises.put('/:id', zValidator('json', CreateExerciseSchema), async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const data = c.req.valid('json');
    const db = c.env.DB;
    
    const result = await db.prepare(`
      UPDATE exercises 
      SET name = ?, category = ?, muscle_group = ?, equipment = ?, 
          instructions = ?, is_custom = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      data.name,
      data.category,
      data.muscle_group,
      data.equipment,
      data.instructions,
      data.is_custom,
      id
    ).run();
    
    if (!result.success || result.meta.changes === 0) {
      return c.json({ error: 'Exercise not found' }, 404);
    }
    
    // Fetch the updated exercise
    const updated = await db.prepare(`
      SELECT * FROM exercises WHERE id = ?
    `).bind(id).first();
    
    return c.json(updated);
  } catch (error) {
    console.error('Error updating exercise:', error);
    return c.json({ error: 'Failed to update exercise' }, 500);
  }
});

// Get exercise history
exercises.get('/:id/history', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const db = c.env.DB;
    
    const result = await db.prepare(`
      SELECT 
        w.id as workout_id,
        w.completed_at,
        w.started_at,
        w.name as workout_name,
        we.id as workout_exercise_id,
        we.order_index,
        we.created_at as exercise_created_at,
        ws.set_number,
        ws.weight_lbs,
        ws.reps,
        ws.duration_seconds,
        ws.distance_miles,
        ws.notes as set_notes,
        w.notes as workout_notes
      FROM workout_exercises we
      JOIN workouts w ON we.workout_id = w.id
      JOIN workout_sets ws ON we.id = ws.workout_exercise_id
      WHERE we.exercise_id = ? 
        AND w.completed_at IS NOT NULL
        AND ws.completed_at IS NOT NULL
      ORDER BY w.completed_at DESC, we.order_index ASC, we.created_at ASC, we.id ASC, ws.set_number ASC
    `).bind(id).all();
    
    // Group sets by individual workout session, properly grouping by exercise instance
    const historyMap = new Map();
    
    result.results.forEach((row: any) => {
      const workoutId = row.workout_id;
      
      if (!historyMap.has(workoutId)) {
        // Handle different SQLite timestamp formats consistently
        let completedAtStr = row.completed_at;
        let workoutDate: Date;
        
        if (completedAtStr.includes('T') && completedAtStr.endsWith('Z')) {
          // Already in ISO format with timezone (e.g., "2025-08-08T21:48:00.000Z")
          workoutDate = new Date(completedAtStr);
        } else if (completedAtStr.includes('T') && !completedAtStr.endsWith('Z') && !completedAtStr.includes('+')) {
          // ISO format without timezone - assume UTC
          workoutDate = new Date(completedAtStr + 'Z');
        } else {
          // SQLite format without T or timezone (e.g., "2025-08-10 21:13:32")
          // Replace space with T and add Z to make it proper ISO format
          const isoString = completedAtStr.replace(' ', 'T') + 'Z';
          workoutDate = new Date(isoString);
        }
        
        // Ensure we have a valid date
        if (isNaN(workoutDate.getTime())) {
          console.error('Invalid date format:', row.completed_at, 'parsed as:', workoutDate);
          return; // Skip this entry if date is invalid
        }
        
        historyMap.set(workoutId, {
          workout_id: workoutId,
          date: workoutDate.toLocaleDateString('en-US', { 
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          }),
          time: workoutDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          }),
          completed_at: row.completed_at,
          workout_name: row.workout_name,
          workout_notes: row.workout_notes,
          sets: [],
          exerciseInstances: new Map()
        });
      }
      
      const workoutHistory = historyMap.get(workoutId);
      
      // Track exercise instances to group sets properly
      if (!workoutHistory.exerciseInstances.has(row.workout_exercise_id)) {
        workoutHistory.exerciseInstances.set(row.workout_exercise_id, []);
      }
      
      workoutHistory.exerciseInstances.get(row.workout_exercise_id).push({
        set_number: row.set_number,
        weight_lbs: row.weight_lbs,
        reps: row.reps,
        duration_seconds: row.duration_seconds,
        distance_miles: row.distance_miles,
        notes: row.set_notes,
        workout_exercise_id: row.workout_exercise_id
      });
    });
    
    // Convert to array and group sets by exercise instance
    const history = Array.from(historyMap.values()).map(workout => {
      // Parse the date consistently with the same logic as above
      let completedAtStr = workout.completed_at;
      let workoutDate: Date;
      
      if (completedAtStr.includes('T') && completedAtStr.endsWith('Z')) {
        workoutDate = new Date(completedAtStr);
      } else if (completedAtStr.includes('T') && !completedAtStr.endsWith('Z') && !completedAtStr.includes('+')) {
        workoutDate = new Date(completedAtStr + 'Z');
      } else {
        const isoString = completedAtStr.replace(' ', 'T') + 'Z';
        workoutDate = new Date(isoString);
      }
      
      const today = new Date();
      const daysAgo = Math.floor((today.getTime() - workoutDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Group sets by exercise instance, maintaining original set numbers within each instance
      const exerciseSessionSets: any[] = [];
      
      // Group sets by exercise instance, maintaining original set numbers within each instance
      for (const [, sets] of workout.exerciseInstances) {
        // Each exercise instance keeps its original set numbering
        const setsArray = sets as any[];
        for (const set of setsArray) {
          exerciseSessionSets.push({
            set_number: set.set_number, // Keep original set number within this exercise instance
            weight_lbs: set.weight_lbs,
            reps: set.reps,
            duration_seconds: set.duration_seconds,
            distance_miles: set.distance_miles,
            notes: set.notes,
            workout_exercise_id: set.workout_exercise_id
          });
        }
      }
      
      return {
        workout_id: workout.workout_id,
        date: workout.date,
        time: workout.time,
        completed_at: workout.completed_at,
        workout_name: workout.workout_name,
        workout_notes: workout.workout_notes,
        daysAgo: daysAgo,
        sets: exerciseSessionSets
      };
    });
    
    return c.json(history);
  } catch (error) {
    console.error('Error fetching exercise history:', error);
    return c.json({ error: 'Failed to fetch exercise history' }, 500);
  }
});

// Delete exercise
exercises.delete('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const db = c.env.DB;
    
    const result = await db.prepare(`
      DELETE FROM exercises WHERE id = ?
    `).bind(id).run();
    
    if (!result.success || result.meta.changes === 0) {
      return c.json({ error: 'Exercise not found' }, 404);
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting exercise:', error);
    return c.json({ error: 'Failed to delete exercise' }, 500);
  }
});

export default exercises;
