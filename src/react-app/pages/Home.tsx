import { useState, useEffect } from 'react';
import { Play, Calendar, Settings, Plus, Award, TrendingUp, Clock, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useSettings } from '@/react-app/hooks/useSettings';

interface QuickStat {
  label: string;
  value: string;
  change?: string;
  icon: React.ComponentType<any>;
}

interface ActiveWorkout {
  id: number;
  name?: string;
  started_at: string;
  exercise_count: number;
}

export default function Home() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(null);
  const [stats, setStats] = useState<QuickStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveWorkout();
    fetchQuickStats();
  }, []);

  const fetchActiveWorkout = async () => {
    try {
      const response = await fetch('/api/workouts/active');
      if (response.ok) {
        const data = await response.json();
        setActiveWorkout(data);
      }
    } catch (error) {
      console.error('Failed to fetch active workout:', error);
    }
  };

  const fetchQuickStats = async () => {
    try {
      // This would typically fetch real stats from your API
      // For now, using mock data that looks realistic
      setStats([
        {
          label: 'This Week',
          value: '3 workouts',
          change: '+1 from last week',
          icon: Calendar
        },
        {
          label: 'Best Streak',
          value: '7 days',
          change: 'Personal best!',
          icon: Award
        },
        {
          label: 'Total Volume',
          value: '2,340 kg',
          change: '+12% this month',
          icon: TrendingUp
        },
        {
          label: 'Avg Duration',
          value: '45 min',
          change: 'Consistent',
          icon: Clock
        }
      ]);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatActiveWorkoutTime = (startedAt: string) => {
    const started = new Date(startedAt);
    const now = new Date();
    const diff = Math.floor((now.getTime() - started.getTime()) / (1000 * 60));
    
    if (diff < 60) {
      return `${diff}m active`;
    } else {
      const hours = Math.floor(diff / 60);
      const minutes = diff % 60;
      return `${hours}h ${minutes}m active`;
    }
  };

  const generateWorkoutTitle = () => {
    if (activeWorkout?.name) return activeWorkout.name;
    return activeWorkout?.exercise_count > 0 ? 'Active Workout' : 'Quick Workout';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Welcome Section */}
      <div className="text-center">
        <h2 className={`text-2xl font-bold mb-2 ${
          settings.theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}>
          Ready to Train?
        </h2>
        <p className={`${
          settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
        }`}>
          Let's crush your fitness goals today
        </p>
      </div>

      {/* Active Workout Card */}
      {activeWorkout ? (
        <div className={`rounded-xl p-6 ${
          settings.theme === 'dark' 
            ? 'bg-gradient-to-br from-cyan-600 to-cyan-700 shadow-2xl shadow-cyan-600/30' 
            : 'bg-gradient-to-br from-cyan-500 to-cyan-600 shadow-2xl shadow-cyan-500/30'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold text-black">
                {generateWorkoutTitle()}
              </h3>
              <p className="text-black/80">
                {formatActiveWorkoutTime(activeWorkout.started_at)}
              </p>
            </div>
            <div className="bg-black/20 p-3 rounded-full">
              <Play className="w-6 h-6 text-black" />
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="text-black/80 text-sm">
                {activeWorkout.exercise_count} exercise{activeWorkout.exercise_count !== 1 ? 's' : ''} added
              </p>
            </div>
            <button
              onClick={() => navigate('/workout/start')}
              className="bg-black/20 hover:bg-black/30 text-black font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      ) : (
        /* Start New Workout Card */
        <div className={`rounded-xl p-6 border-2 border-dashed transition-all duration-300 ${
          settings.theme === 'dark' 
            ? 'border-gray-600 hover:border-cyan-500 bg-gray-800/50 shadow-lg hover:shadow-xl shadow-black/20' 
            : 'border-gray-300 hover:border-cyan-500 bg-gray-50 shadow-lg hover:shadow-xl shadow-gray-900/10'
        }`}>
          <div className="text-center">
            <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
              settings.theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
            }`}>
              <Plus className={`w-8 h-8 ${
                settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`} />
            </div>
            <h3 className={`text-lg font-semibold mb-2 ${
              settings.theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Start Your Workout
            </h3>
            <p className={`text-sm mb-4 ${
              settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Begin a new training session
            </p>
            <button
              onClick={() => navigate('/workout/start')}
              className="bg-cyan-500 hover:bg-cyan-600 text-black font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              Start Workout
            </button>
          </div>
        </div>
      )}

      {/* Quick Stats Grid */}
      <div>
        <h3 className={`text-lg font-semibold mb-4 ${
          settings.theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}>
          Your Progress
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {stats.map((stat, index) => (
            <div
              key={index}
              className={`rounded-lg p-4 ${
                settings.theme === 'dark' 
                  ? 'bg-gray-800 border border-gray-700 shadow-lg shadow-black/20' 
                  : 'bg-white border border-gray-200 shadow-lg shadow-gray-900/10'
              }`}
            >
              <div className="flex items-center space-x-3 mb-2">
                <div className={`p-2 rounded-lg ${
                  settings.theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                }`}>
                  <stat.icon className="w-4 h-4 text-cyan-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium ${
                    settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    {stat.label}
                  </p>
                </div>
              </div>
              <p className={`text-lg font-bold ${
                settings.theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                {stat.value}
              </p>
              {stat.change && (
                <p className={`text-xs mt-1 ${
                  settings.theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                }`}>
                  {stat.change}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className={`text-lg font-semibold mb-4 ${
          settings.theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}>
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => navigate('/exercises')}
            className={`p-4 rounded-lg text-left transition-all duration-300 ${
              settings.theme === 'dark' 
                ? 'bg-gray-800 hover:bg-gray-750 border border-gray-700 shadow-lg hover:shadow-xl shadow-black/20' 
                : 'bg-white hover:bg-gray-50 border border-gray-200 shadow-lg hover:shadow-xl shadow-gray-900/10'
            }`}
          >
            <div className={`p-2 rounded-lg mb-3 w-fit ${
              settings.theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
            }`}>
              <BarChart3 className="w-5 h-5 text-cyan-500" />
            </div>
            <h4 className={`font-semibold mb-1 ${
              settings.theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Browse Exercises
            </h4>
            <p className={`text-sm ${
              settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Explore exercise library
            </p>
          </button>

          <button
            onClick={() => navigate('/history')}
            className={`p-4 rounded-lg text-left transition-colors ${
              settings.theme === 'dark' 
                ? 'bg-gray-800 hover:bg-gray-750 border border-gray-700' 
                : 'bg-white hover:bg-gray-50 border border-gray-200'
            }`}
          >
            <div className={`p-2 rounded-lg mb-3 w-fit ${
              settings.theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
            }`}>
              <Calendar className="w-5 h-5 text-cyan-500" />
            </div>
            <h4 className={`font-semibold mb-1 ${
              settings.theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              View History
            </h4>
            <p className={`text-sm ${
              settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Track your progress
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
