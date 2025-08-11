import z from "zod";

// Exercise schemas
export const ExerciseSchema = z.object({
  id: z.number(),
  name: z.string(),
  category: z.string(),
  muscle_group: z.string(),
  equipment: z.string(),
  instructions: z.string(),
  is_custom: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CreateExerciseSchema = z.object({
  name: z.string().min(1, "Exercise name is required"),
  category: z.string().min(1, "Category is required"),
  muscle_group: z.string().min(1, "Muscle group is required"),
  equipment: z.string().min(1, "Equipment is required"),
  instructions: z.string().min(1, "Instructions are required"),
  is_custom: z.boolean().default(true),
});

// Workout schemas
export const WorkoutSchema = z.object({
  id: z.number(),
  name: z.string().nullable(),
  notes: z.string().nullable(),
  duration_minutes: z.number().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  is_template: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CreateWorkoutSchema = z.object({
  name: z.string().optional(),
  notes: z.string().optional(),
  is_template: z.boolean().default(false),
});

// Workout exercise schemas
export const WorkoutExerciseSchema = z.object({
  id: z.number(),
  workout_id: z.number(),
  exercise_id: z.number(),
  order_index: z.number().nullable(),
  
  created_at: z.string(),
  updated_at: z.string(),
});

export const AddExerciseToWorkoutSchema = z.object({
  exercise_id: z.number(),
  order_index: z.number().optional(),
});



// Workout set schemas
export const WorkoutSetSchema = z.object({
  id: z.number(),
  workout_exercise_id: z.number(),
  set_number: z.number(),
  weight_lbs: z.number().nullable(),
  reps: z.number().nullable(),
  duration_seconds: z.number().nullable(),
  distance_miles: z.number().nullable(),
  notes: z.string().nullable(),
  completed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CreateWorkoutSetSchema = z.object({
  workout_exercise_id: z.number(),
  set_number: z.number(),
  weight_lbs: z.number().optional().nullable(),
  reps: z.number().optional().nullable(),
  duration_seconds: z.number().optional().nullable(),
  distance_miles: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// Schema for updating workout sets (excludes workout_exercise_id and set_number)
export const UpdateWorkoutSetSchema = z.object({
  weight_lbs: z.number().optional().nullable(),
  reps: z.number().optional().nullable(),
  duration_seconds: z.number().optional().nullable(),
  distance_miles: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// Derived types
export type Exercise = z.infer<typeof ExerciseSchema>;
export type CreateExercise = z.infer<typeof CreateExerciseSchema>;
export type Workout = z.infer<typeof WorkoutSchema>;
export type CreateWorkout = z.infer<typeof CreateWorkoutSchema>;
export type WorkoutExercise = z.infer<typeof WorkoutExerciseSchema>;
export type AddExerciseToWorkout = z.infer<typeof AddExerciseToWorkoutSchema>;
export type WorkoutSet = z.infer<typeof WorkoutSetSchema>;
export type CreateWorkoutSet = z.infer<typeof CreateWorkoutSetSchema>;
export type UpdateWorkoutSet = z.infer<typeof UpdateWorkoutSetSchema>;


// Extended types for API responses
export type WorkoutWithDetails = Workout & {
  exercise_count: number;
};

export type ExerciseWithSets = Exercise & {
  sets?: WorkoutSet[];
};
