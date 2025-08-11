import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, Share, MoreVertical, Clock, Activity, Target, Zap, Edit } from 'lucide-react';
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

interface WorkoutSummary {
  id: number;
  name?: string;
  notes?: string;
  started_at: string;
  completed_at: string;
  duration_minutes: number;
  exercises: WorkoutExercise[];
}

const intensityLevels = [
  { value: 1, emoji: '😴', label: 'Very Easy', met: 2 },
  { value: 2, emoji: '😊', label: 'Easy', met: 3 },
  { value: 3, emoji: '😐', label: 'Moderate', met: 5 },
  { value: 4, emoji: '😤', label: 'Hard', met: 7 },
  { value: 5, emoji: '🥵', label: 'Very Hard', met: 9 }
];

export default function ActiveSummary() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const workoutId = searchParams.get('workoutId');
  const { formatWeightWithUnit, convertWeightFromStorage, getWeightUnit } = useSettings();
  
  const [workout, setWorkout] = useState<WorkoutSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIntensity, setSelectedIntensity] = useState<number>(3); // Default to moderate
  const [workoutComment, setWorkoutComment] = useState<string>('');
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showEditTitleDialog, setShowEditTitleDialog] = useState(false);
  const [tempWorkoutName, setTempWorkoutName] = useState<string>('');
  const [showEditDurationDialog, setShowEditDurationDialog] = useState(false);
  const [tempStartDateTime, setTempStartDateTime] = useState<string>('');
  const [tempEndDateTime, setTempEndDateTime] = useState<string>('');

  useEffect(() => {
    if (workoutId) {
      fetchWorkoutSummary();
    }
  }, [workoutId]);

  const fetchWorkoutSummary = async () => {
    try {
      const response = await fetch(`/api/workouts/${workoutId}`);
      if (response.ok) {
        const data = await response.json();
        setWorkout(data);
        setTempWorkoutName(data.name || generateWorkoutTitle(data.exercises));
      } else {
        console.error('Failed to fetch workout summary');
        navigate('/');
      }
    } catch (error) {
      console.error('Error fetching workout summary:', error);
      navigate('/');
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
    if (!workout) return { totalVolume: 0, totalReps: 0, totalSets: 0, estimatedCalories: 0, duration: 0 };
    
    let totalVolumeInLbs = 0; // Calculate in lbs first
    let totalReps = 0;
    let totalSets = 0;
    
    workout.exercises.forEach(exercise => {
      const completedSets = exercise.sets.filter(set => set.completed_at);
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
    
    // Calculate actual duration if we have both start and end times
    let duration = 0;
    if (workout.started_at) {
      const startTime = new Date(workout.started_at + (workout.started_at.includes('Z') ? '' : 'Z'));
      const endTime = workout.completed_at ? new Date(workout.completed_at + (workout.completed_at.includes('Z') ? '' : 'Z')) : new Date();
      duration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60)); // in minutes
    }
    
    // Estimate calories based on intensity, duration, and a base metabolic equivalent
    const selectedLevel = intensityLevels.find(level => level.value === selectedIntensity);
    const metValue = selectedLevel?.met || 5;
    const estimatedCalories = Math.round((metValue * 70 * duration) / 60); // Assuming 70kg average weight
    
    return { totalVolume, totalReps, totalSets, estimatedCalories, duration };
  };

  const handleSaveWorkout = async () => {
    if (!workout || isSaving) return;
    
    setIsSaving(true);
    try {
      // First update workout with final details
      const updateData = {
        name: tempWorkoutName,
        notes: workoutComment.trim() || null,
        intensity_level: selectedIntensity
      };
      
      const updateResponse = await fetch(`/api/workouts/${workout.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });
      
      if (!updateResponse.ok) {
        throw new Error('Failed to update workout details');
      }
      
      // Then complete the workout
      const completeResponse = await fetch(`/api/workouts/${workout.id}/complete`, {
        method: 'PATCH',
      });
      
      if (!completeResponse.ok) {
        throw new Error('Failed to complete workout');
      }
      
      // Navigate to main workout page (home)
      navigate('/', { replace: true, state: { refresh: true } });
    } catch (error) {
      console.error('Error saving workout:', error);
      alert('Failed to save workout. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = async () => {
    if (!workout) return;
    
    const stats = calculateWorkoutStats();
    const muscleGroups = [...new Set(workout.exercises.map(ex => ex.muscle_group))].join(', ');
    const weightUnit = getWeightUnit();
    
    // Create detailed exercise breakdown
    const exerciseDetails = workout.exercises.map(ex => {
      const completedSets = ex.sets.filter(set => set.completed_at);
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
    
    const shareText = `💪 Just completed my ${tempWorkoutName}!

📋 WORKOUT SUMMARY:
🎯 Muscles Trained: ${muscleGroups}
⏱️ Duration: ${formatTime(stats.duration)}
🏋️ Total Volume: ${Math.round(stats.totalVolume)} ${weightUnit}
📊 ${stats.totalSets} sets, ${stats.totalReps} reps
🔥 ${stats.estimatedCalories} calories burned
⚡ Intensity: ${intensityLevels.find(l => l.value === selectedIntensity)?.emoji} ${intensityLevels.find(l => l.value === selectedIntensity)?.label}

📈 EXERCISES & SETS:${exerciseDetails}

${workoutComment ? `💭 Notes: ${workoutComment}` : ''}

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
    setShowEditTitleDialog(false);
  };

  const handleEditDuration = () => {
    if (!workout) return;
    
    // Initialize with current workout times
    const startTime = new Date(workout.started_at + (workout.started_at.includes('Z') ? '' : 'Z'));
    const endTime = workout.completed_at ? new Date(workout.completed_at + (workout.completed_at.includes('Z') ? '' : 'Z')) : new Date();
    
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

  const handleSaveDuration = async () => {
    if (!workout || !tempStartDateTime || !tempEndDateTime) return;
    
    try {
      const startTime = new Date(tempStartDateTime);
      const endTime = new Date(tempEndDateTime);
      
      if (endTime <= startTime) {
        alert('End time must be after start time');
        return;
      }
      
      // Calculate new duration
      const newDuration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
      
      // Update workout with new times
      const response = await fetch(`/api/workouts/${workout.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          started_at: startTime.toISOString(),
          completed_at: endTime.toISOString(),
          duration_minutes: newDuration
        }),
      });
      
      if (response.ok) {
        // Preserve the current edited title before refreshing
        const currentTitle = tempWorkoutName;
        // Refresh workout data
        await fetchWorkoutSummary();
        // Restore the edited title
        setTempWorkoutName(currentTitle);
        setShowEditDurationDialog(false);
      } else {
        alert('Failed to update workout duration');
      }
    } catch (error) {
      console.error('Error updating duration:', error);
      alert('Failed to update workout duration');
    }
  };

  const handleDiscardWorkout = async () => {
    if (!workout) return;
    
    if (window.confirm('Are you sure you want to discard this workout? This action cannot be undone.')) {
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
    }
    setShowOptionsMenu(false);
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}min`;
    }
    return `${mins}min`;
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
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const stats = calculateWorkoutStats();

  return (
    <div className="min-h-screen bg-gray-900 text-white max-w-md mx-auto flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700 shadow-2xl shadow-black/50 backdrop-blur-lg">
        <button
          onClick={() => navigate('/workout/start')}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center space-x-2">
          <h1 className="text-white font-semibold text-lg">
            {tempWorkoutName}
          </h1>
          <button
            onClick={handleEditTitle}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
          >
            <Edit className="w-4 h-4 text-gray-400" />
          </button>
        </div>
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
                    onClick={handleDiscardWorkout}
                    className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-red-400 hover:bg-gray-700 transition-colors"
                  >
                    <span>Discard Workout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 pb-32">
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

        {/* Workout Comment */}
        <div className="mb-6">
          <div className="bg-gray-800 rounded-lg p-4 shadow-lg shadow-black/20">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Comment about this workout:
            </label>
            <textarea
              value={workoutComment}
              onChange={(e) => setWorkoutComment(e.target.value)}
              placeholder="Its very easy for the day"
              className="w-full bg-gray-900 border border-gray-600 rounded-lg py-3 px-4 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500 resize-none"
              rows={3}
            />
          </div>
        </div>

        {/* Intensity Selection */}
        <div className="mb-6">
          <div className="bg-gray-800 rounded-lg p-4 shadow-lg shadow-black/20">
            <h3 className="text-sm font-medium text-gray-300 mb-3">
              Select Intensity level (MET Level):
            </h3>
            <div className="flex justify-between items-center">
              {intensityLevels.map((level) => (
                <button
                  key={level.value}
                  onClick={() => setSelectedIntensity(level.value)}
                  className={`flex flex-col items-center p-3 rounded-lg transition-all ${
                    selectedIntensity === level.value
                      ? 'bg-cyan-500 text-black scale-110'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  <div className="text-2xl mb-1">{level.emoji}</div>
                  <div className="text-lg font-bold">{level.value}</div>
                  {selectedIntensity === level.value && (
                    <div className="text-xs mt-1">{level.label}</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Exercises Summary */}
        <div className="space-y-4 mb-6">
          <h3 className="text-lg font-semibold text-white">Workout</h3>
          
          {workout.exercises.map((exercise) => {
            const completedSets = exercise.sets.filter(set => set.completed_at);
            const totalVolumeInLbs = completedSets.reduce((sum, set) => {
              return sum + (set.weight_lbs && set.reps ? set.weight_lbs * set.reps : 0);
            }, 0);
            const totalVolume = convertWeightFromStorage(totalVolumeInLbs);
            const totalReps = completedSets.reduce((sum, set) => sum + (set.reps || 0), 0);
            
            return (
              <div key={exercise.id} className="bg-gray-800 rounded-lg p-4">
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
                    <h4 className="font-semibold text-white">{exercise.name}</h4>
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
                </div>
                
                {/* Sets Display */}
                <div className="space-y-2">
                  {completedSets.map((set) => (
                    <div key={set.id} className="flex items-center space-x-3">
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
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

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
                  onClick={() => {
                    setShowEditDurationDialog(false);
                  }}
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

      {/* Bottom Save Button */}
      <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-md bg-gray-900 border-t border-gray-700 p-4 shadow-2xl shadow-black/50 backdrop-blur-lg">
        <button
          onClick={handleSaveWorkout}
          disabled={isSaving}
          className="w-full bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-black py-4 rounded-lg font-bold text-lg transition-colors"
        >
          {isSaving ? 'SAVING...' : 'SAVE WORKOUT'}
        </button>
      </div>
    </div>
  );
}
