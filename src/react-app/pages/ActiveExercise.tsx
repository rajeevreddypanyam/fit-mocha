import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import { MoreVertical, Plus, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import ActiveWorkoutHeader from '@/react-app/components/ActiveWorkoutHeader';
import { useSettings } from '@/react-app/hooks/useSettings';

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
  notes?: string;
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
  completed_at: string | null;
}

interface HistoricalWorkout {
  date: string;
  days_ago: number;
  sets: {
    set_number: number;
    weight_lbs?: number;
    reps?: number;
    duration_seconds?: number;
    notes?: string;
    workout_exercise_id: number;
  }[];
}

interface Workout {
  id: number;
  name?: string;
  started_at: string;
  completed_at?: string;
  exercises?: WorkoutExercise[];
}

export default function ActiveExercise() {
  const navigate = useNavigate();
  const { workoutExerciseId } = useParams();
  const [searchParams] = useSearchParams();
  const workoutId = searchParams.get('workoutId');
  const { getWeightUnit, formatWeight, formatWeightWithUnit, convertWeightToStorage } = useSettings();
  
  const [exercise, setExercise] = useState<WorkoutExercise | null>(null);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [historicalWorkouts, setHistoricalWorkouts] = useState<HistoricalWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNotes, setShowNotes] = useState(false);
  const [exerciseMenuOpen, setExerciseMenuOpen] = useState(false);
  const [setMenuOpen, setSetMenuOpen] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingSet, setEditingSet] = useState<WorkoutSet | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  
  // Form state
  const [weightValue, setWeightValue] = useState<string>('0');
  const [repsValue, setRepsValue] = useState<string>('0');
  const [commentValue, setCommentValue] = useState<string>('');
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [tempComment, setTempComment] = useState<string>('');
  const [currentActiveSet, setCurrentActiveSet] = useState<number>(1);

  useEffect(() => {
    if (workoutExerciseId && workoutId) {
      fetchExerciseData();
      fetchWorkoutData();
      fetchHistoricalData();
    }
  }, [workoutExerciseId, workoutId]);

  // Update active set based on completed sets
  useEffect(() => {
    if (exercise?.sets) {
      const completedSets = exercise.sets.filter(set => set.completed_at).length;
      const nextActiveSet = completedSets + 1;
      setCurrentActiveSet(nextActiveSet);
    }
  }, [exercise?.sets]);

  const fetchExerciseData = async () => {
    try {
      const response = await fetch(`/api/workouts/exercises/${workoutExerciseId}`);
      if (response.ok) {
        const data = await response.json();
        setExercise(data);
      }
    } catch (error) {
      console.error('Error fetching exercise data:', error);
    }
  };

  const fetchWorkoutData = async () => {
    try {
      const response = await fetch(`/api/workouts/${workoutId}`);
      if (response.ok) {
        const data = await response.json();
        setWorkout(data);
      }
    } catch (error) {
      console.error('Error fetching workout data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistoricalData = async () => {
    try {
      const response = await fetch(`/api/workouts/exercises/${workoutExerciseId}/history`);
      if (response.ok) {
        const data = await response.json();
        setHistoricalWorkouts(data);
      }
    } catch (error) {
      console.error('Error fetching historical data:', error);
    }
  };

  const handleCompleteWorkout = async () => {
    if (!workout) return;
    
    // Navigate to summary page without completing the workout yet
    navigate(`/workout/summary?workoutId=${workout.id}`);
  };

  const handleDiscardWorkout = async () => {
    if (!workout) return;

    try {
      const response = await fetch(`/api/workouts/${workout.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        navigate('/', { replace: true, state: { refresh: true } });
      }
    } catch (error) {
      console.error('Error discarding workout:', error);
    }
  };

  // Check if there are any empty/blank sets or unsaved data
  const hasEmptyOrUnsavedSets = () => {
    // Check if current form has unsaved data
    const hasUnsavedFormData = (parseFloat(weightValue) > 0) || (parseInt(repsValue) > 0) || tempComment.trim();
    if (hasUnsavedFormData) return true;
    
    // Check if there are any blank sets (sets without completed_at AND without any data)
    const hasBlankSets = exercise?.sets?.some(set => 
      !set.completed_at && !set.weight_lbs && !set.reps
    );
    
    return hasBlankSets || false;
  };

  // Check if this is the last exercise in the workout
  const isLastExercise = () => {
    if (!workout?.exercises || !exercise) return false;
    
    const currentExerciseIndex = workout.exercises.findIndex(ex => ex.id === exercise.id);
    return currentExerciseIndex === workout.exercises.length - 1;
  };

  // Determine button state and text
  const getButtonState = () => {
    // If there are empty sets or unsaved data, show SAVE SET
    if (hasEmptyOrUnsavedSets()) {
      return { text: 'SAVE SET', action: handleSaveSet };
    }
    
    // All sets are complete and no unsaved data
    if (isLastExercise()) {
      return { text: 'FINISH WORKOUT', action: handleNextExercise };
    } else {
      return { text: 'NEXT EXERCISE', action: handleNextExercise };
    }
  };

  // Get next exercise in workout
  const getNextExercise = () => {
    if (!workout?.exercises || !exercise) return null;
    
    const currentExerciseIndex = workout.exercises.findIndex(ex => ex.id === exercise.id);
    if (currentExerciseIndex === -1 || currentExerciseIndex >= workout.exercises.length - 1) {
      return null; // Current exercise not found or is the last one
    }
    
    return workout.exercises[currentExerciseIndex + 1];
  };

  const handleNextExercise = () => {
    const nextExercise = getNextExercise();
    if (nextExercise) {
      navigate(`/workout/exercise/${nextExercise.id}?workoutId=${workout?.id}`);
    } else {
      // Last exercise, go to summary
      navigate(`/workout/summary?workoutId=${workout?.id}`);
    }
  };

  const handleSaveSet = async () => {
    if (!exercise || isSubmitting) return;

    const weight = parseFloat(weightValue) || 0;
    const reps = parseInt(repsValue) || 0;
    
    setIsSubmitting(true);
    try {
      // Check if there's already an incomplete set for the current active set number
      const existingIncompleteSet = exercise.sets?.find(
        set => set.set_number === currentActiveSet && !set.completed_at
      );

      // Convert weight from display unit to storage unit (lbs)
      const weightInLbs = weight > 0 ? convertWeightToStorage(weight) : undefined;

      // Prepare data with proper undefined handling
      const requestData = {
        workout_exercise_id: exercise.id,
        set_number: currentActiveSet,
        weight_lbs: weightInLbs,
        reps: reps > 0 ? reps : undefined,
        notes: tempComment && tempComment.trim() ? tempComment.trim() : undefined,
      };

      console.log('Saving set with data:', requestData);
      console.log('Existing incomplete set:', existingIncompleteSet);

      let response;
      let savedSet: WorkoutSet;

      if (existingIncompleteSet) {
        // Update existing incomplete set
        const updateData = {
          weight_lbs: weightInLbs,
          reps: reps > 0 ? reps : undefined,
          notes: tempComment && tempComment.trim() ? tempComment.trim() : undefined,
        };
        
        response = await fetch(`/api/workouts/sets/${existingIncompleteSet.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData),
        });
        
        if (response.ok) {
          savedSet = await response.json();
          console.log('Set updated successfully:', savedSet);
          
          // Update exercise state immediately - replace the existing set
          setExercise(prev => {
            if (!prev) return prev;
            const updatedSets = (prev.sets || []).map(set => 
              set.id === existingIncompleteSet.id ? savedSet : set
            );
            return { ...prev, sets: updatedSets };
          });
        }
      } else {
        // Create new set
        response = await fetch(`/api/workouts/exercises/${workoutExerciseId}/sets`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData),
        });
        
        if (response.ok) {
          savedSet = await response.json();
          console.log('Set created successfully:', savedSet);
          
          // Update exercise state immediately - add new set
          setExercise(prev => {
            if (!prev) return prev;
            const updatedSets = [...(prev.sets || []), savedSet];
            return { ...prev, sets: updatedSets };
          });
        }
      }

      if (response.ok) {
        // Reset form
        setWeightValue('0');
        setRepsValue('0');
        setTempComment('');
        setCommentValue('');
        
        // Refresh exercise data to ensure consistency
        await fetchExerciseData();
      } else {
        let errorMessage = 'Please try again.';
        try {
          const errorData = await response.json();
          console.error('Save set error:', errorData);
          if (typeof errorData.error === 'string') {
            errorMessage = errorData.error;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          } else {
            errorMessage = `Server error: ${response.status}`;
          }
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
          errorMessage = `Server error: ${response.status}`;
        }
        alert(`Failed to save set: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Error saving set:', error);
      alert('Failed to save set. Network error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddSet = async () => {
    if (!exercise) return;

    try {
      // Get the next set number based on existing sets
      const existingSets = exercise.sets || [];
      const maxSetNumber = existingSets.length > 0 ? Math.max(...existingSets.map(s => s.set_number)) : 0;
      const setNumber = maxSetNumber + 1;
      
      // Prepare data with proper undefined handling (not null)
      const requestData = {
        workout_exercise_id: exercise.id,
        set_number: setNumber,
        // Don't include optional fields that are null/undefined
      };

      console.log('Adding set with data:', requestData);
      
      const response = await fetch(`/api/workouts/exercises/${workoutExerciseId}/sets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (response.ok) {
        const newSet = await response.json();
        console.log('Set added successfully:', newSet);
        
        // Update exercise state immediately
        setExercise(prev => {
          if (!prev) return prev;
          const updatedSets = [...(prev.sets || []), newSet];
          return { ...prev, sets: updatedSets };
        });
        
        // Refresh exercise data to ensure consistency
        await fetchExerciseData();
      } else {
        let errorMessage = 'Please try again.';
        try {
          const errorData = await response.json();
          console.error('Add set error:', errorData);
          if (typeof errorData.error === 'string') {
            errorMessage = errorData.error;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          } else {
            errorMessage = `Server error: ${response.status}`;
          }
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
          errorMessage = `Server error: ${response.status}`;
        }
        alert(`Failed to add set: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Error adding set:', error);
      alert('Failed to add set. Network error occurred.');
    }
  };

  const handleDeleteSet = async (setId: number) => {
    try {
      const response = await fetch(`/api/workouts/sets/${setId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Update exercise state immediately
        setExercise(prev => {
          if (!prev) return prev;
          const updatedSets = (prev.sets || []).filter(set => set.id !== setId);
          return { ...prev, sets: updatedSets };
        });
        
        // Refresh exercise data to ensure consistency
        await fetchExerciseData();
      } else {
        const errorData = await response.json();
        console.error('Delete set error:', errorData);
        alert(`Failed to delete set: ${errorData.error || 'Please try again.'}`);
      }
    } catch (error) {
      console.error('Error deleting set:', error);
      alert('Failed to delete set. Please try again.');
    }
  };

  const handleDuplicateSet = async (setId: number) => {
    try {
      if (setId) {
        // Duplicate existing set
        const response = await fetch(`/api/workouts/sets/${setId}/duplicate`, {
          method: 'POST',
        });

        if (response.ok) {
          const newSet = await response.json();
          
          // Update exercise state immediately
          setExercise(prev => {
            if (!prev) return prev;
            const updatedSets = [...(prev.sets || []), newSet];
            return { ...prev, sets: updatedSets };
          });
          
          // Refresh exercise data to ensure consistency
          await fetchExerciseData();
        } else {
          const errorData = await response.json();
          console.error('Duplicate set error:', errorData);
          alert(`Failed to duplicate set: ${errorData.error || 'Please try again.'}`);
        }
      } else {
        // Create new empty set (same as add set)
        await handleAddSet();
      }
    } catch (error) {
      console.error('Error duplicating set:', error);
      alert('Failed to duplicate set. Please try again.');
    }
  };

  const handleEditSet = (set: WorkoutSet) => {
    setEditingSet(set);
    // Convert weight from storage to display unit and format
    setWeightValue(set.weight_lbs ? formatWeight(set.weight_lbs) : '0');
    setRepsValue(set.reps?.toString() || '0');
    setCommentValue(set.notes || '');
    setShowEditDialog(true);
    setSetMenuOpen(null);
  };

  const handleUpdateSet = async () => {
    if (!editingSet || isSubmitting) return;

    const weight = parseFloat(weightValue) || 0;
    const reps = parseInt(repsValue) || 0;

    setIsSubmitting(true);
    try {
      // Convert weight from display unit to storage unit (lbs)
      const weightInLbs = weight > 0 ? convertWeightToStorage(weight) : undefined;

      // Prepare data with proper undefined handling
      const requestData = {
        weight_lbs: weightInLbs,
        reps: reps > 0 ? reps : undefined,
        notes: commentValue && commentValue.trim() ? commentValue.trim() : undefined,
      };

      console.log('Updating set with data:', requestData);

      const response = await fetch(`/api/workouts/sets/${editingSet.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (response.ok) {
        const updatedSet = await response.json();
        console.log('Set updated successfully:', updatedSet);
        
        // Update exercise state immediately
        setExercise(prev => {
          if (!prev) return prev;
          const updatedSets = (prev.sets || []).map(set => 
            set.id === editingSet.id ? updatedSet : set
          );
          return { ...prev, sets: updatedSets };
        });
        
        setShowEditDialog(false);
        setEditingSet(null);
        setWeightValue('0');
        setRepsValue('0');
        setCommentValue('');
        
        // Refresh exercise data to ensure consistency
        await fetchExerciseData();
      } else {
        let errorMessage = 'Please try again.';
        try {
          const errorData = await response.json();
          console.error('Update set error:', errorData);
          if (typeof errorData.error === 'string') {
            errorMessage = errorData.error;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          } else {
            errorMessage = `Server error: ${response.status}`;
          }
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
          errorMessage = `Server error: ${response.status}`;
        }
        alert(`Failed to update set: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Error updating set:', error);
      alert('Failed to update set. Network error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyFromHistory = (historicalSet: any) => {
    if (historicalSet.weight_lbs) {
      // Convert from storage unit to display unit
      setWeightValue(formatWeight(historicalSet.weight_lbs));
    }
    if (historicalSet.reps) {
      setRepsValue(historicalSet.reps.toString());
    }
    if (historicalSet.notes) {
      setTempComment(historicalSet.notes);
    }
  };

  const handleCommentSave = () => {
    setCommentValue(tempComment);
    setShowCommentDialog(false);
  };

  const handleCommentCancel = () => {
    setTempComment(commentValue); // Reset to previous value
    setShowCommentDialog(false);
  };

  const handleCommentButtonClick = () => {
    setTempComment(commentValue); // Initialize with current value
    setShowCommentDialog(true);
  };

  

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getMuscleGroupIcon = (muscleGroup: string) => {
    const muscleIconMap: { [key: string]: string } = {
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
    return muscleIconMap[muscleGroup] || muscleIconMap['Abs'];
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setExerciseMenuOpen(false);
      setSetMenuOpen(null);
    };
    
    if (exerciseMenuOpen || setMenuOpen !== null) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [exerciseMenuOpen, setMenuOpen]);

  const completedSetsCount = exercise?.sets?.filter(set => set.completed_at)?.length || 0;
  const totalSets = Math.max(completedSetsCount, exercise?.sets?.length || 0, 3);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (!exercise || !workout) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">Exercise not found</p>
          <button
            onClick={() => navigate('/workout/start')}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            Back to Workout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white max-w-md mx-auto flex flex-col">
      <ActiveWorkoutHeader
        workout={workout ? { ...workout, exercises: exercise ? [exercise] : [] } : null}
        onCompleteWorkout={handleCompleteWorkout}
        onDiscardWorkout={handleDiscardWorkout}
        showCompleteButton={true}
        backRoute="/workout/start"
      />

      <div className="flex-1 overflow-y-auto p-4 pb-32">
        {/* Exercise Information */}
        <div className="bg-gray-800 rounded-xl p-4 mb-4 border border-gray-700 shadow-lg shadow-black/20">
          <div className="flex items-start space-x-4">
            {/* Exercise Thumbnail */}
            <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-700 flex items-center justify-center flex-shrink-0">
              {exercise.video_url ? (
                <img
                  src={`https://vumbnail.com/${exercise.video_url.split('/').pop()}.jpg`}
                  alt={exercise.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = getMuscleGroupIcon(exercise.muscle_group);
                    target.className = "w-full h-full object-contain p-2";
                  }}
                />
              ) : (
                <img
                  src={getMuscleGroupIcon(exercise.muscle_group)}
                  alt={exercise.name}
                  className="w-full h-full object-contain p-2"
                />
              )}
            </div>
            
            <div className="flex-1">
              <h1 className="text-lg font-semibold text-white mb-1">{exercise.name}</h1>
              <p className="text-cyan-500 text-sm mb-2">{completedSetsCount}/{totalSets} Sets done</p>
              
              
            </div>
            
            <div className="relative">
              <button
                onClick={() => setExerciseMenuOpen(!exerciseMenuOpen)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <MoreVertical className="w-5 h-5 text-gray-400" />
              </button>
              
              {exerciseMenuOpen && (
                <div className="absolute right-0 top-full mt-1 bg-gray-900 border border-gray-600 rounded-lg shadow-lg z-10 min-w-48">
                  <div className="py-1">
                    <button className="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-800 transition-colors">
                      Replace exercise
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-800 transition-colors">
                      Superset selection
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Notes Section */}
          <div className="mt-4">
            <button
              onClick={() => setShowNotes(!showNotes)}
              className="w-full flex items-center justify-between text-left"
            >
              <span className="text-cyan-500 text-sm font-medium">Notes</span>
              {showNotes ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>
            
            {showNotes && (
              <div className="mt-2 text-sm text-gray-300">
                {exercise.notes || 'Register Both Sides Weights + Bar'}
              </div>
            )}
          </div>
        </div>

        {/* Today's Sets */}
        <div className="mb-6">
          <h2 className="text-white font-semibold text-lg mb-3">Today</h2>
          <div className="bg-slate-700/30 hover:bg-slate-700/40 rounded-xl p-4 transition-all duration-200 border border-slate-600/20 shadow-lg hover:shadow-xl shadow-black/20">
            <div className="space-y-2">
              {/* Show sets based on actual data plus minimum 3 empty placeholders */}
              {Array.from({ length: Math.max(3, Math.max(...(exercise.sets?.map(s => s.set_number) || [0]))) }, (_, index) => {
                const setNumber = index + 1;
                const existingSet = exercise.sets?.find(set => set.set_number === setNumber);
                
                return (
                  <div key={existingSet?.id || `empty-${setNumber}`} className="flex items-center space-x-3 py-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-black font-semibold ${
                      currentActiveSet === setNumber ? 'bg-cyan-500' : 
                      existingSet?.completed_at ? 'bg-green-500' : 'bg-gray-600'
                    }`}>
                      {setNumber}
                    </div>
                    <div className="flex-1">
                      <span className={`font-medium ${
                        currentActiveSet === setNumber ? 'text-cyan-400' : 'text-white'
                      }`}>
                        SET {setNumber} {currentActiveSet === setNumber ? '(Active)' : ''}
                      </span>
                      {existingSet && (existingSet.completed_at || existingSet.weight_lbs || existingSet.reps) && (
                        <div className="text-sm text-gray-400 mt-1">
                          {existingSet.weight_lbs ? formatWeightWithUnit(existingSet.weight_lbs) : ''} 
                          {existingSet.weight_lbs && existingSet.reps ? ' x ' : ''}
                          {existingSet.reps ? `${existingSet.reps} Reps` : ''}
                          {!existingSet.completed_at && (existingSet.weight_lbs || existingSet.reps) && (
                            <span className="text-yellow-500 text-xs ml-2">(In Progress)</span>
                          )}
                          {existingSet.notes && (
                            <div className="text-gray-500 text-xs mt-1">"{existingSet.notes}"</div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSetMenuOpen(setMenuOpen === setNumber ? null : setNumber);
                        }}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <MoreVertical className="w-5 h-5 text-gray-400" />
                      </button>
                      
                      {setMenuOpen === setNumber && (
                        <div className="absolute right-0 top-full mt-1 bg-gray-900 border border-gray-600 rounded-lg shadow-lg z-10 min-w-36">
                          <div className="py-1">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (existingSet && (existingSet.weight_lbs || existingSet.reps)) {
                                  handleEditSet(existingSet);
                                }
                                setSetMenuOpen(null);
                              }}
                              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                                existingSet && (existingSet.weight_lbs || existingSet.reps)
                                  ? 'text-white hover:bg-gray-800 cursor-pointer'
                                  : 'text-gray-500 cursor-not-allowed'
                              }`}
                              disabled={!existingSet || (!existingSet.weight_lbs && !existingSet.reps)}
                            >
                              Edit set
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicateSet(existingSet?.id || 0);
                                setSetMenuOpen(null);
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-800 transition-colors"
                            >
                              Duplicate set
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (existingSet) {
                                  handleDeleteSet(existingSet.id);
                                }
                                setSetMenuOpen(null);
                              }}
                              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                                existingSet ? 'text-red-400 hover:bg-gray-800' : 'text-gray-500 cursor-not-allowed'
                              }`}
                              disabled={!existingSet}
                            >
                              Delete set
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {/* Add Set Button */}
              <button
                onClick={handleAddSet}
                className="w-full bg-gray-800 hover:bg-gray-700 rounded-lg p-4 flex items-center justify-center space-x-2 border-2 border-dashed border-gray-600 transition-all duration-300 shadow-lg hover:shadow-xl shadow-black/20"
              >
                <Plus className="w-5 h-5 text-gray-400" />
                <span className="text-gray-400 font-medium">ADD SET</span>
              </button>
            </div>
          </div>
        </div>

        {/* Historical Workouts */}
        {historicalWorkouts.map((historical, index) => (
          <div key={index} className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold">{formatDate(historical.date)}</h3>
              <span className="text-gray-400 text-sm">{historical.days_ago} Days ago</span>
            </div>
            
            <div className="space-y-3">
              {historical.sets.map((set, setIndex) => {
                // Check if this is a new exercise session (different workout_exercise_id)
                const isNewSession = setIndex > 0 && historical.sets[setIndex - 1].workout_exercise_id !== set.workout_exercise_id;
                
                return (
                  <div key={`${set.workout_exercise_id}-${set.set_number}`}>
                    {isNewSession && (
                      <div className="flex items-center my-4">
                        <div className="flex-1 h-px bg-gray-600"></div>
                        <span className="px-3 text-xs text-gray-400 bg-gray-900">New Round</span>
                        <div className="flex-1 h-px bg-gray-600"></div>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                          {set.set_number}
                        </div>
                        <div className="text-white">
                          {set.weight_lbs ? formatWeightWithUnit(set.weight_lbs) : `0.00 ${getWeightUnit()}`} 
                          {' x '}
                          {set.reps || 0} Reps
                        </div>
                      </div>
                      
                      <button
                        onClick={() => copyFromHistory(set)}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <Copy className="w-5 h-5 text-gray-400" />
                      </button>
                    </div>
                    {set.notes && (
                      <div className="text-sm text-gray-400 mt-2 ml-11">"{set.notes}"</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Edit Set Dialog */}
      {showEditDialog && editingSet && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">Edit Set {editingSet.set_number}</h3>
            
            <div className="space-y-4">
              {/* Weight and Reps */}
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Weight ({getWeightUnit()})</label>
                  <input
                    type="number"
                    value={weightValue}
                    onChange={(e) => setWeightValue(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg py-3 px-4 text-white text-center text-lg font-mono focus:outline-none focus:border-cyan-500"
                    step="0.25"
                    min="0"
                    placeholder="0.00"
                  />
                </div>
                
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Reps</label>
                  <input
                    type="number"
                    value={repsValue}
                    onChange={(e) => setRepsValue(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg py-3 px-4 text-white text-center text-lg font-mono focus:outline-none focus:border-cyan-500"
                    step="1"
                    min="0"
                    placeholder="0"
                  />
                </div>
              </div>
              
              {/* Comment Field */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">Comment</label>
                <input
                  type="text"
                  value={commentValue}
                  onChange={(e) => setCommentValue(e.target.value)}
                  placeholder="Add a comment for this set..."
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg py-3 px-4 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500"
                />
              </div>
              
              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowEditDialog(false);
                    setEditingSet(null);
                    setWeightValue('0');
                    setRepsValue('0');
                    setCommentValue('');
                  }}
                  className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateSet}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-black rounded-lg font-semibold transition-colors"
                >
                  {isSubmitting ? 'UPDATING...' : 'UPDATE'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Set Comment Dialog */}
      {showCommentDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">Set Comment</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-2">Add a comment for this set (optional)</label>
                <textarea
                  value={tempComment}
                  onChange={(e) => setTempComment(e.target.value)}
                  placeholder="e.g., Felt heavy, good form, increase weight next time..."
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg py-3 px-4 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500 resize-none"
                  rows={3}
                />
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={handleCommentCancel}
                  className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCommentSave}
                  className="flex-1 px-4 py-3 bg-cyan-500 hover:bg-cyan-600 text-black rounded-lg font-semibold transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Input Section */}
      <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-gray-900 border-t border-gray-700 p-4 shadow-2xl shadow-black/50 backdrop-blur-lg">
        <div className="space-y-4">
          {/* Weight and Reps */}
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">Weight ({getWeightUnit()})</label>
              <input
                type="number"
                value={weightValue}
                onChange={(e) => setWeightValue(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg py-3 px-4 text-white text-center text-lg font-mono focus:outline-none focus:border-cyan-500"
                step="0.25"
                min="0"
                placeholder="0.00"
              />
            </div>
            
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">Reps</label>
              <input
                type="number"
                value={repsValue}
                onChange={(e) => setRepsValue(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg py-3 px-4 text-white text-center text-lg font-mono focus:outline-none focus:border-cyan-500"
                step="1"
                min="0"
                placeholder="0"
              />
            </div>
          </div>
          
          {/* Comment Display */}
          {(tempComment || commentValue) && (
            <div className="bg-gray-700 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">Set Comment:</div>
              <div className="text-white text-sm">"{tempComment || commentValue}"</div>
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={handleCommentButtonClick}
              className="flex-1 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white py-3 rounded-lg font-medium transition-colors"
            >
              COMMENT
            </button>
            <button
              onClick={getButtonState().action}
              disabled={isSubmitting}
              className="flex-1 bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-black py-3 rounded-lg font-semibold transition-colors"
            >
              {isSubmitting ? 'SAVING...' : getButtonState().text}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
