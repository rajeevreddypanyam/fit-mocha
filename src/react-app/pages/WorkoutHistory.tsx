import { useState, useEffect } from 'react';
import { Calendar, Clock } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useSettings } from '@/react-app/hooks/useSettings';

interface WorkoutSession {
  id: number;
  name: string;
  duration_minutes: number;
  completed_at: string;
  exercise_count: number;
  muscle_groups: string[];
  notes?: string;
  intensity_level?: number;
}

interface GroupedWorkouts {
  [monthKey: string]: {
    month: string;
    year: string;
    workouts: WorkoutSession[];
  };
}

export default function WorkoutHistory() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkoutHistory();
  }, []);

  const fetchWorkoutHistory = async () => {
    try {
      const response = await fetch('/api/workouts/history');
      const data = await response.json();
      setWorkouts(data);
    } catch (error) {
      console.error('Failed to fetch workout history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDayAndDate = (dateString: string) => {
    // Handle different SQLite timestamp formats consistently
    let completedAtStr = dateString;
    let date: Date;
    
    if (completedAtStr.includes('T') && completedAtStr.endsWith('Z')) {
      // Already in ISO format with timezone (e.g., "2025-08-08T21:48:00.000Z")
      date = new Date(completedAtStr);
    } else if (completedAtStr.includes('T') && !completedAtStr.endsWith('Z') && !completedAtStr.includes('+')) {
      // ISO format without timezone - assume UTC
      date = new Date(completedAtStr + 'Z');
    } else {
      // SQLite format without T or timezone (e.g., "2024-11-15 14:30:00")
      // Replace space with T and add Z to make it proper ISO format
      const isoString = completedAtStr.replace(' ', 'T') + 'Z';
      date = new Date(isoString);
    }
    
    // Ensure we have a valid date
    if (isNaN(date.getTime())) {
      console.error('Invalid date format:', dateString, 'parsed as:', date);
      // Fallback to current date
      date = new Date();
    }
    
    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dayOfMonth = date.getDate();
    return { dayOfWeek, dayOfMonth };
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const groupWorkoutsByMonth = (workouts: WorkoutSession[]): GroupedWorkouts => {
    return workouts.reduce((groups: GroupedWorkouts, workout) => {
      // Handle different SQLite timestamp formats consistently
      let completedAtStr = workout.completed_at;
      let date: Date;
      
      if (completedAtStr.includes('T') && completedAtStr.endsWith('Z')) {
        // Already in ISO format with timezone
        date = new Date(completedAtStr);
      } else if (completedAtStr.includes('T') && !completedAtStr.endsWith('Z') && !completedAtStr.includes('+')) {
        // ISO format without timezone - assume UTC
        date = new Date(completedAtStr + 'Z');
      } else {
        // SQLite format without T or timezone
        const isoString = completedAtStr.replace(' ', 'T') + 'Z';
        date = new Date(isoString);
      }
      
      // Ensure we have a valid date
      if (isNaN(date.getTime())) {
        console.error('Invalid date format:', workout.completed_at, 'parsed as:', date);
        date = new Date(); // Fallback to current date
      }
      
      const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!groups[monthYear]) {
        groups[monthYear] = {
          month: date.toLocaleDateString('en-US', { month: 'long' }),
          year: date.getFullYear().toString(),
          workouts: []
        };
      }
      
      groups[monthYear].workouts.push(workout);
      return groups;
    }, {});
  };

  const generateWorkoutTitle = (workout: WorkoutSession) => {
    if (workout.name && workout.name.trim()) {
      return workout.name;
    }
    
    // Generate title based on muscle groups
    const uniqueMuscles = [...new Set(workout.muscle_groups)];
    if (uniqueMuscles.length === 0) {
      return 'Quick Workout';
    } else if (uniqueMuscles.length === 1) {
      return `${uniqueMuscles[0]} Workout`;
    } else if (uniqueMuscles.length === 2) {
      return `${uniqueMuscles[0]} & ${uniqueMuscles[1]}`;
    } else {
      return `${uniqueMuscles[0]}, ${uniqueMuscles[1]} & More`;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (workouts.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
          <Calendar className="w-16 h-16 mb-4 opacity-50" />
          <p className="text-lg mb-2">No workouts yet</p>
          <p className="text-sm text-center">Start your first workout to see your progress here</p>
          <button
            onClick={() => navigate('/workout/start')}
            className="mt-6 bg-cyan-500 hover:bg-cyan-600 text-black font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Start First Workout
          </button>
        </div>
      </div>
    );
  }

  const groupedWorkouts = groupWorkoutsByMonth(workouts);
  const sortedMonthKeys = Object.keys(groupedWorkouts).sort().reverse();

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="px-2">
          {sortedMonthKeys.map((monthKey) => {
            const group = groupedWorkouts[monthKey];
            const workoutCount = group.workouts.length;
            
            return (
              <div key={monthKey} className="mb-6">
                {/* Sticky Month Header */}
                <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-700 flex items-center justify-between py-2 mb-3 -mx-2 px-2">
                  <h2 className="text-lg font-semibold text-white">
                    {group.month} {group.year}
                  </h2>
                  <span className="text-sm text-gray-400">
                    {workoutCount} workout{workoutCount !== 1 ? 's' : ''}
                  </span>
                </div>
                
                {/* Workouts for this month */}
                <div className="space-y-2">
                  {group.workouts.map((workout) => {
                    const { dayOfWeek, dayOfMonth } = formatDayAndDate(workout.completed_at);
                    const workoutTitle = generateWorkoutTitle(workout);
                    
                    return (
                      <div
                        key={workout.id}
                        className="flex items-center space-x-2 cursor-pointer"
                        onClick={() => navigate(`/workouts/${workout.id}`)}
                      >
                        {/* Date Display */}
                        <div className="flex flex-col items-center justify-center w-10 text-white flex-shrink-0">
                          <span className="text-xs font-medium text-gray-300">{dayOfWeek}</span>
                          <span className="text-base font-bold">{dayOfMonth}</span>
                        </div>
                        
                        {/* Workout Card */}
                        <div className="flex-1 min-w-0 bg-gray-800/60 backdrop-blur-sm border border-gray-700/50 rounded-lg p-2 hover:bg-gray-800/80 hover:border-gray-600/60 transition-all duration-200 shadow-lg hover:shadow-xl shadow-black/20">
                          {/* Workout Title */}
                          <h3 className="font-medium text-white text-base mb-2 leading-tight truncate">
                            {workoutTitle}
                          </h3>
                          
                          {/* Muscle Groups */}
                          {workout.muscle_groups && workout.muscle_groups.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {workout.muscle_groups.slice(0, 3).map((muscleGroup, index) => (
                                <span
                                  key={index}
                                  className="text-xs font-medium text-gray-300 bg-gray-700/60 px-2 py-1 rounded-full border border-gray-600/40 whitespace-nowrap"
                                >
                                  {muscleGroup}
                                </span>
                              ))}
                              {workout.muscle_groups.length > 3 && (
                                <span className="text-xs font-medium text-gray-400 bg-gray-700/40 px-2 py-1 rounded-full border border-gray-600/30 whitespace-nowrap">
                                  +{workout.muscle_groups.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                          
                          {/* Workout Stats */}
                          <div className="flex items-center text-sm text-gray-400">
                            {workout.duration_minutes && (
                              <>
                                <div className="flex items-center space-x-1">
                                  <Clock className="w-3 h-3 text-gray-500 flex-shrink-0" />
                                  <span className="font-medium whitespace-nowrap">{formatDuration(workout.duration_minutes)}</span>
                                </div>
                                <div className="w-1 h-1 bg-gray-600 rounded-full mx-2 flex-shrink-0"></div>
                              </>
                            )}
                            <span className="font-medium whitespace-nowrap">
                              {workout.exercise_count} exercise{workout.exercise_count !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
