import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

interface Settings {
  units: 'imperial' | 'metric';
  theme: 'dark' | 'light';
  keepScreenOn: boolean;
  autoStartTimer: boolean;
  playSound: boolean;
  vibrate: boolean;
  defaultTimer: number;
}

interface SettingsContextType {
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
  getWeightUnit: () => 'kg' | 'lbs';
  formatWeight: (weight: number | null | undefined) => string;
  formatWeightWithUnit: (weight: number | null | undefined) => string;
  convertWeightFromStorage: (weightLbs: number | null | undefined) => number;
  convertWeightToStorage: (displayWeight: number | null | undefined) => number;
}

const defaultSettings: Settings = {
  units: 'metric',
  theme: 'dark',
  keepScreenOn: false,
  autoStartTimer: true,
  playSound: true,
  vibrate: true,
  defaultTimer: 89
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  useEffect(() => {
    // Load settings from localStorage
    const savedSettings = localStorage.getItem('appSettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...defaultSettings, ...parsed });
      } catch (error) {
        console.error('Failed to parse saved settings:', error);
      }
    }
  }, []);

  const updateSettings = (newSettings: Partial<Settings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    localStorage.setItem('appSettings', JSON.stringify(updatedSettings));
  };

  const getWeightUnit = (): 'kg' | 'lbs' => {
    return settings.units === 'metric' ? 'kg' : 'lbs';
  };

  // Convert weight from stored unit (lbs) to display unit
  const convertWeightFromStorage = (weightLbs: number | null | undefined): number => {
    if (!weightLbs) return 0;
    if (settings.units === 'metric') {
      // Convert from lbs to kg
      return weightLbs / 2.20462;
    }
    // Already in lbs
    return weightLbs;
  };

  // Convert weight from display unit to storage unit (lbs)
  const convertWeightToStorage = (displayWeight: number | null | undefined): number => {
    if (!displayWeight) return 0;
    if (settings.units === 'metric') {
      // Convert from kg to lbs
      return displayWeight * 2.20462;
    }
    // Already in lbs
    return displayWeight;
  };

  const formatWeight = (weightLbs: number | null | undefined): string => {
    if (!weightLbs || weightLbs === 0) return '0.00';
    const displayWeight = convertWeightFromStorage(weightLbs);
    return displayWeight.toFixed(2);
  };

  const formatWeightWithUnit = (weightLbs: number | null | undefined): string => {
    const formatted = formatWeight(weightLbs);
    const unit = getWeightUnit();
    return `${formatted} ${unit}`;
  };

  const value: SettingsContextType = {
    settings,
    updateSettings,
    getWeightUnit,
    formatWeight,
    formatWeightWithUnit,
    convertWeightFromStorage,
    convertWeightToStorage
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
