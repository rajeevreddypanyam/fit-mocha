import { useNavigate, useLocation } from 'react-router';
import { useState, useEffect } from 'react';

interface ActiveWorkout {
  id: number;
  name: string;
  started_at: string;
  exercise_count: number;
}

export default function Workout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(null);
  const [loading, setLoading] = useState(true);

  const checkForActiveWorkout = async () => {
    try {
      console.log('Checking for active workout...');
      const response = await fetch('/api/workouts/active');
      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Active workout data:', data);
        setActiveWorkout(data || null);
      } else {
        console.log('No active workout or error response');
        setActiveWorkout(null);
      }
    } catch (error) {
      console.error('Error checking for active workout:', error);
      setActiveWorkout(null);
    } finally {
      console.log('Setting loading to false');
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('Component mounted, checking for active workout');
    checkForActiveWorkout();
  }, []);

  // Check for refresh state from navigation
  useEffect(() => {
    if (location.state?.refresh) {
      console.log('Refresh state detected, reloading workout');
      setActiveWorkout(null);
      setLoading(true);
      checkForActiveWorkout();
      // Clear the refresh state
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  const handleWorkoutButtonClick = () => {
    navigate('/workout/start');
  };

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-6">
      {/* Main Action Buttons */}
      <div className="w-full space-y-4">
        <button
          onClick={() => navigate('/exercises')}
          className="w-full bg-cyan-500 hover:bg-cyan-600 text-black font-semibold py-4 px-6 rounded-xl transition-colors shadow-lg"
        >
          Exercise List
        </button>
        
        <button
          onClick={handleWorkoutButtonClick}
          className="w-full bg-cyan-500 hover:bg-cyan-600 text-black font-semibold py-4 px-6 rounded-xl transition-colors shadow-lg disabled:bg-gray-600 disabled:cursor-not-allowed"
          disabled={loading}
        >
          {loading ? 'Loading...' : activeWorkout ? 'Resume Workout' : 'Start Active Workout'}
        </button>
      </div>

      {/* Decorative Elements */}
      <div className="flex-1 flex items-center justify-center opacity-10">
        <div className="text-6xl">💪</div>
      </div>
    </div>
  );
}
