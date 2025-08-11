import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router';
import { ArrowLeft, Share, Clock, Activity, Target, Zap, MoreVertical, Edit, Trash2, Plus, RefreshCw, Save, X } from 'lucide-react';
import { useSettings } from '@/react-app/hooks/useSettings';
import ExerciseSelectionModal from '@/react-app/components/ExerciseSelectionModal';

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
  completed_at: string | null;
}

interface WorkoutSummary {
  id: number;
  name?: string;
  notes?: string | null;
  started_at: string;
  completed_at: string;
  duration_minutes: number;
  intensity_level?: number;
  exercises: WorkoutExercise[];
}

// Types for tracking pending changes
interface PendingSetChange {
  id: number;
  type: 'edit' | 'delete' | 'add';
  setData?: Partial<WorkoutSet>;
  originalSet?: WorkoutSet;
}

interface PendingExerciseChange {
  id: number;
  type: 'delete' | 'replace';
  newExerciseId?: number;
  newExerciseName?: string;
}

interface PendingNewExercise {
  exerciseId: number;
  name: string;
  category: string;
  muscle_group: string;
  equipment: string;
  video_url?: string;
  tempId: string;
}

interface PendingChanges {
  workout?: Partial<WorkoutSummary>;
  sets: Map<number, PendingSetChange>;
  exercises: Map<number, PendingExerciseChange>;
  newSets: Map<string, Omit<WorkoutSet, 'id'>>; // key is exerciseId-tempId
  newExercises: Map<string, PendingNewExercise>; // key is tempId
}

const intensityLevels = [
  { value: 1, emoji: '😴', label: 'Very Easy', met: 2 },
  { value: 2, emoji: '😊', label: 'Easy', met: 3 },
  { value: 3, emoji: '😐', label: 'Moderate', met: 5 },
  { value: 4, emoji: '😤', label: 'Hard', met: 7 },
  { value: 5, emoji: '🥵', label: 'Very Hard', met: 9 }
];

