import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { Plus, History, MoreVertical, GripVertical } from 'lucide-react';
import ActiveWorkoutHeader from '@/react-app/components/ActiveWorkoutHeader';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface WorkoutExercise {
  id: number;
  workout_id: number;
  exercise_id: number;
  order_index: number;
  name: string;
  category: string;
  muscle_group: string;
  equipment: string;
  video_url?: string;
  sets: WorkoutSet[];
}

interface WorkoutSet {
  id: number;
  workout_exercise_id: number;
  set_number: number;
  weight_lbs?: number;
  reps?: number;
  duration_seconds?: number;
  distance_miles?: number;
  notes?: string;
  completed_at: string;
}

interface Workout {
  id: number;
  name?: string;
  notes?: string;
  started_at: string;
  completed_at?: string;
  duration_minutes?: number;
  exercises: WorkoutExercise[];
}

interface SortableExerciseItemProps {
  exercise: WorkoutExercise;
  index: number;
  status: { text: string; color: string };
  exerciseMenuOpen: number | null;
  handleExerciseMenuClick: (exerciseId: number, event: React.MouseEvent) => void;
  handleDeleteExercise: (exerciseId: number) => void;
  handleReplaceExercise: (exerciseId: number) => void;
  setExerciseMenuOpen: (exerciseId: number | null) => void;
  navigate: (path: string) => void;
  workout: Workout | null;
}

