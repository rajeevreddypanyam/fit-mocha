import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Play, Edit, Trash2, MoreVertical } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useSettings } from '@/react-app/hooks/useSettings';

interface Exercise {
  id: number;
  name: string;
  category: string;
  muscle_group: string;
  equipment: string;
  instructions: string;
  is_custom: boolean;
  video_url: string | null;
  created_at: string;
}

interface WorkoutHistoryItem {
  workout_id: number;
  date: string;
  time: string;
  daysAgo: number;
  completed_at: string;
  workout_name?: string;
  workout_notes?: string;
  sets: {
    set_number: number;
    weight_lbs: number | null;
    reps: number | null;
    duration_seconds: number | null;
    distance_miles: number | null;
    notes?: string;
    workout_exercise_id: number;
  }[];
}

interface StatData {
  date: string;
  reps: number;
  volume: number;
}



type TabType = 'about' | 'history' | 'statistics';
type StatsPeriod = 'all' | '1month' | '3months' | '6months' | '1year';

export default function ExerciseDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { formatWeightWithUnit, convertWeightFromStorage, getWeightUnit, settings } = useSettings();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('about');
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>('3months');
  const [loading, setLoading] = useState(true);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // New state for processed stats data and PRs
  const [processedStatsData, setProcessedStatsData] = useState<StatData[]>([]);
  const [personalRecords, setPersonalRecords] = useState({
    heaviestWeight: { value: 0, date: '' },
    best1RM: { value: 0, date: '' },
    bestSetVolume: { value: 0, date: '' },
    bestSessionVolume: { value: 0, date: '' },
  });

  useEffect(() => {
    if (id) {
      fetchExercise(parseInt(id));
    }
  }, [id]);

  useEffect(() => {
    if (id && (activeTab === 'history' || activeTab === 'statistics')) {
      fetchExerciseHistory(parseInt(id));
    }
  }, [id, activeTab]);

  // Process data when history, period, or units change
  useEffect(() => {
    if (workoutHistory.length > 0) {
      processAndCalculateStats(workoutHistory, statsPeriod);
    } else {
      // Reset if no history
      setProcessedStatsData([]);
      setPersonalRecords({
        heaviestWeight: { value: 0, date: '' },
        best1RM: { value: 0, date: '' },
        bestSetVolume: { value: 0, date: '' },
        bestSessionVolume: { value: 0, date: '' },
      });
    }
  }, [workoutHistory, statsPeriod, settings.units]);

  const fetchExercise = async (exerciseId: number) => {
    try {
      const response = await fetch(`/api/exercises/${exerciseId}`);
      if (response.ok) {
        const data = await response.json();
        setExercise(data);
      }
    } catch (error) {
      console.error('Failed to fetch exercise:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExerciseHistory = async (exerciseId: number) => {
    setHistoryLoading(true);
    try {
      const response = await fetch(`/api/exercises/${exerciseId}/history`);
      if (response.ok) {
        const data = await response.json();
        setWorkoutHistory(data);
      } else {
        console.error('Failed to fetch exercise history');
        setWorkoutHistory([]);
      }
    } catch (error) {
      console.error('Failed to fetch exercise history:', error);
      setWorkoutHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDeleteExercise = async () => {
    if (!exercise || !window.confirm('Are you sure you want to delete this exercise?')) {
      return;
    }

    try {
      const response = await fetch(`/api/exercises/${exercise.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        navigate('/exercises');
      } else {
        alert('Failed to delete exercise. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting exercise:', error);
      alert('Failed to delete exercise. Please try again.');
    }
  };

  const processAndCalculateStats = (history: WorkoutHistoryItem[], period: StatsPeriod) => {
    const now = new Date();
    let filteredHistory = history;

    // Filter history based on selected period for charts
    if (period !== 'all') {
      let cutoffDate = new Date();
      if (period === '1month') cutoffDate.setMonth(now.getMonth() - 1);
      else if (period === '3months') cutoffDate.setMonth(now.getMonth() - 3);
      else if (period === '6months') cutoffDate.setMonth(now.getMonth() - 6);
      else if (period === '1year') cutoffDate.setFullYear(now.getFullYear() - 1);

      filteredHistory = history.filter(item => {
        let completedAtStr = item.completed_at;
        if (!completedAtStr.endsWith('Z') && !completedAtStr.includes('+')) {
          completedAtStr += 'Z';
        }
        const itemDate = new Date(completedAtStr);
        return itemDate >= cutoffDate;
      });
    }

    // Calculate Stats Data for Charts (from filtered history)
    const chartData: StatData[] = [];

    filteredHistory.forEach(workout => {
      let totalWorkoutVolume = 0; // Calculated in lbs first
      let totalWorkoutReps = 0;

      workout.sets.forEach(set => {
        if (set.weight_lbs && set.reps) {
          totalWorkoutVolume += set.weight_lbs * set.reps;
        }
        if (set.reps) {
          totalWorkoutReps += set.reps;
        }
      });

      if (totalWorkoutVolume > 0 || totalWorkoutReps > 0) {
        const displayVolume = convertWeightFromStorage(totalWorkoutVolume);
        
        let completedAtStr = workout.completed_at;
        if (!completedAtStr.endsWith('Z') && !completedAtStr.includes('+')) {
          completedAtStr += 'Z';
        }
        const workoutDate = new Date(completedAtStr);

        chartData.push({
          date: workoutDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          reps: totalWorkoutReps,
          volume: Math.round(displayVolume),
        });
      }
    });

    // Sort chart data by date
    chartData.sort((a, b) => {
      const dateA = new Date(a.date + ', ' + new Date().getFullYear());
      const dateB = new Date(b.date + ', ' + new Date().getFullYear());
      return dateA.getTime() - dateB.getTime();
    });
    setProcessedStatsData(chartData);

    // Calculate Personal Records (always use full history for PRs)
    let heaviestWeightPR = { value: 0, date: '' };
    let best1RMPR = { value: 0, date: '' };
    let bestSetVolumePR = { value: 0, date: '' };
    let bestSessionVolumePR = { value: 0, date: '' };

    // Flatten all sets from the entire history for PRs
    const allHistorySets: any[] = [];
    history.forEach(workout => {
      workout.sets.forEach(set => {
        allHistorySets.push({ ...set, workoutDate: workout.completed_at });
      });
    });

    allHistorySets.forEach(set => {
      if (set.weight_lbs && set.reps) {
        // Heaviest Weight - The heaviest weight you've ever lifted
        const displayWeight = convertWeightFromStorage(set.weight_lbs);
        if (displayWeight > heaviestWeightPR.value) {
          let completedAtStr = set.workoutDate;
          if (!completedAtStr.endsWith('Z') && !completedAtStr.includes('+')) completedAtStr += 'Z';
          const date = new Date(completedAtStr).toLocaleDateString('en-GB', { 
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          });
          heaviestWeightPR = { value: parseFloat(displayWeight.toFixed(2)), date };
        }
        
        // Best 1RM - 1RM (One Rep Max) uses reps and weight from a set to estimate the max weight you could lift for a single rep
        const estimated1RM_lbs = set.weight_lbs * (1 + set.reps / 30);
        const estimated1RM_display = convertWeightFromStorage(estimated1RM_lbs);
        if (estimated1RM_display > best1RMPR.value) {
          let completedAtStr = set.workoutDate;
          if (!completedAtStr.endsWith('Z') && !completedAtStr.includes('+')) completedAtStr += 'Z';
          const date = new Date(completedAtStr).toLocaleDateString('en-GB', { 
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          });
          best1RMPR = { value: parseFloat(estimated1RM_display.toFixed(2)), date };
        }

        // Best Set Volume - The set in which you lifted the most volume (weight x reps)
        const setVolume_lbs = set.weight_lbs * set.reps;
        const setVolume_display = convertWeightFromStorage(setVolume_lbs);
        if (setVolume_display > bestSetVolumePR.value) {
          let completedAtStr = set.workoutDate;
          if (!completedAtStr.endsWith('Z') && !completedAtStr.includes('+')) completedAtStr += 'Z';
          const date = new Date(completedAtStr).toLocaleDateString('en-GB', { 
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          });
          bestSetVolumePR = { value: parseFloat(setVolume_display.toFixed(2)), date };
        }
      }
    });
    
    // Best Session Volume - Max Session Volume is the session you lifted the most weight in total over all your sets in this exercise
    history.forEach(workout => {
      let currentWorkoutVolume_lbs = 0;
      workout.sets.forEach(set => {
        if (set.weight_lbs && set.reps) {
          currentWorkoutVolume_lbs += set.weight_lbs * set.reps;
        }
      });
      const currentWorkoutVolume_display = convertWeightFromStorage(currentWorkoutVolume_lbs);
      if (currentWorkoutVolume_display > bestSessionVolumePR.value) {
        let completedAtStr = workout.completed_at;
        if (!completedAtStr.endsWith('Z') && !completedAtStr.includes('+')) completedAtStr += 'Z';
        const date = new Date(completedAtStr).toLocaleDateString('en-GB', { 
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
        bestSessionVolumePR = { value: parseFloat(currentWorkoutVolume_display.toFixed(2)), date };
      }
    });

    setPersonalRecords({
      heaviestWeight: heaviestWeightPR,
      best1RM: best1RMPR,
      bestSetVolume: bestSetVolumePR,
      bestSessionVolume: bestSessionVolumePR,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-lg text-gray-400">Exercise not found</p>
          <button
            onClick={() => navigate('/exercises')}
            className="mt-4 px-4 py-2 bg-cyan-500 text-black rounded-lg hover:bg-cyan-400 transition-colors"
          >
            Back to Exercise List
          </button>
        </div>
      </div>
    );
  }

  const getVimeoEmbedUrl = (vimeoUrl: string | null) => {
    if (!vimeoUrl) return null;
    
    // Extract video ID from Vimeo URL
    const match = vimeoUrl.match(/vimeo\.com\/(\d+)/);
    if (match && match[1]) {
      return `https://player.vimeo.com/video/${match[1]}?badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479`;
    }
    return null;
  };

  const renderAboutTab = () => (
    <div className="space-y-6">
      {/* Exercise Video - Only show for non-custom exercises or custom exercises with video_url */}
      {(!exercise.is_custom || exercise.video_url) && (
        <div className="relative bg-gray-800 rounded-lg overflow-hidden">
          {exercise.video_url && getVimeoEmbedUrl(exercise.video_url) ? (
            <div className="relative">
              <iframe
                src={getVimeoEmbedUrl(exercise.video_url)!}
                width="100%"
                height="315"
                frameBorder="0"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                className="w-full aspect-video"
                title={`${exercise.name} demonstration`}
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4 pointer-events-none">
                <h3 className="text-white font-semibold">{exercise.name}</h3>
                <p className="text-gray-300 text-sm">Exercise Demonstration</p>
              </div>
            </div>
          ) : (
            <>
              <img
                src="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
                alt="Exercise demonstration"
                className="w-full aspect-video object-cover"
              />
              <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <Play className="w-8 h-8 text-white ml-1" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
                <h3 className="text-white font-semibold">{exercise.name}</h3>
                <p className="text-gray-300 text-sm">No video available</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Exercise Information */}
      <div className="space-y-4">
        <div>
          <h4 className="text-white font-semibold mb-2">Equipment</h4>
          <p className="text-gray-300">{exercise.equipment}</p>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-2">Primary Muscle</h4>
          <p className="text-gray-300">{exercise.muscle_group}</p>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-2">Exercise Type</h4>
          <p className="text-gray-300 leading-relaxed">{exercise.instructions}</p>
        </div>
      </div>
    </div>
  );

  const formatHistoryDate = (dateString: string, timeString: string) => {
    return `${dateString} at ${timeString}`;
  };

  const renderHistoryTab = () => {
    if (historyLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {workoutHistory.map((workout) => (
          <div key={workout.workout_id} className="bg-gray-800 rounded-lg p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h4 className="text-white font-semibold">{formatHistoryDate(workout.date, workout.time)}</h4>
              </div>
              <span className="text-gray-400 text-sm">
                {workout.daysAgo <= 0 ? 'Today' : 
                 workout.daysAgo === 1 ? '1 day ago' : 
                 `${workout.daysAgo} days ago`}
              </span>
            </div>
            
            
            
            <div className="space-y-2">
              {workout.sets.map((set, index) => {
                // Check if this is a new exercise session (different workout_exercise_id)
                const isNewSession = index > 0 && workout.sets[index - 1].workout_exercise_id !== set.workout_exercise_id;
                
                return (
                  <div key={`${set.workout_exercise_id}-${set.set_number}`}>
                    {isNewSession && (
                      <div className="flex items-center my-4">
                        <div className="flex-1 h-px bg-gray-600"></div>
                        <span className="px-3 text-xs text-gray-400 bg-gray-800">New Round</span>
                        <div className="flex-1 h-px bg-gray-600"></div>
                      </div>
                    )}
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center space-x-4">
                        <div className="w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center text-black font-semibold text-sm">
                          {set.set_number}
                        </div>
                        <div className="text-white">
                          {set.weight_lbs !== null && set.reps !== null && (
                            <span>{formatWeightWithUnit(set.weight_lbs)} × {set.reps} reps</span>
                          )}
                          {set.duration_seconds !== null && (
                            <span>{Math.floor(set.duration_seconds / 60)}:{(set.duration_seconds % 60).toString().padStart(2, '0')}</span>
                          )}
                          {set.distance_miles !== null && (
                            <span>{set.distance_miles} miles</span>
                          )}
                          {set.notes && (
                            <div className="text-gray-400 text-sm mt-1">{set.notes}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        
        {workoutHistory.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400">No workout history for this exercise</p>
            <p className="text-gray-500 text-sm mt-2">Complete some workouts to see your history here</p>
          </div>
        )}
      </div>
    );
  };

  const renderStatisticsTab = () => {
    const { heaviestWeight, best1RM, bestSetVolume, bestSessionVolume } = personalRecords;
    const weightUnit = getWeightUnit();

    return (
      <div className="space-y-6">
        {/* Time Period Filter */}
        <div className="flex space-x-2 overflow-x-auto">
          {[
            { value: 'all', label: 'All Time' },
            { value: '1month', label: '1 month' },
            { value: '3months', label: '3 months' },
            { value: '6months', label: '6 months' },
            { value: '1year', label: '1 year' }
          ].map((period) => (
            <button
              key={period.value}
              onClick={() => setStatsPeriod(period.value as StatsPeriod)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                statsPeriod === period.value
                  ? 'bg-cyan-500 text-black'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>

        {/* Personal Records Section */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-white font-semibold mb-4">Personal Records</h4>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="bg-gray-700 p-3 rounded-md">
              <p className="text-sm text-gray-400">Heaviest Weight</p>
              <p className="text-lg font-bold text-cyan-500">
                {heaviestWeight.value > 0 ? `${heaviestWeight.value.toFixed(2)} ${weightUnit}` : 'N/A'}
              </p>
              <p className="text-xs text-gray-500">
                {heaviestWeight.date || ''}
              </p>
            </div>
            <div className="bg-gray-700 p-3 rounded-md">
              <p className="text-sm text-gray-400">Best 1RM</p>
              <p className="text-lg font-bold text-cyan-500">
                {best1RM.value > 0 ? `${best1RM.value.toFixed(2)} ${weightUnit}` : 'N/A'}
              </p>
              <p className="text-xs text-gray-500">
                {best1RM.date || ''}
              </p>
            </div>
            <div className="bg-gray-700 p-3 rounded-md">
              <p className="text-sm text-gray-400">Best Set Volume</p>
              <p className="text-lg font-bold text-cyan-500">
                {bestSetVolume.value > 0 ? `${Math.round(bestSetVolume.value)} ${weightUnit}` : 'N/A'}
              </p>
              <p className="text-xs text-gray-500">
                {bestSetVolume.date || ''}
              </p>
            </div>
            <div className="bg-gray-700 p-3 rounded-md">
              <p className="text-sm text-gray-400">Best Session Volume</p>
              <p className="text-lg font-bold text-cyan-500">
                {bestSessionVolume.value > 0 ? `${Math.round(bestSessionVolume.value)} ${weightUnit}` : 'N/A'}
              </p>
              <p className="text-xs text-gray-500">
                {bestSessionVolume.date || ''}
              </p>
            </div>
          </div>
        </div>

        {processedStatsData.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-gray-400">No workout data available for the selected period</p>
            <p className="text-gray-500 text-sm mt-2">Complete some workouts to see your progress charts here</p>
          </div>
        ) : (
          <>
            {/* Reps Chart */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="text-white font-semibold mb-4">Reps Over Time</h4>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={processedStatsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#9CA3AF"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="#9CA3AF"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#FFFFFF'
                      }}
                      formatter={(value) => [`${value} reps`, 'Total Reps']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="reps" 
                      stroke="#06B6D4" 
                      strokeWidth={2}
                      dot={{ fill: '#06B6D4', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, fill: '#06B6D4' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Volume Chart */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="text-white font-semibold mb-4">Volume Over Time ({weightUnit})</h4>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={processedStatsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#9CA3AF"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="#9CA3AF"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#FFFFFF'
                      }}
                      formatter={(value) => [`${value} ${weightUnit}`, 'Total Volume']}
                    />
                    <Bar 
                      dataKey="volume" 
                      fill="#06B6D4"
                      radius={[2, 2, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <h1 className="text-xl font-semibold">{exercise?.name || 'Exercise'}</h1>
        </div>
        
        {/* Custom Exercise Options */}
        {exercise?.is_custom && (
          <div className="relative">
            <button
              onClick={() => setShowOptionsMenu(!showOptionsMenu)}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <MoreVertical className="w-6 h-6" />
            </button>
            
            {showOptionsMenu && (
              <div className="absolute right-0 top-full mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10 min-w-32">
                <div className="py-2">
                  <button
                    onClick={() => {
                      setShowOptionsMenu(false);
                      navigate(`/exercises/${exercise.id}/edit`);
                    }}
                    className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-white hover:bg-gray-700 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowOptionsMenu(false);
                      handleDeleteExercise();
                    }}
                    className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-red-400 hover:bg-gray-700 transition-colors"
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

      {/* Tabs */}
      <div className="flex justify-between sm:justify-start border-b border-gray-700 mb-6">
        {[
          { id: 'about', label: 'About' },
          { id: 'history', label: 'History' },
          { id: 'statistics', label: 'Statistics' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`flex-1 sm:flex-none px-6 py-3 font-medium transition-colors text-center ${
              activeTab === tab.id
                ? 'text-cyan-500 border-b-2 border-cyan-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'about' && renderAboutTab()}
        {activeTab === 'history' && renderHistoryTab()}
        {activeTab === 'statistics' && renderStatisticsTab()}
      </div>
    </div>
  );
}