export default function HistorySummary() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { formatWeightWithUnit } = useSettings();
  
  const [originalWorkout, setOriginalWorkout] = useState<WorkoutSummary | null>(null);
  const [workout, setWorkout] = useState<WorkoutSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showEditTitleDialog, setShowEditTitleDialog] = useState(false);
  const [tempWorkoutName, setTempWorkoutName] = useState<string>('');
  const [showEditDurationDialog, setShowEditDurationDialog] = useState(false);
  const [tempStartDateTime, setTempStartDateTime] = useState<string>('');
  const [tempEndDateTime, setTempEndDateTime] = useState<string>('');
  const [showEditIntensityDialog, setShowEditIntensityDialog] = useState(false);
  const [tempIntensity, setTempIntensity] = useState<number>(3);
  const { convertWeightFromStorage, convertWeightToStorage, getWeightUnit, formatWeight } = useSettings();
  const [showEditNotesDialog, setShowEditNotesDialog] = useState(false);
  const [tempWorkoutNotes, setTempWorkoutNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [exerciseMenuOpen, setExerciseMenuOpen] = useState<number | null>(null);
  const [setMenuOpen, setSetMenuOpen] = useState<string | null>(null);
  const [editingSet, setEditingSet] = useState<WorkoutSet | null>(null);
  const [showEditSetDialog, setShowEditSetDialog] = useState(false);
  const [setWeightValue, setSetWeightValue] = useState<string>('0');
  const [setRepsValue, setSetRepsValue] = useState<string>('0');
  const [setNotesValue, setSetNotesValue] = useState<string>('');
  const [showAddSetDialog, setShowAddSetDialog] = useState(false);
  const [addingSetToExercise, setAddingSetToExercise] = useState<number | null>(null);
  const [showExerciseSelectionModal, setShowExerciseSelectionModal] = useState(false);
  const [exerciseSelectionMode, setExerciseSelectionMode] = useState<'add' | 'replace'>('add');
  const [replacingExerciseId, setReplacingExerciseId] = useState<number | null>(null);

  // Pending changes tracking
  const [pendingChanges, setPendingChanges] = useState<PendingChanges>({
    sets: new Map(),
    exercises: new Map(),
    newSets: new Map(),
    newExercises: new Map()
  });

  // Helper to generate temporary IDs for new sets
  const [tempSetIdCounter, setTempSetIdCounter] = useState(1);

  // Track restoration state to ensure proper UI updates
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    if (id) {
      fetchWorkoutSummary();
    }
  }, [id]);

  // Check for refresh state from navigation (when returning from exercise selection)
  useEffect(() => {
    if (location.state?.refresh) {
      console.log('=== REFRESH STATE DETECTED ===');
      console.log('Location state:', location.state);
      console.log('Current pending changes before refresh:', {
        workoutChanges: !!pendingChanges.workout,
        setsCount: pendingChanges.sets.size,
        exercisesCount: pendingChanges.exercises.size,
        newSetsCount: pendingChanges.newSets.size
      });
      
      // Don't set loading to true to avoid clearing the UI
      // Don't clear the refresh state immediately - wait for restoration to complete
      
      // Check sessionStorage immediately
      const preservationKey = `workout-${id}-preservation`;
      const preservationData = sessionStorage.getItem(preservationKey);
      console.log('SessionStorage check - Key:', preservationKey);
      console.log('SessionStorage check - Has data:', !!preservationData);
      if (preservationData) {
        try {
          const parsed = JSON.parse(preservationData);
          console.log('SessionStorage data preview:', {
            timestamp: parsed.timestamp,
            workoutId: parsed.workoutId,
            hasPendingChanges: !!parsed.pendingChanges,
            setsCount: parsed.pendingChanges?.sets?.length || 0
          });
        } catch (e) {
          console.error('Failed to parse sessionStorage data:', e);
        }
      }
      
      // Call restoration immediately, then clear nav state after completion
      console.log('Calling fetchWorkoutSummaryWithPendingPreservation after refresh state detected');
      fetchWorkoutSummaryWithPendingPreservation().then(() => {
        // Clear the refresh state only after restoration is complete
        console.log('Restoration complete, clearing navigation state');
        navigate(location.pathname, { replace: true, state: {} });
      }).catch(error => {
        console.error('Error during restoration, clearing navigation state:', error);
        navigate(location.pathname, { replace: true, state: {} }); // Clear even on error
      });
    }
  }, [location.state?.refresh, location.state?.timestamp]); // Watch for both refresh flag and timestamp

  const fetchWorkoutSummary = async () => {
    try {
      const response = await fetch(`/api/workouts/${id}`);
      if (response.ok) {
        const data = await response.json();
        setOriginalWorkout(data);
        
        setWorkout(data);
        setTempWorkoutName(data.name || generateWorkoutTitle(data.exercises || []));
        setTempIntensity(data.intensity_level || 3);
        setTempWorkoutNotes(data.notes || '');
        // Reset pending changes when fetching fresh data
        setPendingChanges({
          sets: new Map(),
          exercises: new Map(),
          newSets: new Map(),
          newExercises: new Map()
        });
      } else {
        console.error('Failed to fetch workout summary');
        navigate('/history');
      }
    } catch (error) {
      console.error('Error fetching workout summary:', error);
      navigate('/history');
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkoutSummaryWithPendingPreservation = async (): Promise<void> => {
    try {
      setIsRestoring(true);
      console.log('=== PRESERVING PENDING CHANGES ===');
      
      // First try to load preservation data from sessionStorage
      let savedPendingChanges: any = {
        workout: undefined,
        sets: new Map(),
        exercises: new Map(),
        newSets: new Map()
      };
      let savedTempValues: any = {
        tempWorkoutName,
        tempIntensity,
        tempWorkoutNotes,
        tempStartDateTime,
        tempEndDateTime
      };
      let savedTempSetIdCounter = tempSetIdCounter;
      
      const preservationKey = `workout-${id}-preservation`;
      console.log('Looking for sessionStorage key:', preservationKey);
      const preservationData = sessionStorage.getItem(preservationKey);
      console.log('Raw preservation data from sessionStorage:', preservationData ? preservationData.substring(0, 200) + '...' : 'null');
      
      if (preservationData) {
        try {
          const parsed = JSON.parse(preservationData);
          console.log('Successfully parsed preservation data:');
          console.log('- Timestamp:', parsed.timestamp, 'Age:', Date.now() - parsed.timestamp, 'ms');
          console.log('- Workout ID:', parsed.workoutId);
          console.log('- Has workout changes:', !!parsed.pendingChanges?.workout);
          console.log('- Sets changes count:', parsed.pendingChanges?.sets?.length || 0);
          console.log('- Exercises changes count:', parsed.pendingChanges?.exercises?.length || 0);
          console.log('- New sets count:', parsed.pendingChanges?.newSets?.length || 0);
          console.log('- Temp values:', parsed.tempValues);
          
          // Restore pending changes from sessionStorage
          savedPendingChanges = {
            workout: parsed.pendingChanges.workout,
            sets: new Map(parsed.pendingChanges.sets || []),
            exercises: new Map(parsed.pendingChanges.exercises || []),
            newSets: new Map(parsed.pendingChanges.newSets || []),
            newExercises: new Map(parsed.pendingChanges.newExercises || [])
          };
          
          // Restore temp values from sessionStorage
          savedTempValues = parsed.tempValues || savedTempValues;
          savedTempSetIdCounter = parsed.tempSetIdCounter || savedTempSetIdCounter;
          
          // Don't clear immediately - keep for debugging
          console.log('Keeping sessionStorage data for debugging - will clear after 30 seconds');
          setTimeout(() => {
            sessionStorage.removeItem(preservationKey);
            console.log('Delayed clear of sessionStorage preservation data');
          }, 30000);
        } catch (error) {
          console.error('Failed to parse preservation data from sessionStorage:', error);
        }
      } else {
        console.log('No preservation data found in sessionStorage, using current state');
        // Use current state as fallback
        savedPendingChanges = {
          workout: pendingChanges.workout ? { ...pendingChanges.workout } : undefined,
          sets: new Map(pendingChanges.sets),
          exercises: new Map(pendingChanges.exercises),
          newSets: new Map(pendingChanges.newSets),
          newExercises: new Map(pendingChanges.newExercises)
        };
      }

      

      console.log('Changes to preserve:', {
        workoutChanges: !!savedPendingChanges.workout,
        setsCount: savedPendingChanges.sets.size,
        exercisesCount: savedPendingChanges.exercises.size,
        newSetsCount: savedPendingChanges.newSets.size,
        tempValues: savedTempValues
      });

      const response = await fetch(`/api/workouts/${id}?_t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        console.log('Fresh data received:', {
          workoutName: data.name,
          intensityLevel: data.intensity_level,
          notes: data.notes,
          exerciseCount: data.exercises?.length || 0
        });
        
        setOriginalWorkout(data);
        
        // Apply pending workout changes to the refreshed data
        let updatedWorkout = { ...data };
        if (savedPendingChanges.workout) {
          updatedWorkout = { ...updatedWorkout, ...savedPendingChanges.workout };
          console.log('Applied workout changes to fresh data:', savedPendingChanges.workout);
        }
        setWorkout(updatedWorkout);
        
        // Set temporary UI state directly from persisted values or fresh data, prioritizing persisted
        setTempWorkoutName(savedPendingChanges.workout?.name ?? data.name ?? generateWorkoutTitle(data.exercises || []));
        setTempIntensity(savedPendingChanges.workout?.intensity_level ?? data.intensity_level ?? 3);
        setTempWorkoutNotes(savedPendingChanges.workout?.notes ?? data.notes ?? '');
        setTempStartDateTime(savedPendingChanges.workout?.started_at ?? data.started_at);
        setTempEndDateTime(savedPendingChanges.workout?.completed_at ?? data.completed_at);
        
        // Create set of current exercise IDs to validate pending changes
        const currentExerciseIds = new Set(data.exercises.map((ex: WorkoutExercise) => ex.id));
        
        // Filter pending changes to keep only those that are still valid
        const validPendingSets = new Map();
        const validPendingExercises = new Map();
        const validNewSets = new Map();
        const validNewExercises = new Map();

        // Keep set changes for exercises that still exist
        for (const [setId, change] of savedPendingChanges.sets) {
          const exerciseExists = data.exercises.some((ex: WorkoutExercise) => 
            ex.sets.some(set => set.id === setId)
          );
          if (exerciseExists) {
            validPendingSets.set(setId, change);
            console.log('Preserved set change for set', setId);
          } else {
            console.log('Discarded set change for non-existent set', setId);
          }
        }

        // Keep exercise changes for exercises that still exist
        for (const [exerciseId, change] of savedPendingChanges.exercises) {
          if (currentExerciseIds.has(exerciseId)) {
            validPendingExercises.set(exerciseId, change);
            console.log('Preserved exercise change for exercise', exerciseId);
          } else {
            console.log('Discarded exercise change for non-existent exercise', exerciseId);
          }
        }

        // Keep new sets for exercises that still exist
        for (const [key, setData] of savedPendingChanges.newSets) {
          const exerciseId = parseInt(key.split('-')[0]);
          if (currentExerciseIds.has(exerciseId)) {
            validNewSets.set(key, setData);
            console.log('Preserved new set for exercise', exerciseId);
          } else {
            console.log('Discarded new set for non-existent exercise', exerciseId);
          }
        }

        // Keep new exercises (these are always valid since they're not yet in the database)
        for (const [key, exerciseData] of savedPendingChanges.newExercises) {
          validNewExercises.set(key, exerciseData);
          console.log('Preserved new exercise', exerciseData.name);
        }

        // Restore the valid pending changes
        const finalPendingChanges = {
          workout: savedPendingChanges.workout,
          sets: validPendingSets,
          exercises: validPendingExercises,
          newSets: validNewSets,
          newExercises: validNewExercises
        };
        
        console.log('Setting final pending changes:', {
          workoutChanges: !!finalPendingChanges.workout,
          workoutChangeDetails: finalPendingChanges.workout,
          setsCount: finalPendingChanges.sets.size,
          exercisesCount: finalPendingChanges.exercises.size,
          newSetsCount: finalPendingChanges.newSets.size
        });
        
        // Apply the filtered pending changes (this is key for hasPendingChanges())
        setPendingChanges(finalPendingChanges);
        
        // Restore temp counter to avoid ID conflicts
        setTempSetIdCounter(savedTempSetIdCounter);
        
        // Set isRestoring to false only after all other states have been updated
        setIsRestoring(false);
      } else {
        console.error('Failed to fetch workout summary');
        setIsRestoring(false);
        navigate('/history');
      }
    } catch (error) {
      console.error('Error fetching workout summary:', error);
      setIsRestoring(false);
      navigate('/history');
    } finally {
      setLoading(false);
    }
  };

  const generateWorkoutTitle = (exercises: WorkoutExercise[]) => {
    if (!exercises || exercises.length === 0) return 'Workout';
    
    // Get unique muscle groups
    const muscleGroups = [...new Set(exercises.map(ex => ex.muscle_group))];
    
    if (muscleGroups.length === 1) {
      return `${muscleGroups[0]} Workout`;
    } else if (muscleGroups.length === 2) {
      return `${muscleGroups[0]}, ${muscleGroups[1]} Workout`;
    } else if (muscleGroups.length >= 3) {
      return `${muscleGroups[0]}, ${muscleGroups[1]}, ${muscleGroups[2]} Workout`;
    }
    
    return 'Full Body Workout';
  };

  const calculateWorkoutStats = () => {
    if (!workout || !workout.exercises) return { totalVolume: 0, totalReps: 0, totalSets: 0, estimatedCalories: 0, duration: 0 };
    
    let totalVolumeInLbs = 0; // Calculate in lbs first
    let totalReps = 0;
    let totalSets = 0;
    
    workout.exercises.forEach(exercise => {
      const completedSets = getDisplaySets(exercise).filter(set => !!set.completed_at);
      totalSets += completedSets.length;
      
      completedSets.forEach(set => {
        if (set.reps) totalReps += set.reps;
        if (set.weight_lbs && set.reps) {
          totalVolumeInLbs += set.weight_lbs * set.reps;
        }
      });
    });
    
    // Convert total volume to user's preferred unit
    const totalVolume = convertWeightFromStorage(totalVolumeInLbs);
    
    // Get actual duration from workout data
    const duration = workout.duration_minutes || 0;
    
    // Estimate calories based on intensity, duration, and a base metabolic equivalent
    const selectedLevel = intensityLevels.find(level => level.value === (workout.intensity_level || 3));
    const metValue = selectedLevel?.met || 5;
    const estimatedCalories = Math.round((metValue * 70 * duration) / 60); // Assuming 70kg average weight
    
    return { totalVolume, totalReps, totalSets, estimatedCalories, duration };
  };

  // Helper function to get display sets with pending changes applied
  const getDisplaySets = (exercise: WorkoutExercise): WorkoutSet[] => {
    let sets = [...exercise.sets];
    
    // Apply pending set changes
    sets = sets.map(set => {
      const pendingChange = pendingChanges.sets.get(set.id);
      if (pendingChange?.type === 'edit' && pendingChange.setData) {
        return { ...set, ...pendingChange.setData };
      }
      return set;
    }).filter(set => {
      const pendingChange = pendingChanges.sets.get(set.id);
      return pendingChange?.type !== 'delete';
    });
    
    // Add new sets
    const newSetsForExercise = Array.from(pendingChanges.newSets.entries())
      .filter(([key]) => key.startsWith(`${exercise.id}-`))
      .map(([key, setData]) => ({
        ...setData,
        id: -parseInt(key.split('-')[1]), // Use negative IDs for new sets
      }));
    
    sets.push(...newSetsForExercise);
    
    return sets.sort((a, b) => a.set_number - b.set_number);
  };

  // Helper function to get display exercises with pending changes applied
  const getDisplayExercises = (): WorkoutExercise[] => {
    if (!workout) return [];
    
    // Get existing exercises with modifications
    const existingExercises = workout.exercises.map(exercise => {
      const pendingChange = pendingChanges.exercises.get(exercise.id);
      if (pendingChange?.type === 'replace' && pendingChange.newExerciseName) {
        return {
          ...exercise,
          name: pendingChange.newExerciseName,
          exercise_id: pendingChange.newExerciseId || exercise.exercise_id
        };
      }
      return exercise;
    }).filter(exercise => {
      const pendingChange = pendingChanges.exercises.get(exercise.id);
      return pendingChange?.type !== 'delete';
    });

    // Add new exercises from pending changes
    const newExercises = Array.from(pendingChanges.newExercises.values()).map((newExercise, index) => ({
      id: -parseInt(newExercise.tempId), // Use negative temp ID
      workout_id: workout.id,
      exercise_id: newExercise.exerciseId,
      order_index: existingExercises.length + index,
      name: newExercise.name,
      category: newExercise.category,
      muscle_group: newExercise.muscle_group,
      equipment: newExercise.equipment,
      video_url: newExercise.video_url,
      sets: []
    }));

    return [...existingExercises, ...newExercises];
  };

  // Check if there are any pending changes
  const hasPendingChanges = (): boolean => {
    return pendingChanges.sets.size > 0 || 
           pendingChanges.exercises.size > 0 || 
           pendingChanges.newSets.size > 0 ||
           pendingChanges.newExercises.size > 0 ||
           !!(pendingChanges.workout && Object.keys(pendingChanges.workout).length > 0);
  };

  // Check if we should show the save/discard bar (including during restoration)
  const shouldShowSaveBar = (): boolean => {
    return hasPendingChanges() || isRestoring;
  };

  const handleShare = async () => {
    if (!workout) return;
    
    const stats = calculateWorkoutStats();
    const muscleGroups = [...new Set(getDisplayExercises().map(ex => ex.muscle_group))].join(', ');
    const weightUnit = getWeightUnit();
    const workoutTitle = workout.name || generateWorkoutTitle(workout.exercises);
    
    // Format the workout date
    const workoutDate = new Date(workout.completed_at + (workout.completed_at.includes('Z') ? '' : 'Z'));
    const dateStr = workoutDate.toLocaleDateString('en-GB', { 
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    
    // Create detailed exercise breakdown
    const exerciseDetails = getDisplayExercises().map(ex => {
      const completedSets = getDisplaySets(ex).filter(set => !!set.completed_at);
      const exerciseVolume = completedSets.reduce((sum, set) => {
        return sum + (set.weight_lbs && set.reps ? convertWeightFromStorage(set.weight_lbs * set.reps) : 0);
      }, 0);
      const exerciseReps = completedSets.reduce((sum, set) => sum + (set.reps || 0), 0);
      
      let exerciseText = `\n• ${ex.name}`;
      exerciseText += `\n  ${completedSets.length} sets | ${Math.round(exerciseVolume)} ${weightUnit} | ${exerciseReps} reps`;
      
      // Add set details
      completedSets.forEach((set) => {
        const weight = set.weight_lbs ? convertWeightFromStorage(set.weight_lbs) : 0;
        exerciseText += `\n    Set ${set.set_number}: ${weight.toFixed(1)} ${weightUnit} × ${set.reps || 0}`;
        if (set.notes) {
          exerciseText += ` - "${set.notes}"`;
        }
      });
      
      return exerciseText;
    }).join('\n');
    
    const shareText = `💪 Completed my ${workoutTitle}!
📅 ${dateStr}

📋 WORKOUT SUMMARY:
🎯 Muscles Trained: ${muscleGroups}
⏱️ Duration: ${formatTime(stats.duration)}
🏋️ Total Volume: ${Math.round(stats.totalVolume)} ${weightUnit}
📊 ${stats.totalSets} sets, ${stats.totalReps} reps
🔥 ${stats.estimatedCalories} calories burned
${workout.intensity_level ? `⚡ Intensity: ${intensityLevels.find(l => l.value === workout.intensity_level)?.emoji} ${intensityLevels.find(l => l.value === workout.intensity_level)?.label}` : ''}

📈 EXERCISES & SETS:${exerciseDetails}

${workout.notes ? `💭 Notes: ${workout.notes}` : ''}

#fitness #workout #FitTracker #strengthtraining`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'My Workout Summary',
          text: shareText,
        });
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(shareText);
        alert('Workout summary copied to clipboard!');
      }
    } catch (error) {
      console.error('Error sharing:', error);
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(shareText);
        alert('Workout summary copied to clipboard!');
      } catch (clipboardError) {
        console.error('Clipboard error:', clipboardError);
        alert('Unable to share or copy to clipboard');
      }
    }
  };

  const handleEditTitle = () => {
    setShowEditTitleDialog(true);
    setShowOptionsMenu(false);
  };

  const handleSaveTitle = () => {
    setPendingChanges(prev => ({
      ...prev,
      workout: { ...prev.workout, name: tempWorkoutName }
    }));
    setWorkout(prev => prev ? { ...prev, name: tempWorkoutName } : prev);
    setShowEditTitleDialog(false);
  };

  const handleEditDuration = () => {
    if (!workout) return;
    
    // Initialize with current workout times
    const startTime = new Date(workout.started_at + (workout.started_at.includes('Z') ? '' : 'Z'));
    const endTime = new Date(workout.completed_at + (workout.completed_at.includes('Z') ? '' : 'Z'));
    
    // Format for datetime-local input (YYYY-MM-DDTHH:mm)
    const formatForInput = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };
    
    setTempStartDateTime(formatForInput(startTime));
    setTempEndDateTime(formatForInput(endTime));
    setShowEditDurationDialog(true);
    setShowOptionsMenu(false);
  };

  const handleSaveDuration = () => {
    if (!workout || !tempStartDateTime || !tempEndDateTime) return;
    
    const startTime = new Date(tempStartDateTime);
    const endTime = new Date(tempEndDateTime);
    
    if (endTime <= startTime) {
      alert('End time must be after start time');
      return;
    }
    
    // Calculate new duration
    const newDuration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
    
    setPendingChanges(prev => ({
      ...prev,
      workout: { 
        ...prev.workout, 
        started_at: startTime.toISOString(),
        completed_at: endTime.toISOString(),
        duration_minutes: newDuration
      }
    }));
    
    setWorkout(prev => prev ? { 
      ...prev, 
      started_at: startTime.toISOString(),
      completed_at: endTime.toISOString(),
      duration_minutes: newDuration
    } : prev);
    
    setShowEditDurationDialog(false);
  };

  const handleEditIntensity = () => {
    setShowEditIntensityDialog(true);
    setShowOptionsMenu(false);
  };

  const handleSaveIntensity = () => {
    setPendingChanges(prev => ({
      ...prev,
      workout: { ...prev.workout, intensity_level: tempIntensity }
    }));
    setWorkout(prev => prev ? { ...prev, intensity_level: tempIntensity } : prev);
    setShowEditIntensityDialog(false);
  };

  const handleEditNotes = () => {
    setShowEditNotesDialog(true);
    setShowOptionsMenu(false);
  };

  const handleSaveNotes = () => {
    setPendingChanges(prev => ({
      ...prev,
      workout: { ...prev.workout, notes: tempWorkoutNotes.trim() || null }
    }));
    setWorkout(prev => prev ? { ...prev, notes: tempWorkoutNotes.trim() || null } : prev);
    setShowEditNotesDialog(false);
  };

  const handleDeleteWorkout = async () => {
    if (!workout) return;
    
    if (window.confirm('Are you sure you want to delete this workout? This action cannot be undone.')) {
      try {
        const response = await fetch(`/api/workouts/${workout.id}`, {
          method: 'DELETE',
        });
        
        if (response.ok) {
          navigate('/history', { replace: true });
        } else {
          alert('Failed to delete workout');
        }
      } catch (error) {
        console.error('Error deleting workout:', error);
        alert('Failed to delete workout');
      }
    }
    setShowOptionsMenu(false);
  };

  const handleEditSet = (set: WorkoutSet) => {
    setEditingSet(set);
    setSetWeightValue(set.weight_lbs ? formatWeight(set.weight_lbs) : '0');
    setSetRepsValue(set.reps?.toString() || '0');
    setSetNotesValue(set.notes || '');
    setShowEditSetDialog(true);
    setSetMenuOpen(null);
  };

  const handleUpdateSet = () => {
    if (!editingSet) return;
    
    const weight = parseFloat(setWeightValue) || 0;
    const reps = parseInt(setRepsValue) || 0;
    
    // Convert weight from display unit to storage unit (lbs)
    const weightInLbs = weight > 0 ? convertWeightToStorage(weight) : undefined;
    
    const updatedSetData = {
      weight_lbs: weightInLbs,
      reps: reps > 0 ? reps : undefined,
      notes: setNotesValue && setNotesValue.trim() ? setNotesValue.trim() : undefined,
    };
    
    // Add to pending changes
    setPendingChanges(prev => {
      const newSets = new Map(prev.sets);
      newSets.set(editingSet.id, {
        id: editingSet.id,
        type: 'edit',
        setData: updatedSetData,
        originalSet: editingSet
      });
      return { ...prev, sets: newSets };
    });
    
    // Update local display
    setWorkout(prev => {
      if (!prev || !prev.exercises) return prev;
      
      const updatedExercises = prev.exercises.map(exercise => ({
        ...exercise,
        sets: exercise.sets.map(set => 
          set.id === editingSet.id ? { ...set, ...updatedSetData } : set
        )
      }));
      
      return { ...prev, exercises: updatedExercises };
    });
    
    setShowEditSetDialog(false);
    setEditingSet(null);
    setSetWeightValue('0');
    setSetRepsValue('0');
    setSetNotesValue('');
  };

  const handleDeleteExercise = (exerciseId: number) => {
    if (!workout) return;
    
    if (!window.confirm('Are you sure you want to delete this exercise from this workout? This action cannot be undone.')) {
      return;
    }
    
    // Check if this is a new exercise (negative ID)
    if (exerciseId < 0) {
      // Remove from new exercises
      const tempId = Math.abs(exerciseId).toString();
      setPendingChanges(prev => {
        const newExercises = new Map(prev.newExercises);
        newExercises.delete(tempId);
        return { ...prev, newExercises };
      });
    } else {
      // Add to pending changes for existing exercise
      setPendingChanges(prev => {
        const newExercises = new Map(prev.exercises);
        newExercises.set(exerciseId, {
          id: exerciseId,
          type: 'delete'
        });
        return { ...prev, exercises: newExercises };
      });
    }
    
    setExerciseMenuOpen(null);
  };

  const handleDeleteSet = (setId: number) => {
    if (!workout) return;
    
    if (!window.confirm('Are you sure you want to delete this set? This action cannot be undone.')) {
      return;
    }
    
    // Add to pending changes
    setPendingChanges(prev => {
      const newSets = new Map(prev.sets);
      newSets.set(setId, {
        id: setId,
        type: 'delete'
      });
      return { ...prev, sets: newSets };
    });
    
    setSetMenuOpen(null);
  };

  const handleAddExercise = () => {
    if (!workout) return;
    
    setShowOptionsMenu(false);
    setExerciseSelectionMode('add');
    setReplacingExerciseId(null);
    setShowExerciseSelectionModal(true);
  };

  const handleAddSelectedExercises = async (selectedExerciseIds: number[]) => {
    if (!workout || selectedExerciseIds.length === 0) return;

    try {
      if (exerciseSelectionMode === 'replace' && replacingExerciseId) {
        // Handle exercise replacement
        if (selectedExerciseIds.length !== 1) {
          alert('Please select exactly one exercise for replacement.');
          return;
        }

        const newExerciseId = selectedExerciseIds[0];
        
        // Fetch new exercise details
        const response = await fetch(`/api/exercises/${newExerciseId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch exercise details');
        }
        const newExercise = await response.json();

        // Add to pending changes as a replacement
        setPendingChanges(prev => {
          const newExercises = new Map(prev.exercises);
          newExercises.set(replacingExerciseId, {
            id: replacingExerciseId,
            type: 'replace',
            newExerciseId: newExerciseId,
            newExerciseName: newExercise.name
          });
          return { ...prev, exercises: newExercises };
        });

        console.log(`Marked exercise ${replacingExerciseId} for replacement with ${newExercise.name}`);
      } else {
        // Handle adding new exercises (existing functionality)
        const exercisePromises = selectedExerciseIds.map(async (exerciseId) => {
          const response = await fetch(`/api/exercises/${exerciseId}`);
          if (response.ok) {
            return await response.json();
          }
          throw new Error(`Failed to fetch exercise ${exerciseId}`);
        });

        const exerciseDetails = await Promise.all(exercisePromises);

        // Add exercises to pending changes as new exercises
        const newExerciseEntries = exerciseDetails.map((exercise, index) => {
          const tempId = Date.now() + index; // Generate unique temp ID
          return [
            tempId.toString(),
            {
              exerciseId: exercise.id,
              name: exercise.name,
              category: exercise.category,
              muscle_group: exercise.muscle_group,
              equipment: exercise.equipment,
              video_url: exercise.video_url,
              tempId: tempId.toString()
            } as PendingNewExercise
          ];
        });

        setPendingChanges(prev => ({
          ...prev,
          newExercises: new Map([...prev.newExercises, ...newExerciseEntries as [string, PendingNewExercise][]])
        }));

        console.log(`Added ${selectedExerciseIds.length} exercises to pending changes`);
      }
    } catch (error) {
      console.error('Error handling selected exercises:', error);
      alert('Failed to process exercises. Please try again.');
    }
  };

  const handleReplaceExercise = (exerciseId: number) => {
    if (!workout) return;
    
    setExerciseMenuOpen(null);
    setExerciseSelectionMode('replace');
    setReplacingExerciseId(exerciseId);
    setShowExerciseSelectionModal(true);
  };

  const handleAddSet = (exerciseId: number) => {
    // Check if this is a new exercise (negative ID) that hasn't been saved yet
    if (exerciseId < 0) {
      alert('Please save all changes first before adding sets to new exercises.');
      return;
    }
    
    setAddingSetToExercise(exerciseId);
    setSetWeightValue('0');
    setSetRepsValue('0');
    setSetNotesValue('');
    setShowAddSetDialog(true);
  };

  const handleSaveNewSet = () => {
    if (!addingSetToExercise) return;
    
    const weight = parseFloat(setWeightValue) || 0;
    const reps = parseInt(setRepsValue) || 0;
    
    // Convert weight from display unit to storage unit (lbs)
    const weightInLbs = weight > 0 ? convertWeightToStorage(weight) : undefined;
    
    // Find the exercise and determine next set number
    const exercise = workout?.exercises.find(ex => ex.id === addingSetToExercise);
    if (!exercise) return;
    
    const existingSets = getDisplaySets(exercise);
    const nextSetNumber = existingSets.length > 0 ? Math.max(...existingSets.map(s => s.set_number)) + 1 : 1;
    
    const newSetData: Omit<WorkoutSet, 'id'> = {
      workout_exercise_id: addingSetToExercise,
      set_number: nextSetNumber,
      weight_lbs: weightInLbs,
      reps: reps > 0 ? reps : undefined,
      duration_seconds: undefined,
      distance_miles: undefined,
      notes: setNotesValue && setNotesValue.trim() ? setNotesValue.trim() : undefined,
      completed_at: new Date().toISOString() // Mark as completed since user is entering data
    };
    
    // Add to pending changes
    const tempId = tempSetIdCounter;
    setTempSetIdCounter(prev => prev + 1);
    
    setPendingChanges(prev => {
      const newSets = new Map(prev.newSets);
      newSets.set(`${addingSetToExercise}-${tempId}`, newSetData);
      return { ...prev, newSets };
    });
    
    setShowAddSetDialog(false);
    setAddingSetToExercise(null);
    setSetWeightValue('0');
    setSetRepsValue('0');
    setSetNotesValue('');
  };

  // Save all pending changes to database
  const handleSaveAllChanges = async () => {
    if (!workout || !hasPendingChanges()) return;
    
    setIsSaving(true);
    try {
      // Save workout changes
      if (pendingChanges.workout && Object.keys(pendingChanges.workout).length > 0) {
        const response = await fetch(`/api/workouts/${workout.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(pendingChanges.workout),
        });
        
        if (!response.ok) {
          throw new Error('Failed to update workout details');
        }
      }
      
      // Save set changes
      for (const [setId, change] of pendingChanges.sets) {
        if (change.type === 'edit') {
          const response = await fetch(`/api/workouts/sets/${setId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(change.setData),
          });
          
          if (!response.ok) {
            throw new Error(`Failed to update set ${setId}`);
          }
        } else if (change.type === 'delete') {
          const response = await fetch(`/api/workouts/sets/${setId}`, {
            method: 'DELETE',
          });
          
          if (!response.ok) {
            throw new Error(`Failed to delete set ${setId}`);
          }
        }
      }
      
      // Save new sets
      for (const [, setData] of pendingChanges.newSets) {
        const response = await fetch(`/api/workouts/exercises/${setData.workout_exercise_id}/sets`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(setData),
        });
        
        if (!response.ok) {
          throw new Error(`Failed to create new set for exercise ${setData.workout_exercise_id}`);
        }
      }
      
      // Save new exercises
      for (const [, newExercise] of pendingChanges.newExercises) {
        const response = await fetch(`/api/workouts/${workout.id}/exercises`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            exercise_id: newExercise.exerciseId,
            order_index: 0
          }),
        });
        
        if (!response.ok) {
          throw new Error(`Failed to add exercise ${newExercise.name}`);
        }
      }

      // Save exercise changes
      for (const [exerciseId, change] of pendingChanges.exercises) {
        if (change.type === 'delete') {
          const response = await fetch(`/api/workouts/exercises/${exerciseId}`, {
            method: 'DELETE',
          });
          
          if (!response.ok) {
            throw new Error(`Failed to delete exercise ${exerciseId}`);
          }
        } else if (change.type === 'replace' && change.newExerciseId) {
          const response = await fetch(`/api/workouts/exercises/${exerciseId}/replace`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ new_exercise_id: change.newExerciseId }),
          });
          
          if (!response.ok) {
            throw new Error(`Failed to replace exercise ${exerciseId}`);
          }
        }
      }
      
      // Clear pending changes and refresh data
      setPendingChanges({
        sets: new Map(),
        exercises: new Map(),
        newSets: new Map(),
        newExercises: new Map()
      });
      
      // Refresh workout data
      await fetchWorkoutSummary();
      
      alert('All changes saved successfully!');
    } catch (error) {
      console.error('Error saving changes:', error);
      alert(`Failed to save changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Discard all pending changes
  const handleDiscardChanges = () => {
    if (!window.confirm('Are you sure you want to discard all pending changes?')) {
      return;
    }
    
    setPendingChanges({
      sets: new Map(),
      exercises: new Map(),
      newSets: new Map(),
      newExercises: new Map()
    });
    
    // Reset workout to original state
    if (originalWorkout) {
      setWorkout(originalWorkout);
      setTempWorkoutName(originalWorkout.name || generateWorkoutTitle(originalWorkout.exercises || []));
      setTempIntensity(originalWorkout.intensity_level || 3);
      setTempWorkoutNotes(originalWorkout.notes || '');
    }
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}min`;
    }
    return `${mins}min`;
  };

  const formatWorkoutDateTime = (dateTimeStr: string) => {
    const date = new Date(dateTimeStr + (dateTimeStr.includes('Z') ? '' : 'Z'));
    const dateStr = date.toLocaleDateString('en-GB', { 
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    return `${dateStr} at ${timeStr}`;
  };

  const getVimeoThumbnailUrl = (videoUrl: string | null) => {
    if (!videoUrl) return null;
    
    // Extract video ID from Vimeo URL
    const match = videoUrl.match(/vimeo\.com\/(\d+)/);
    if (match && match[1]) {
      return `https://vumbnail.com/${match[1]}.jpg`;
    }
    return null;
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
      setExerciseMenuOpen(null);
      setSetMenuOpen(null);
    };
    
    if (exerciseMenuOpen !== null || setMenuOpen !== null) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [exerciseMenuOpen, setMenuOpen]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">Workout not found</p>
          <button
            onClick={() => navigate('/history')}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            Back to History
          </button>
        </div>
      </div>
    );
  }

  const stats = calculateWorkoutStats();
  const workoutTitle = workout.name || generateWorkoutTitle(workout.exercises);
  const displayExercises = getDisplayExercises();

  return (
    <div className="min-h-screen bg-gray-900 text-white max-w-md mx-auto flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700 shadow-2xl shadow-black/50 backdrop-blur-lg">
        <button
          onClick={() => navigate('/history')}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-white font-semibold text-lg">
          Workout Summary
          {shouldShowSaveBar() && <span className="text-yellow-500 text-sm ml-2">*</span>}
        </h1>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleShare}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Share className="w-6 h-6" />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowOptionsMenu(!showOptionsMenu)}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <MoreVertical className="w-6 h-6" />
            </button>
            
            {showOptionsMenu && (
              <div className="absolute right-0 top-full mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10 min-w-48">
                <div className="py-2">
                  <button
                    onClick={handleEditDuration}
                    className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-white hover:bg-gray-700 transition-colors"
                  >
                    <span>Edit Duration</span>
                  </button>
                  <button
                    onClick={handleEditIntensity}
                    className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-white hover:bg-gray-700 transition-colors"
                  >
                    <span>Edit Intensity</span>
                  </button>
                  <button
                    onClick={handleEditNotes}
                    className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-white hover:bg-gray-700 transition-colors"
                  >
                    <span>Edit Notes</span>
                  </button>
                  <button
                    onClick={handleDeleteWorkout}
                    className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-red-400 hover:bg-gray-700 transition-colors"
                  >
                    <span>Delete Workout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 pb-20">
        {/* Workout Title and Date */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-2">
            <h2 className="text-xl font-bold text-white">{workoutTitle}</h2>
            <button
              onClick={handleEditTitle}
              className="p-1 hover:bg-gray-700 rounded transition-colors"
            >
              <Edit className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          <p className="text-gray-400 text-sm">
            {formatWorkoutDateTime(workout.completed_at)}
          </p>
        </div>

        {/* Workout Stats */}
        <div className="grid grid-cols-5 gap-2 mb-6">
          <div className="bg-gray-800 rounded-lg p-3 text-center relative shadow-lg shadow-black/20">
            <div className="flex items-center justify-center mb-1">
              <Clock className="w-4 h-4 text-cyan-500 mr-1" />
            </div>
            <div className="text-xs text-gray-400">Time</div>
            <div className="text-lg font-semibold">{formatTime(stats.duration)}</div>
            <button
              onClick={handleEditDuration}
              className="absolute top-1 right-1 p-1 hover:bg-gray-700 rounded transition-colors"
            >
              <Edit className="w-3 h-3 text-gray-400" />
            </button>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-3 text-center shadow-lg shadow-black/20">
            <div className="flex items-center justify-center mb-1">
              <Activity className="w-4 h-4 text-cyan-500 mr-1" />
            </div>
            <div className="text-xs text-gray-400">Volume</div>
            <div className="text-lg font-semibold">{Math.round(stats.totalVolume)} {getWeightUnit()}</div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center mb-1">
              <Zap className="w-4 h-4 text-cyan-500 mr-1" />
            </div>
            <div className="text-xs text-gray-400">Calories</div>
            <div className="text-lg font-semibold">{stats.estimatedCalories}</div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center mb-1">
              <Target className="w-4 h-4 text-cyan-500 mr-1" />
            </div>
            <div className="text-xs text-gray-400">Reps</div>
            <div className="text-lg font-semibold">{stats.totalReps}</div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center mb-1">
              <Target className="w-4 h-4 text-cyan-500 mr-1" />
            </div>
            <div className="text-xs text-gray-400">Sets</div>
            <div className="text-lg font-semibold">{stats.totalSets}</div>
          </div>
        </div>

        {/* Intensity Level */}
        <div className="mb-6">
          <div className="bg-gray-800 rounded-lg p-4 shadow-lg shadow-black/20">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-300">
                Intensity Level:
              </h3>
              <button
                onClick={handleEditIntensity}
                className="p-1 hover:bg-gray-700 rounded transition-colors"
              >
                <Edit className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            {workout.intensity_level ? (
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">
                    {intensityLevels.find(l => l.value === workout.intensity_level)?.emoji}
                  </span>
                  <div>
                    <div className="text-lg font-bold text-white">{workout.intensity_level}</div>
                    <div className="text-sm text-gray-400">
                      {intensityLevels.find(l => l.value === workout.intensity_level)?.label}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-gray-400">No intensity level set</div>
            )}
          </div>
        </div>

        {/* Workout Notes */}
        <div className="mb-6">
          <div className="bg-gray-800 rounded-lg p-4 shadow-lg shadow-black/20">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-300">
                Workout Notes:
              </h3>
              <button
                onClick={handleEditNotes}
                className="p-1 hover:bg-gray-700 rounded transition-colors"
              >
                <Edit className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            {workout.notes ? (
              <p className="text-white">{workout.notes}</p>
            ) : (
              <p className="text-gray-400">No notes added</p>
            )}
          </div>
        </div>

        {/* Exercises Summary */}
        <div className="space-y-4 mb-6">
          <h3 className="text-lg font-semibold text-white">Exercises</h3>
          
          {displayExercises.length > 0 ? displayExercises.map((exercise) => {
            const displaySets = getDisplaySets(exercise);
            const completedSets = displaySets.filter(set => !!set.completed_at);
            const totalVolumeInLbs = completedSets.reduce((sum, set) => {
              return sum + (set.weight_lbs && set.reps ? set.weight_lbs * set.reps : 0);
            }, 0);
            const totalVolume = convertWeightFromStorage(totalVolumeInLbs);
            const totalReps = completedSets.reduce((sum, set) => sum + (set.reps || 0), 0);
            
            // Check if this exercise has pending changes
            const hasExerciseChanges = pendingChanges.exercises.has(exercise.id);
            const hasSetChanges = displaySets.some(set => 
              set.id < 0 || // New set
              pendingChanges.sets.has(set.id)
            );
            const isNewExercise = exercise.id < 0; // Negative ID indicates new exercise
            
            return (
              <div key={exercise.id} className={`bg-gray-800 rounded-lg p-4 ${hasExerciseChanges || hasSetChanges || isNewExercise ? 'ring-2 ring-yellow-500' : ''}`}>
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-700 flex items-center justify-center flex-shrink-0">
                    {exercise.video_url && getVimeoThumbnailUrl(exercise.video_url) ? (
                      <img
                        src={getVimeoThumbnailUrl(exercise.video_url)!}
                        alt={`${exercise.name} thumbnail`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback to muscle group SVG if thumbnail fails to load
                          const target = e.target as HTMLImageElement;
                          target.src = getMuscleGroupIcon(exercise.muscle_group);
                          target.onload = null;
                          target.onerror = null;
                        }}
                      />
                    ) : (
                      <img
                        src={getMuscleGroupIcon(exercise.muscle_group)}
                        alt={`${exercise.muscle_group} icon`}
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <h4 className="font-semibold text-white">
                      {exercise.name}
                      {hasExerciseChanges && <span className="text-yellow-500 text-xs ml-2">(Modified)</span>}
                      {isNewExercise && <span className="text-green-500 text-xs ml-2">(New)</span>}
                    </h4>
                    <div className="flex items-center space-x-2 text-sm text-gray-400">
                      <span className="bg-blue-600 text-white px-2 py-1 rounded text-xs">
                        {exercise.category}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-right text-sm">
                    <div className="text-cyan-500 font-semibold">{Math.round(totalVolume)} {getWeightUnit()}</div>
                    <div className="text-gray-400">{totalReps} Reps</div>
                  </div>

                  {/* Exercise Options Menu */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExerciseMenuOpen(exerciseMenuOpen === exercise.id ? null : exercise.id);
                      }}
                      className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <MoreVertical className="w-5 h-5 text-gray-400" />
                    </button>
                    
                    {exerciseMenuOpen === exercise.id && (
                      <div className="absolute right-0 top-full mt-1 bg-gray-900 border border-gray-600 rounded-lg shadow-lg z-10 min-w-48">
                        <div className="py-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddSet(exercise.id);
                            }}
                            disabled={exercise.id < 0}
                            className={`w-full flex items-center space-x-2 px-3 py-2 text-sm transition-colors ${
                              exercise.id < 0 
                                ? 'text-gray-500 cursor-not-allowed' 
                                : 'text-white hover:bg-gray-800'
                            }`}
                          >
                            <Plus className="w-4 h-4" />
                            <span>Add Set</span>
                            {exercise.id < 0 && <span className="text-xs">(Save first)</span>}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReplaceExercise(exercise.id);
                            }}
                            className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-white hover:bg-gray-800 transition-colors"
                          >
                            <RefreshCw className="w-4 h-4" />
                            <span>Replace Exercise</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteExercise(exercise.id);
                            }}
                            className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-red-400 hover:bg-gray-800 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Delete Exercise</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Sets Display */}
                <div className="space-y-2">
                  {displaySets.map((set) => {
                    const isNewSet = set.id < 0;
                    const isPendingEdit = pendingChanges.sets.has(set.id) && pendingChanges.sets.get(set.id)?.type === 'edit';
                    const isPendingDelete = pendingChanges.sets.has(set.id) && pendingChanges.sets.get(set.id)?.type === 'delete';
                    
                    return (
                      <div key={set.id} className={`flex items-center space-x-3 ${isPendingDelete ? 'opacity-50' : ''} ${isNewSet || isPendingEdit ? 'bg-yellow-500/10 rounded p-2' : ''}`}>
                        <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                          {set.set_number}
                        </div>
                        <div className="flex-1 text-sm text-white">
                          <span>
                            {set.weight_lbs ? formatWeightWithUnit(set.weight_lbs) : '0'} × {set.reps || 0} Reps
                          </span>
                          {set.notes && (
                            <div className="text-xs text-gray-400 mt-1">{set.notes}</div>
                          )}
                          {isNewSet && <span className="text-yellow-500 text-xs ml-2">(New)</span>}
                          {isPendingEdit && <span className="text-yellow-500 text-xs ml-2">(Modified)</span>}
                          {isPendingDelete && <span className="text-red-500 text-xs ml-2">(Deleted)</span>}
                        </div>
                        
                        {/* Set Options Menu */}
                        {!isPendingDelete && (
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const setKey = `${exercise.id}-${set.id}`;
                                setSetMenuOpen(setMenuOpen === setKey ? null : setKey);
                              }}
                              className="p-1 hover:bg-gray-700 rounded transition-colors"
                            >
                              <MoreVertical className="w-4 h-4 text-gray-400" />
                            </button>
                            
                            {setMenuOpen === `${exercise.id}-${set.id}` && (
                              <div className="absolute right-0 top-full mt-1 bg-gray-900 border border-gray-600 rounded-lg shadow-lg z-10 min-w-32">
                                <div className="py-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditSet(set);
                                    }}
                                    className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-white hover:bg-gray-800 transition-colors"
                                  >
                                    <Edit className="w-4 h-4" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteSet(set.id);
                                    }}
                                    className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-red-400 hover:bg-gray-800 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    <span>Delete</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }) : (
            <div className="text-center text-gray-400 py-8">
              <p>No exercises found in this workout</p>
            </div>
          )}
        </div>

        {/* Add Exercise Button - Below exercises list */}
        <div className="mb-6">
          <button
            onClick={handleAddExercise}
            className="w-full bg-gray-800 hover:bg-gray-700 rounded-lg p-4 flex items-center justify-center space-x-2 border-2 border-dashed border-gray-600 transition-all duration-300 shadow-lg hover:shadow-xl shadow-black/20"
          >
            <Plus className="w-5 h-5 text-gray-400" />
            <span className="text-gray-400 font-medium">ADD EXERCISE</span>
          </button>
        </div>

        {/* Exercise Selection Modal */}
        <ExerciseSelectionModal
          isOpen={showExerciseSelectionModal}
          onClose={() => {
            setShowExerciseSelectionModal(false);
            setExerciseSelectionMode('add');
            setReplacingExerciseId(null);
          }}
          onAddExercises={handleAddSelectedExercises}
          mode={exerciseSelectionMode}
        />
      </div>

      {/* Fixed Save/Discard Bar */}
      {shouldShowSaveBar() && (
        <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-gray-800 border-t border-gray-700 p-4 shadow-2xl shadow-black/50 backdrop-blur-lg">
          <div className="flex space-x-3">
            <button
              onClick={handleDiscardChanges}
              className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium flex items-center justify-center"
            >
              <X className="w-4 h-4 mr-2" />
              Discard Changes
            </button>
            <button
              onClick={handleSaveAllChanges}
              disabled={isSaving}
              className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors flex items-center justify-center"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save All Changes
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Edit Title Dialog */}
      {showEditTitleDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">Edit Workout Title</h3>
            
            <div className="space-y-4">
              <input
                type="text"
                value={tempWorkoutName}
                onChange={(e) => setTempWorkoutName(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg py-3 px-4 text-white focus:outline-none focus:border-cyan-500"
                placeholder="Enter workout name"
              />
              
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setTempWorkoutName(workout?.name || generateWorkoutTitle(workout?.exercises || []));
                    setShowEditTitleDialog(false);
                  }}
                  className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTitle}
                  className="flex-1 px-4 py-3 bg-cyan-500 hover:bg-cyan-600 text-black rounded-lg font-semibold transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Duration Dialog */}
      {showEditDurationDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">Edit Workout Duration</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Workout Start Time
                </label>
                <input
                  type="datetime-local"
                  value={tempStartDateTime}
                  onChange={(e) => setTempStartDateTime(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg py-3 px-4 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Workout End Time
                </label>
                <input
                  type="datetime-local"
                  value={tempEndDateTime}
                  onChange={(e) => setTempEndDateTime(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg py-3 px-4 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              
              {tempStartDateTime && tempEndDateTime && (
                <div className="bg-gray-700 rounded-lg p-3">
                  <div className="text-sm text-gray-300">
                    Duration: {Math.round((new Date(tempEndDateTime).getTime() - new Date(tempStartDateTime).getTime()) / (1000 * 60))} minutes
                  </div>
                </div>
              )}
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowEditDurationDialog(false)}
                  className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveDuration}
                  className="flex-1 px-4 py-3 bg-cyan-500 hover:bg-cyan-600 text-black rounded-lg font-semibold transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Intensity Dialog */}
      {showEditIntensityDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">Edit Intensity Level</h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                {intensityLevels.map((level) => (
                  <button
                    key={level.value}
                    onClick={() => setTempIntensity(level.value)}
                    className={`flex flex-col items-center p-3 rounded-lg transition-all ${
                      tempIntensity === level.value
                        ? 'bg-cyan-500 text-black scale-110'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    <div className="text-2xl mb-1">{level.emoji}</div>
                    <div className="text-lg font-bold">{level.value}</div>
                    {tempIntensity === level.value && (
                      <div className="text-xs mt-1">{level.label}</div>
                    )}
                  </button>
                ))}
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setTempIntensity(workout?.intensity_level || 3);
                    setShowEditIntensityDialog(false);
                  }}
                  className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveIntensity}
                  className="flex-1 px-4 py-3 bg-cyan-500 hover:bg-cyan-600 text-black rounded-lg font-semibold transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Set Dialog */}
      {showEditSetDialog && editingSet && (
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
                    value={setWeightValue}
                    onChange={(e) => setSetWeightValue(e.target.value)}
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
                    value={setRepsValue}
                    onChange={(e) => setSetRepsValue(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg py-3 px-4 text-white text-center text-lg font-mono focus:outline-none focus:border-cyan-500"
                    step="1"
                    min="0"
                    placeholder="0"
                  />
                </div>
              </div>
              
              {/* Notes Field */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">Notes</label>
                <input
                  type="text"
                  value={setNotesValue}
                  onChange={(e) => setSetNotesValue(e.target.value)}
                  placeholder="Add notes for this set..."
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg py-3 px-4 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500"
                />
              </div>
              
              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowEditSetDialog(false);
                    setEditingSet(null);
                    setSetWeightValue('0');
                    setSetRepsValue('0');
                    setSetNotesValue('');
                  }}
                  className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateSet}
                  className="flex-1 px-4 py-3 bg-cyan-500 hover:bg-cyan-600 text-black rounded-lg font-semibold transition-colors"
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Set Dialog */}
      {showAddSetDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">Add New Set</h3>
            
            <div className="space-y-4">
              {/* Weight and Reps */}
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">Weight ({getWeightUnit()})</label>
                  <input
                    type="number"
                    value={setWeightValue}
                    onChange={(e) => setSetWeightValue(e.target.value)}
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
                    value={setRepsValue}
                    onChange={(e) => setSetRepsValue(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg py-3 px-4 text-white text-center text-lg font-mono focus:outline-none focus:border-cyan-500"
                    step="1"
                    min="0"
                    placeholder="0"
                  />
                </div>
              </div>
              
              {/* Notes Field */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">Notes</label>
                <input
                  type="text"
                  value={setNotesValue}
                  onChange={(e) => setSetNotesValue(e.target.value)}
                  placeholder="Add notes for this set..."
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg py-3 px-4 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500"
                />
              </div>
              
              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowAddSetDialog(false);
                    setAddingSetToExercise(null);
                    setSetWeightValue('0');
                    setSetRepsValue('0');
                    setSetNotesValue('');
                  }}
                  className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNewSet}
                  className="flex-1 px-4 py-3 bg-cyan-500 hover:bg-cyan-600 text-black rounded-lg font-semibold transition-colors"
                >
                  Add Set
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Notes Dialog */}
      {showEditNotesDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">Edit Workout Notes</h3>
            
            <div className="space-y-4">
              <textarea
                value={tempWorkoutNotes}
                onChange={(e) => setTempWorkoutNotes(e.target.value)}
                placeholder="Add workout notes..."
                className="w-full bg-gray-900 border border-gray-600 rounded-lg py-3 px-4 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500 resize-none"
                rows={4}
              />
              
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setTempWorkoutNotes(workout?.notes || '');
                    setShowEditNotesDialog(false);
                  }}
                  className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNotes}
                  className="flex-1 px-4 py-3 bg-cyan-500 hover:bg-cyan-600 text-black rounded-lg font-semibold transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
