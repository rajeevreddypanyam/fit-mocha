import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Check, MoreVertical } from 'lucide-react';

interface ActiveWorkoutHeaderProps {
  workout: {
    id: number;
    started_at: string;
    exercises: any[];
  } | null;
  onCompleteWorkout?: () => void;
  onDiscardWorkout: () => void;
  showCompleteButton?: boolean;
  backRoute?: string;
}

export default function ActiveWorkoutHeader({
  workout,
  onCompleteWorkout,
  onDiscardWorkout,
  showCompleteButton = true,
  backRoute = '/'
}: ActiveWorkoutHeaderProps) {
  const navigate = useNavigate();
  const [stopwatchTime, setStopwatchTime] = useState(0); // in seconds
  const [restTimer, setRestTimer] = useState(0); // in seconds
  const [initialRestTimer, setInitialRestTimer] = useState(0); // for progress calculation
  const [isRestTimerActive, setIsRestTimerActive] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [showTimerPopup, setShowTimerPopup] = useState(false);
  const [activeTab, setActiveTab] = useState<'timer' | 'stopwatch'>('timer');
  
  // Popup timer states
  const [popupRestTimer, setPopupRestTimer] = useState(60); // default 1 minute
  const [isPopupRestTimerActive, setIsPopupRestTimerActive] = useState(false);
  const [popupStopwatch, setPopupStopwatch] = useState(0);
  const [isPopupStopwatchActive, setIsPopupStopwatchActive] = useState(false);

  // Stopwatch effect - runs continuously when workout is started
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (workout && workout.started_at) {
      interval = setInterval(() => {
        // Handle SQLite CURRENT_TIMESTAMP which returns UTC time as a string
        // Ensure we parse it as UTC by appending 'Z' if not present
        let startTimeStr = workout.started_at;
        if (!startTimeStr.endsWith('Z') && !startTimeStr.includes('+')) {
          startTimeStr += 'Z';
        }
        
        const startTime = new Date(startTimeStr).getTime();
        const currentTime = new Date().getTime();
        const elapsedSeconds = Math.floor((currentTime - startTime) / 1000);
        setStopwatchTime(Math.max(0, elapsedSeconds));
      }, 1000);
    } else {
      // Show 00:00:00 when workout hasn't started yet
      setStopwatchTime(0);
    }
    return () => clearInterval(interval);
  }, [workout?.started_at]);

  // Rest timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRestTimerActive && restTimer > 0) {
      interval = setInterval(() => {
        setRestTimer(prev => {
          if (prev <= 1) {
            setIsRestTimerActive(false);
            setInitialRestTimer(0); // Reset progress ring
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRestTimerActive, restTimer]);

  // Popup timer effects
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPopupRestTimerActive && popupRestTimer > 0) {
      interval = setInterval(() => {
        setPopupRestTimer(prev => {
          if (prev <= 1) {
            setIsPopupRestTimerActive(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPopupRestTimerActive, popupRestTimer]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPopupStopwatchActive) {
      interval = setInterval(() => {
        setPopupStopwatch(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPopupStopwatchActive]);

  const formatTime = (seconds: number) => {
    // Cap at 99 hours maximum (356,400 seconds)
    const cappedSeconds = Math.min(seconds, 356400);
    
    const hours = Math.floor(cappedSeconds / 3600);
    const minutes = Math.floor((cappedSeconds % 3600) / 60);
    const secs = cappedSeconds % 60;
    
    // Always show HH:MM:SS format, starting from 00:00:00
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatRestTimer = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    
    // Show MM:SS format for rest timer
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePopupTimerStart = () => {
    setIsPopupRestTimerActive(true);
    // Also sync with main timer
    setRestTimer(popupRestTimer);
    setInitialRestTimer(popupRestTimer);
    setIsRestTimerActive(true);
    setShowTimerPopup(false);
  };

  const handlePopupStopwatchStart = () => {
    setIsPopupStopwatchActive(true);
  };

  const handlePopupStopwatchStop = () => {
    setIsPopupStopwatchActive(false);
  };

  const handlePopupStopwatchReset = () => {
    setIsPopupStopwatchActive(false);
    setPopupStopwatch(0);
  };

  const adjustPopupTimer = (seconds: number) => {
    setPopupRestTimer(prev => Math.max(0, prev + seconds));
  };

  return (
    <>
      {/* Custom Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700 shadow-2xl shadow-black/50 backdrop-blur-lg">
        {/* Left Section - Back button + Stopwatch */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate(backRoute)}
            className="p-1 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          
          {/* Stopwatch - only show when workout exists and has been started */}
          {workout && workout.started_at && (
            <div className="text-white font-mono text-lg">
              {formatTime(stopwatchTime)}
            </div>
          )}
        </div>

        {/* Right Section - Rest timer + Actions */}
        <div className="flex items-center space-x-4">
          {/* Rest Timer with Internal Progress */}
          <div className="relative">
            {/* Timer Button with Internal Progress Fill */}
            <button
              onClick={() => setShowTimerPopup(true)}
              className="w-20 h-10 rounded-xl text-xs font-mono transition-colors relative flex items-center justify-center border border-gray-600 bg-gray-700 hover:bg-gray-600 overflow-hidden"
            >
              {/* Progress Fill - Decreases as timer counts down */}
              {isRestTimerActive && initialRestTimer > 0 && (
                <div
                  className="absolute inset-0 bg-cyan-500 transition-all duration-1000 ease-linear"
                  style={{
                    width: `${(restTimer / initialRestTimer) * 100}%`,
                  }}
                />
              )}
              
              {/* Timer Text */}
              <span className={`relative z-10 font-mono text-lg ${
                isRestTimerActive 
                  ? 'text-white font-semibold' 
                  : 'text-gray-300'
              }`}>
                {formatRestTimer(restTimer)}
              </span>
            </button>
          </div>
          
          {showCompleteButton && onCompleteWorkout && (
            <button
              onClick={onCompleteWorkout}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              disabled={workout?.exercises.length === 0}
            >
              <Check className="w-6 h-6 text-green-500" />
            </button>
          )}
          
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
                    onClick={() => {
                      setShowOptionsMenu(false);
                      setShowDiscardDialog(true);
                    }}
                    className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-red-500 hover:bg-gray-700 transition-colors"
                  >
                    <span>Discard workout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Discard Confirmation Dialog */}
      {showDiscardDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">Discard workout?</h3>
            <p className="text-gray-400 text-sm mb-6">
              Are you sure you want to discard this workout? This action cannot be undone.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDiscardDialog(false)}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
              >
                Resume
              </button>
              <button
                onClick={() => {
                  setShowDiscardDialog(false);
                  onDiscardWorkout();
                }}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Timer Popup */}
      {showTimerPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 rounded-2xl w-full max-w-sm border border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">Clock</h2>
              <button
                onClick={() => setShowTimerPopup(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex bg-gray-800 mx-4 mt-4 rounded-lg overflow-hidden">
              <button
                onClick={() => setActiveTab('timer')}
                className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                  activeTab === 'timer'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Timer
              </button>
              <button
                onClick={() => setActiveTab('stopwatch')}
                className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                  activeTab === 'stopwatch'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Stopwatch
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'timer' ? (
                <div className="text-center">
                  {/* Timer Display */}
                  <div className="relative w-48 h-48 mx-auto mb-8">
                    <div className="absolute inset-0 rounded-full border-4 border-blue-500"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-4xl font-mono text-white">
                        {formatRestTimer(popupRestTimer)}
                      </span>
                    </div>
                    
                    {/* Adjustment buttons */}
                    <button
                      onClick={() => adjustPopupTimer(-10)}
                      className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-12 text-blue-500 hover:text-blue-400 transition-colors text-sm font-semibold"
                    >
                      -10s
                    </button>
                    <button
                      onClick={() => adjustPopupTimer(10)}
                      className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-12 text-blue-500 hover:text-blue-400 transition-colors text-sm font-semibold"
                    >
                      +10s
                    </button>
                  </div>

                  {/* Start Button */}
                  <button
                    onClick={() => {
                      handlePopupTimerStart();
                      setShowTimerPopup(false);
                    }}
                    className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-lg font-semibold transition-colors"
                    disabled={popupRestTimer === 0}
                  >
                    Start
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  {/* Stopwatch Display */}
                  <div className="relative w-48 h-48 mx-auto mb-8">
                    <div className="absolute inset-0 rounded-full border-4 border-blue-500"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-4xl font-mono text-white">
                        {formatTime(popupStopwatch)}
                      </span>
                    </div>
                  </div>

                  {/* Control Buttons */}
                  <div className="flex space-x-4">
                    <button
                      onClick={handlePopupStopwatchReset}
                      className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
                    >
                      Reset
                    </button>
                    <button
                      onClick={isPopupStopwatchActive ? handlePopupStopwatchStop : handlePopupStopwatchStart}
                      className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium"
                    >
                      {isPopupStopwatchActive ? 'Stop' : 'Start'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
