import { useState } from 'react';
import { User, Bell, Info, HelpCircle, MessageSquare, LogOut, X } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useSettings } from '@/react-app/hooks/useSettings';

export default function Settings() {
  const navigate = useNavigate();
  const { settings, updateSettings } = useSettings();
  
  // Modal state
  const [showTimerModal, setShowTimerModal] = useState(false);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const adjustTimer = (adjustment: number) => {
    const newTime = Math.max(5, Math.min(600, settings.defaultTimer + adjustment)); // Min 5s, Max 10min
    updateSettings({ defaultTimer: newTime });
  };

  const ToggleSwitch = ({ enabled, onToggle, label, description }: {
    enabled: boolean;
    onToggle: () => void;
    label: string;
    description?: string;
  }) => (
    <button
      onClick={onToggle}
      className={`w-full rounded-lg p-4 transition-colors text-left ${
        settings.theme === 'dark' 
          ? 'bg-gray-800 hover:bg-gray-750 shadow-lg shadow-black/20' 
          : 'bg-white hover:bg-gray-50 border border-gray-200 shadow-lg shadow-gray-900/10'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className={`font-medium ${
            settings.theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>{label}</h3>
          {description && <p className={`text-sm mt-1 ${
            settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>{description}</p>}
        </div>
        <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          enabled ? 'bg-cyan-500' : 'bg-gray-600'
        }`}>
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </div>
      </div>
    </button>
  );

  const SettingItem = ({ icon: Icon, label, description, onClick, rightElement }: {
    icon: any;
    label: string;
    description?: string;
    onClick?: () => void;
    rightElement?: React.ReactNode;
  }) => (
    <button
      onClick={onClick}
      className={`w-full rounded-lg p-4 transition-colors text-left ${
        settings.theme === 'dark' 
          ? 'bg-gray-800 hover:bg-gray-750' 
          : 'bg-white hover:bg-gray-50 border border-gray-200'
      }`}
    >
      <div className="flex items-center space-x-4">
        <div className={`p-2 rounded-lg ${
          settings.theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
        }`}>
          <Icon className="w-5 h-5 text-cyan-500" />
        </div>
        <div className="flex-1">
          <h3 className={`font-medium ${
            settings.theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>{label}</h3>
          {description && <p className={`text-sm mt-1 ${
            settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>{description}</p>}
        </div>
        {rightElement}
      </div>
    </button>
  );

  return (
    <div className="h-full flex flex-col pb-6">
      <div className="flex-1 overflow-y-auto space-y-6">
        {/* General Section */}
        <div>
          <h2 className={`text-lg font-semibold mb-3 ${
            settings.theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>General</h2>
          <div className="space-y-2">
            <SettingItem
              icon={User}
              label="Edit Profile"
              description="Update your personal information"
              onClick={() => navigate('/profile/edit')}
            />
            <SettingItem
              icon={User}
              label="Units"
              description="Choose measurement system"
              rightElement={
                <div className={`flex rounded-lg p-1 ${
                  settings.theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                }`}>
                  <button
                    onClick={() => updateSettings({ units: 'imperial' })}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      settings.units === 'imperial' 
                        ? 'bg-cyan-500 text-black' 
                        : settings.theme === 'dark' 
                          ? 'text-gray-300' 
                          : 'text-gray-600'
                    }`}
                  >
                    Imperial (lbs)
                  </button>
                  <button
                    onClick={() => updateSettings({ units: 'metric' })}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      settings.units === 'metric' 
                        ? 'bg-cyan-500 text-black' 
                        : settings.theme === 'dark' 
                          ? 'text-gray-300' 
                          : 'text-gray-600'
                    }`}
                  >
                    Metric (kg)
                  </button>
                </div>
              }
            />
            
            <ToggleSwitch
              enabled={settings.theme === 'dark'}
              onToggle={() => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
              label="Dark Theme"
              description="Use dark theme for better visibility"
            />
            
            <ToggleSwitch
              enabled={settings.keepScreenOn}
              onToggle={() => updateSettings({ keepScreenOn: !settings.keepScreenOn })}
              label="Keep screen on while training"
              description="Prevent screen from turning off during workouts"
            />
          </div>
        </div>

        {/* Rest Timer Section */}
        <div>
          <h2 className={`text-lg font-semibold mb-3 ${
            settings.theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>Rest Timer</h2>
          <div className="space-y-2">
            <ToggleSwitch
              enabled={settings.autoStartTimer}
              onToggle={() => updateSettings({ autoStartTimer: !settings.autoStartTimer })}
              label="Starts when you complete a set"
              description="Automatically start rest timer after each set"
            />
            
            <ToggleSwitch
              enabled={settings.playSound}
              onToggle={() => updateSettings({ playSound: !settings.playSound })}
              label="Play sound upon finish a set"
              description="Audio notification when rest timer ends"
            />
            
            <ToggleSwitch
              enabled={settings.vibrate}
              onToggle={() => updateSettings({ vibrate: !settings.vibrate })}
              label="Vibrate upon finish a set"
              description="Vibration notification when rest timer ends"
            />
            
            <SettingItem
              icon={Bell}
              label="Set default timer"
              description="Configure default rest timer duration"
              onClick={() => setShowTimerModal(true)}
              rightElement={
                <div className="flex items-center space-x-2">
                  <span className="text-cyan-500 font-mono">{formatTimer(settings.defaultTimer)}</span>
                  <button className="bg-cyan-500 text-black px-3 py-1 rounded text-sm font-medium">
                    Select
                  </button>
                </div>
              }
            />
          </div>
        </div>

        {/* Help Section */}
        <div>
          <h2 className={`text-lg font-semibold mb-3 ${
            settings.theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>Help</h2>
          <div className="space-y-2">
            <SettingItem
              icon={HelpCircle}
              label="Frequently Asked Questions"
              description="Common questions and answers"
              onClick={() => console.log('FAQ clicked')}
            />
            
            <SettingItem
              icon={MessageSquare}
              label="Feedback / Suggestions"
              description="Share your thoughts and ideas"
              onClick={() => console.log('Feedback clicked')}
            />
            
            <SettingItem
              icon={Info}
              label="About"
              description="App version and information"
              onClick={() => console.log('About clicked')}
            />
          </div>
        </div>
      </div>

      {/* Logout Button */}
      <div className={`mt-6 pt-4 border-t ${
        settings.theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
      }`}>
        <button
          onClick={() => console.log('Logout clicked')}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>

      {/* Timer Modal */}
      {showTimerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`rounded-lg p-6 w-full max-w-sm ${
            settings.theme === 'dark' ? 'bg-gray-800 shadow-xl shadow-black/30' : 'bg-white border border-gray-200 shadow-xl shadow-gray-900/20'
          }`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-lg font-semibold ${
                settings.theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>Set Default Timer</h3>
              <button
                onClick={() => setShowTimerModal(false)}
                className={`p-1 rounded transition-colors ${
                  settings.theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                }`}
              >
                <X className={`w-5 h-5 ${
                  settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`} />
              </button>
            </div>
            
            <div className="text-center mb-6">
              <div className="text-4xl font-mono text-cyan-500 mb-4">
                {formatTimer(settings.defaultTimer)}
              </div>
              
              <div className="flex justify-center space-x-4">
                <button
                  onClick={() => adjustTimer(-5)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    settings.theme === 'dark' 
                      ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                  }`}
                >
                  - 5 sec
                </button>
                <button
                  onClick={() => adjustTimer(5)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    settings.theme === 'dark' 
                      ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                  }`}
                >
                  + 5 sec
                </button>
              </div>
            </div>
            
            <button
              onClick={() => setShowTimerModal(false)}
              className="w-full bg-cyan-500 hover:bg-cyan-600 text-black font-semibold py-2 rounded-lg transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