function SortableExerciseItem({
  exercise,
  index,
  status,
  exerciseMenuOpen,
  handleExerciseMenuClick,
  handleDeleteExercise,
  handleReplaceExercise,
  navigate,
  workout,
}: SortableExerciseItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: exercise.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center space-x-3 w-full ${
        isDragging ? 'opacity-50 z-50' : ''
      }`}
    >
      {/* Exercise Number - Outside the card */}
      <div className="flex-shrink-0 text-white font-bold text-lg mr-1">
        {index + 1}
      </div>
      
      <div className="flex-1 bg-gray-800 rounded-xl p-4 border border-gray-700 relative min-w-0 shadow-lg shadow-black/20">
        <div className="flex items-center space-x-4">
          {/* Drag Handle */}
          <div
            {...attributes}
            {...listeners}
            className="flex-shrink-0 cursor-grab active:cursor-grabbing p-1 hover:bg-gray-700 rounded transition-colors"
          >
            <GripVertical className="w-5 h-5 text-gray-400" />
          </div>

          {/* Exercise Thumbnail */}
          <div className="flex-shrink-0 w-12 h-12 rounded-full overflow-hidden bg-gray-700 flex items-center justify-center">
            {exercise.video_url ? (
              <img
                src={`https://vumbnail.com/${exercise.video_url.split('/').pop()}.jpg`}
                alt={exercise.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback to SVG icon when Vimeo thumbnail fails
                  const target = e.target as HTMLImageElement;
                  const muscleGroupMap: Record<string, string> = {
                    'Abs': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Abs.svg',
                    'Core': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Abs.svg',
                    'Back': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/upper-back.svg',
                    'Upper Back': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/upper-back.svg',
                    'Lower Back': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Lower-Back.svg',
                    'Arms': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Arms-Biceps.svg',
                    'Biceps': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Arms-Biceps.svg',
                    'Triceps': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Arms-triceps.svg',
                    'Chest': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Chest.svg',
                    'Shoulders': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Shoulders.svg',
                    'Legs': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Quadriceps.svg',
                    'Quadriceps': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Quadriceps.svg',
                    'Hamstrings': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Hamstrings.svg',
                    'Glutes': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Glutes.svg',
                    'Calves': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Calves.svg',
                    'Trapezius': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Trapezius.svg',
                    'Forearms': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Forearm.svg',
                    'Forearm': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Forearm.svg'
                  };
                  
                  const svgUrl = muscleGroupMap[exercise.muscle_group] || muscleGroupMap['Abs'];
                  target.src = svgUrl;
                  target.className = "w-full h-full object-contain";
                }}
              />
            ) : (
              // Direct SVG fallback when no video_url
              <img
                src={(() => {
                  const muscleGroupMap: Record<string, string> = {
                    'Abs': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Abs.svg',
                    'Core': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Abs.svg',
                    'Back': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/upper-back.svg',
                    'Upper Back': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/upper-back.svg',
                    'Lower Back': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Lower-Back.svg',
                    'Arms': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Arms-Biceps.svg',
                    'Biceps': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Arms-Biceps.svg',
                    'Triceps': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Arms-triceps.svg',
                    'Chest': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Chest.svg',
                    'Shoulders': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Shoulders.svg',
                    'Legs': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Quadriceps.svg',
                    'Quadriceps': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Quadriceps.svg',
                    'Hamstrings': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Hamstrings.svg',
                    'Glutes': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Glutes.svg',
                    'Calves': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Calves.svg',
                    'Trapezius': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Trapezius.svg',
                    'Forearms': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Forearm.svg',
                    'Forearm': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Forearm.svg'
                  };
                  
                  return muscleGroupMap[exercise.muscle_group] || muscleGroupMap['Abs'];
                })()}
                alt={exercise.name}
                className="w-full h-full object-contain"
              />
            )}
          </div>
        
          {/* Exercise Details */}
          <div 
            className="flex-1 min-w-0 cursor-pointer" 
            onClick={() => navigate(`/workout/exercise/${exercise.id}?workoutId=${workout?.id}`)}
          >
            <h3 className="font-semibold text-white text-base leading-tight break-words">
              {exercise.name}
            </h3>
            <p className={`text-sm mt-1 ${status.color}`}>
              {status.text}
            </p>
            
            {/* Chips/badges */}
            <div className="flex flex-wrap gap-2 mt-2">
              {/* Equipment chip */}
              <span className="inline-flex items-center px-2 py-1 bg-gray-600 text-gray-300 text-xs rounded-full">
                {exercise.equipment}
              </span>
              
              {/* Primary muscle chip */}
              <span className="inline-flex items-center px-2 py-1 bg-gray-600 text-gray-300 text-xs rounded-full">
                {exercise.muscle_group}
              </span>
            </div>
          </div>
          
          {/* Three-dot menu */}
          <div className="flex-shrink-0 relative">
            <button
              onClick={(e) => handleExerciseMenuClick(exercise.id, e)}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <MoreVertical className="w-5 h-5 text-gray-400" />
            </button>
            
            {/* Dropdown menu */}
            {exerciseMenuOpen === exercise.id && (
              <div className="absolute right-0 top-full mt-1 bg-gray-900 border border-gray-600 rounded-lg shadow-lg z-10 min-w-48">
                <div className="py-1">
                  <button
                    onClick={() => handleReplaceExercise(exercise.id)}
                    className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-white hover:bg-gray-800 transition-colors"
                  >
                    <span>Replace exercise</span>
                  </button>
                  <button
                    onClick={() => handleDeleteExercise(exercise.id)}
                    className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-red-400 hover:bg-gray-800 transition-colors"
                  >
                    <span>Delete exercise</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StartWorkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [exerciseMenuOpen, setExerciseMenuOpen] = useState<number | null>(null);
  const [isCreatingWorkout, setIsCreatingWorkout] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    const initializeWorkout = async () => {
      if (isCreatingWorkout) return; // Prevent concurrent creation
      
      try {
        setIsCreatingWorkout(true);
        await checkForActiveWorkout();
      } finally {
        if (isMounted) {
          setIsCreatingWorkout(false);
        }
      }
    };
    
    initializeWorkout();
    
    return () => {
      isMounted = false;
    };
  }, []);

  // Check for refresh state from navigation (when returning from exercise selection)
  useEffect(() => {
    if (location.state?.refresh) {
      console.log('Refresh state detected, reloading workout data...', location.state);
      setWorkout(null);
      setIsLoading(true);
      
      // Clear the refresh state immediately
      navigate(location.pathname, { replace: true, state: {} });
      
      // Immediate refresh after state clear
      setTimeout(() => {
        console.log('Calling checkForActiveWorkout after refresh state detected');
        checkForActiveWorkout();
      }, 100);
    }
  }, [location.state?.refresh, location.state?.timestamp]); // Watch for both refresh flag and timestamp

  const checkForActiveWorkout = async () => {
    try {
      console.log('====== CHECKING FOR ACTIVE WORKOUT ======');
      
      // Clean up any blank workout entries first (no exercises and never started)
      const cleanupResponse = await fetch('/api/workouts/cleanup', { method: 'POST' });
      console.log('Cleanup response status:', cleanupResponse.status);
      
      if (cleanupResponse.ok) {
        const cleanupData = await cleanupResponse.json();
        console.log('Cleanup result:', cleanupData);
      }
      
      // Brief delay to ensure cleanup completes
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check if there's an active workout with exercises or that has been started
      console.log('Fetching active workout...');
      const activeResponse = await fetch('/api/workouts/active');
      console.log('Active workout response status:', activeResponse.status);
      
      if (activeResponse.ok) {
        const activeWorkout = await activeResponse.json();
        console.log('Active workout data:', JSON.stringify(activeWorkout, null, 2));
        
        if (activeWorkout && (activeWorkout.exercise_count > 0 || activeWorkout.started_at)) {
          // Load the existing active workout that has content
          console.log('Loading workout details for ID:', activeWorkout.id);
          const workoutResponse = await fetch(`/api/workouts/${activeWorkout.id}?_t=${Date.now()}`);
          console.log('Workout details response status:', workoutResponse.status);
          
          if (workoutResponse.ok) {
            const workoutData = await workoutResponse.json();
            console.log('====== WORKOUT DATA LOADED ======');
            console.log('Workout ID:', workoutData.id);
            console.log('Workout name:', workoutData.name);
            console.log('Number of exercises:', workoutData.exercises?.length || 0);
            console.log('Started at:', workoutData.started_at);
            console.log('Full workout data:', JSON.stringify(workoutData, null, 2));
            
            // Log each exercise for debugging
            if (workoutData.exercises?.length > 0) {
              console.log('====== EXERCISES IN WORKOUT ======');
              workoutData.exercises.forEach((ex: any, idx: number) => {
                console.log(`Exercise ${idx + 1}:`, {
                  id: ex.id,
                  name: ex.name,
                  exercise_id: ex.exercise_id,
                  workout_id: ex.workout_id,
                  order_index: ex.order_index,
                  sets_count: ex.sets?.length || 0
                });
              });
            } else {
              console.log('====== NO EXERCISES FOUND IN WORKOUT ======');
            }
            
            setWorkout(workoutData);
            setIsLoading(false);
            return;
          } else {
            const errorText = await workoutResponse.text();
            console.error('Failed to load workout details:', errorText);
          }
        } else {
          console.log('Active workout has no exercises or not started:', activeWorkout);
        }
      } else {
        const errorText = await activeResponse.text();
        console.error('Failed to get active workout:', errorText);
      }
      
      // No active workout with content found, set to null (no workout yet)
      console.log('====== NO ACTIVE WORKOUT FOUND ======');
      setWorkout(null);
      setIsLoading(false);
    } catch (error) {
      console.error('====== ERROR CHECKING FOR ACTIVE WORKOUT ======', error);
      setWorkout(null);
      setIsLoading(false);
    }
  };

  

  const handleAddExercise = async () => {
    console.log('====== HANDLE ADD EXERCISE ======');
    console.log('Current workout:', workout?.id);
    
    let workoutToUse = workout;
    
    // If no workout exists yet, create one first
    if (!workoutToUse) {
      console.log('No workout exists, creating new workout...');
      try {
        setIsCreatingWorkout(true);
        
        const response = await fetch('/api/workouts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: `Workout ${new Date().toLocaleDateString()}`,
            is_template: false
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to create workout');
        }

        const newWorkout = await response.json();
        console.log('Created new workout:', newWorkout.id);
        workoutToUse = { ...newWorkout, exercises: [] };
        setWorkout(workoutToUse);
        
        // Brief wait for workout creation
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        console.error('Error creating workout:', error);
        alert('Failed to create workout. Please try again.');
        return;
      } finally {
        setIsCreatingWorkout(false);
      }
    }
    
    if (!workoutToUse) {
      console.error('Failed to create or get workout');
      return;
    }
    
    console.log('Navigating to select exercises with workout ID:', workoutToUse.id);
    
    // Navigate to selectable exercise list with workout ID
    navigate(`/workout/select-exercises?workoutId=${workoutToUse.id}`);
  };

  const handleCompleteWorkout = async () => {
    if (!workout) return;

    // Navigate to summary page without completing the workout yet
    navigate(`/workout/summary?workoutId=${workout.id}`);
  };

  const handleDiscardWorkout = async () => {
    if (!workout) {
      // If no workout exists yet, just navigate back
      navigate('/', { replace: true, state: { refresh: true } });
      return;
    }

    try {
      // Delete the workout from the database
      const response = await fetch(`/api/workouts/${workout.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to discard workout');
      }

      // Clear all local workout state
      setWorkout(null);
      
      // Navigate back to home with state to force refresh
      navigate('/', { replace: true, state: { refresh: true } });
    } catch (error) {
      console.error('Error discarding workout:', error);
    }
  };

  

  const getSetProgress = (exercise: WorkoutExercise) => {
    const completedSets = exercise.sets?.filter(set => set.completed_at)?.length || 0;
    const totalSets = Math.max(completedSets, 3); // Default to 3 sets minimum
    return `${completedSets}/${totalSets} Sets done`;
  };

  const getExerciseStatus = (exercise: WorkoutExercise) => {
    const completedSets = exercise.sets?.filter(set => set.completed_at)?.length || 0;
    if (completedSets === 0) {
      return { text: getSetProgress(exercise), color: 'text-gray-400' };
    } else if (completedSets < 3) {
      return { text: getSetProgress(exercise), color: 'text-yellow-400' };
    } else {
      return { text: getSetProgress(exercise), color: 'text-green-400' };
    }
  };

  const handleExerciseMenuClick = (exerciseId: number, event: React.MouseEvent) => {
    event.stopPropagation();
    setExerciseMenuOpen(exerciseMenuOpen === exerciseId ? null : exerciseId);
  };

  const handleReplaceExercise = (exerciseId: number) => {
    setExerciseMenuOpen(null);
    navigate(`/workout/select-exercises?workoutId=${workout?.id}&replaceExerciseId=${exerciseId}&mode=replace`);
  };

  const handleDeleteExercise = async (exerciseId: number) => {
    if (!workout) return;

    try {
      const response = await fetch(`/api/workouts/exercises/${exerciseId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Refresh workout data
        const workoutResponse = await fetch(`/api/workouts/${workout.id}`);
        if (workoutResponse.ok) {
          const updatedWorkout = await workoutResponse.json();
          setWorkout(updatedWorkout);
        }
      }
    } catch (error) {
      console.error('Error deleting exercise:', error);
    }
    setExerciseMenuOpen(null);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || !workout) return;

    if (active.id !== over.id) {
      const oldIndex = workout.exercises.findIndex((exercise) => exercise.id === active.id);
      const newIndex = workout.exercises.findIndex((exercise) => exercise.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      // Update local state immediately for smooth UI
      const newExercises = arrayMove(workout.exercises, oldIndex, newIndex);
      setWorkout({ ...workout, exercises: newExercises });

      // Update backend with new order
      try {
        const exerciseIds = newExercises.map(exercise => exercise.id);
        const response = await fetch(`/api/workouts/${workout.id}/exercises/reorder`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ exerciseIds }),
        });

        if (!response.ok) {
          console.error('Failed to update exercise order');
          // Refresh workout data to restore correct order
          const workoutResponse = await fetch(`/api/workouts/${workout.id}`);
          if (workoutResponse.ok) {
            const updatedWorkout = await workoutResponse.json();
            setWorkout(updatedWorkout);
          }
        }
      } catch (error) {
        console.error('Error updating exercise order:', error);
        // Refresh workout data to restore correct order
        const workoutResponse = await fetch(`/api/workouts/${workout.id}`);
        if (workoutResponse.ok) {
          const updatedWorkout = await workoutResponse.json();
          setWorkout(updatedWorkout);
        }
      }
    }
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setExerciseMenuOpen(null);
    };
    
    if (exerciseMenuOpen !== null) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [exerciseMenuOpen]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Starting your workout...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <ActiveWorkoutHeader
        workout={workout}
        onCompleteWorkout={handleCompleteWorkout}
        onDiscardWorkout={handleDiscardWorkout}
        showCompleteButton={workout !== null && workout.exercises && workout.exercises.length > 0}
        backRoute="/"
      />

      {/* Main Content */}
      <div className="flex-1 px-4 py-2">
        {!workout || !workout.exercises || workout.exercises.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-8 px-6">
            <div className="space-y-4">
              <p className="text-white text-lg leading-relaxed">
                Add exercises using "+" at the bottom screen and to start the workout.
              </p>
              <div className="flex items-center space-x-2 text-gray-400">
                <div className="h-px bg-gray-600 flex-1"></div>
                <span className="text-sm">or</span>
                <div className="h-px bg-gray-600 flex-1"></div>
              </div>
              <p className="text-gray-400 text-base leading-relaxed">
                Goto "History page" and select and previously completed workout and start that workout
              </p>
            </div>
            
            <button
              onClick={() => navigate('/history')}
              className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg transition-colors flex items-center space-x-2"
            >
              <History className="w-5 h-5" />
              <span>Go to History</span>
            </button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext 
              items={workout.exercises.map(ex => ex.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2 w-full max-w-full">
                {workout.exercises.map((exercise, index) => (
                  <SortableExerciseItem
                    key={exercise.id}
                    exercise={exercise}
                    index={index}
                    status={getExerciseStatus(exercise)}
                    
                    exerciseMenuOpen={exerciseMenuOpen}
                    handleExerciseMenuClick={handleExerciseMenuClick}
                    handleDeleteExercise={handleDeleteExercise}
                    handleReplaceExercise={handleReplaceExercise}
                    setExerciseMenuOpen={setExerciseMenuOpen}
                    navigate={navigate}
                    workout={workout}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-20 right-6 z-40">
        {/* Add Exercise Button */}
        <button
          onClick={handleAddExercise}
          className="w-14 h-14 bg-cyan-500 hover:bg-cyan-600 text-black rounded-full shadow-2xl shadow-cyan-500/50 hover:shadow-cyan-500/80 transition-all duration-200 hover:scale-110 flex items-center justify-center"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
