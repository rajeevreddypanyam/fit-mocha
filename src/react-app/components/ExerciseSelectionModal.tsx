import { useState, useEffect } from 'react';
import { Plus, Search, ArrowUpDown, Star, X, ShoppingCart, Check } from 'lucide-react';

interface Exercise {
  id: number;
  name: string;
  category: string;
  muscle_group: string;
  equipment: string;
  instructions: string;
  is_custom: boolean;
  is_favourite: boolean;
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
  video_url?: string | null;
}

type SortOption = 'favourites' | 'recent' | 'most_used' | 'custom';

interface ExerciseSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddExercises: (selectedExerciseIds: number[]) => void;
  mode?: 'add' | 'replace';
}

export default function ExerciseSelectionModal({
  isOpen,
  onClose,
  onAddExercises,
  mode = 'add'
}: ExerciseSelectionModalProps) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState('All');
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState('All');
  const [sortBy, setSortBy] = useState<SortOption>('favourites');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showEquipmentMenu, setShowEquipmentMenu] = useState(false);
  const [showMuscleGroupMenu, setShowMuscleGroupMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedExercises, setSelectedExercises] = useState<Set<number>>(new Set());
  const [addingExercises, setAddingExercises] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchExercises();
    }
  }, [isOpen]);

  const fetchExercises = async () => {
    try {
      const response = await fetch('/api/exercises');
      const data = await response.json();
      
      // Add mock data for favorites and usage since we don't have user system yet
      const exercisesWithStats = data.map((exercise: any, index: number) => ({
        ...exercise,
        is_favourite: index < 3, // Mock: first 3 are favorites
        usage_count: Math.floor(Math.random() * 20),
        last_used_at: index < 5 ? new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString() : null
      }));
      
      setExercises(exercisesWithStats);
    } catch (error) {
      console.error('Failed to fetch exercises:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavourite = async (exerciseId: number) => {
    setExercises(prev => prev.map(exercise => 
      exercise.id === exerciseId 
        ? { ...exercise, is_favourite: !exercise.is_favourite }
        : exercise
    ));
  };

  const toggleSelectExercise = (exerciseId: number) => {
    setSelectedExercises(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(exerciseId)) {
        newSelected.delete(exerciseId);
      } else {
        newSelected.add(exerciseId);
      }
      return newSelected;
    });
  };

  const handleAddSelectedExercises = async () => {
    if (selectedExercises.size === 0) return;

    setAddingExercises(true);
    try {
      // Pass the selected exercise IDs back to the parent component
      onAddExercises(Array.from(selectedExercises));
      
      // Clear selection and close modal
      setSelectedExercises(new Set());
      onClose();
    } catch (error) {
      console.error('Error adding exercises:', error);
      alert('Failed to add exercises. Please try again.');
    } finally {
      setAddingExercises(false);
    }
  };

  const formatLastUsed = (lastUsedAt: string | null) => {
    if (!lastUsedAt) return 'Never used';
    
    const now = new Date();
    const lastUsed = new Date(lastUsedAt);
    const diffInDays = Math.floor((now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return '1 Day ago';
    if (diffInDays < 30) return `${diffInDays} Days ago`;
    if (diffInDays < 365) {
      const months = Math.floor(diffInDays / 30);
      return months === 1 ? '1 Month ago' : `${months} Months ago`;
    }
    const years = Math.floor(diffInDays / 365);
    return years === 1 ? '1 Yr ago' : `${years} Yrs ago`;
  };

  const getSortedExercises = () => {
    let sorted = [...exercises];
    
    switch (sortBy) {
      case 'favourites':
        sorted.sort((a, b) => {
          if (a.is_favourite && !b.is_favourite) return -1;
          if (!a.is_favourite && b.is_favourite) return 1;
          return a.name.localeCompare(b.name);
        });
        break;
      case 'recent':
        sorted.sort((a, b) => {
          if (!a.last_used_at && !b.last_used_at) return a.name.localeCompare(b.name);
          if (!a.last_used_at) return 1;
          if (!b.last_used_at) return -1;
          return new Date(b.last_used_at).getTime() - new Date(a.last_used_at).getTime();
        });
        break;
      case 'most_used':
        sorted.sort((a, b) => {
          if (b.usage_count === a.usage_count) return a.name.localeCompare(b.name);
          return b.usage_count - a.usage_count;
        });
        break;
      case 'custom':
        sorted = sorted.filter(exercise => exercise.is_custom);
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    return sorted;
  };

  const filteredExercises = getSortedExercises().filter(exercise => {
    const matchesSearch = exercise.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         exercise.muscle_group.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         exercise.equipment.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEquipment = selectedEquipment === 'All' || exercise.equipment === selectedEquipment;
    const matchesMuscleGroup = selectedMuscleGroup === 'All' || exercise.muscle_group === selectedMuscleGroup;
    return matchesSearch && matchesEquipment && matchesMuscleGroup;
  });

  const equipmentOptions = ['All', ...Array.from(new Set(exercises.map(e => e.equipment)))];
  const muscleGroupOptions = ['All', ...Array.from(new Set(exercises.map(e => e.muscle_group)))];

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
      'Calves': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Calves.svg',
      'Chest': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Chest.svg',
      'Forearms': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Forearm.svg',
      'Hamstrings': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Hamstrings.svg',
      'Glutes': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Glutes.svg',
      'Quadriceps': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Quadriceps.svg',
      'Legs': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Quadriceps.svg',
      'Shoulders': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Shoulders.svg',
      'Full Body': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Body-with-all-muscles-.svg',
      'Cardio': 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Body-with-all-muscles-.svg',
    };
    return muscleIconMap[muscleGroup] || 'https://mocha-cdn.com/019880ad-ddfc-7388-aaea-be44379029ee/Body-with-all-muscles-.svg';
  };

  const getEquipmentIcon = (equipment: string) => {
    const iconMap: { [key: string]: string } = {
      'Barbell': 'https://mocha-cdn.com/019878d8-20d8-719b-9cd2-81a14bf58f26/barbell-icon.png',
      'Dumbbell': 'https://mocha-cdn.com/019878d8-20d8-719b-9cd2-81a14bf58f26/dumbbell-icon.png',
      'Machine': 'https://mocha-cdn.com/019878d8-20d8-719b-9cd2-81a14bf58f26/machine-icon.png',
      'Bodyweight': 'https://mocha-cdn.com/019878d8-20d8-719b-9cd2-81a14bf58f26/bodyweight-icon.png',
      'Cable': 'https://mocha-cdn.com/019878d8-20d8-719b-9cd2-81a14bf58f26/cable-icon.png',
      'Kettlebell': 'https://mocha-cdn.com/019878d8-20d8-719b-9cd2-81a14bf58f26/kettlebell-icon.png',
      'Resistance Band': 'https://mocha-cdn.com/019878d8-20d8-719b-9cd2-81a14bf58f26/resistance-band-icon.png',
      'Exercise Ball': 'https://mocha-cdn.com/019878d8-20d8-719b-9cd2-81a14bf58f26/exercise-ball-icon.png',
    };
    return iconMap[equipment] || 'https://mocha-cdn.com/019878d8-20d8-719b-9cd2-81a14bf58f26/dumbbell-icon.png';
  };

  const sortOptions = [
    { value: 'favourites', label: 'Favourites (by default)' },
    { value: 'recent', label: 'Recently used' },
    { value: 'most_used', label: 'Mostly Used' },
    { value: 'custom', label: 'Custom exercises' }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-900 text-white max-w-md w-full h-full flex flex-col relative">
        {/* Header */}
        <header className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <h1 className="text-white font-semibold text-lg">
            Select Exercises
          </h1>
          <button
            onClick={handleAddSelectedExercises}
            disabled={addingExercises || selectedExercises.size === 0 || (mode === 'replace' && selectedExercises.size > 1)}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center space-x-2"
          >
            {addingExercises ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Adding...</span>
              </>
            ) : (
              <span>
                {mode === 'replace' ? 'Replace' : 'Add'} ({selectedExercises.size})
              </span>
            )}
          </button>
        </header>

        {/* Main Content */}
        <div className="flex-1 p-4 flex flex-col overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
            </div>
          ) : (
            <>
              {/* Search and Controls */}
              <div className="flex items-center space-x-3 mb-4">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search Exercise"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg py-3 pl-10 pr-10 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-3 w-5 h-5 text-gray-400 hover:text-white transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
                
                {/* Sort Button */}
                <div className="relative flex-shrink-0">
                  <button
                    onClick={() => setShowSortMenu(!showSortMenu)}
                    className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <ArrowUpDown className="w-6 h-6" />
                  </button>
                  
                  {showSortMenu && (
                    <div className="absolute right-0 top-full mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10 min-w-48">
                      <div className="py-2">
                        <div className="px-3 py-2 text-xs text-gray-400 font-medium">SORT BY</div>
                        {sortOptions.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => {
                              setSortBy(option.value as SortOption);
                              setShowSortMenu(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-700 transition-colors ${
                              sortBy === option.value ? 'text-cyan-500' : 'text-white'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Filter Buttons */}
              <div className="flex items-center space-x-3 mb-6">
                {/* Equipment Filter */}
                <div className="relative flex-1">
                  <button
                    onClick={() => setShowEquipmentMenu(!showEquipmentMenu)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg py-3 px-4 text-center text-white hover:border-cyan-500 transition-colors"
                  >
                    <span className="text-sm text-gray-400">Equipment: </span>
                    <span className={selectedEquipment === 'All' ? 'text-gray-400' : 'text-cyan-500'}>
                      {selectedEquipment}
                    </span>
                  </button>
                  
                  {showEquipmentMenu && (
                    <>
                      <div 
                        className="fixed inset-0 bg-black bg-opacity-50 z-40"
                        onClick={() => setShowEquipmentMenu(false)}
                      ></div>
                      <div className="fixed inset-x-4 top-32 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
                        <div className="py-3">
                          <div className="px-4 py-2 text-xs text-gray-400 font-medium uppercase tracking-wide">Select Equipment</div>
                          {equipmentOptions.map(equipment => (
                            <button
                              key={equipment}
                              onClick={() => {
                                setSelectedEquipment(equipment);
                                setShowEquipmentMenu(false);
                              }}
                              className={`w-full flex items-center px-4 py-4 text-base hover:bg-gray-700 transition-colors ${
                                selectedEquipment === equipment ? 'text-cyan-500 bg-gray-750' : 'text-white'
                              }`}
                            >
                              {equipment !== 'All' && (
                                <img 
                                  src={getEquipmentIcon(equipment)} 
                                  alt={equipment}
                                  className="w-6 h-6 mr-3 opacity-70"
                                />
                              )}
                              <span className="flex-1 text-left">{equipment}</span>
                              {selectedEquipment === equipment && (
                                <div className="w-2 h-2 bg-cyan-500 rounded-full ml-2"></div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Muscle Group Filter */}
                <div className="relative flex-1 flex items-center space-x-2">
                  <button
                    onClick={() => setShowMuscleGroupMenu(!showMuscleGroupMenu)}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg py-3 px-4 text-center text-white hover:border-cyan-500 transition-colors"
                  >
                    <span className="text-sm text-gray-400">Muscle: </span>
                    <span className={selectedMuscleGroup === 'All' ? 'text-gray-400' : 'text-cyan-500'}>
                      {selectedMuscleGroup}
                    </span>
                  </button>
                  
                  {(selectedEquipment !== 'All' || selectedMuscleGroup !== 'All') && (
                    <button
                      onClick={() => {
                        setSelectedEquipment('All');
                        setSelectedMuscleGroup('All');
                      }}
                      className="w-8 h-8 bg-white rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors flex-shrink-0"
                    >
                      <X className="w-4 h-4 text-black" />
                    </button>
                  )}
                  
                  {showMuscleGroupMenu && (
                    <>
                      <div 
                        className="fixed inset-0 bg-black bg-opacity-50 z-40"
                        onClick={() => setShowMuscleGroupMenu(false)}
                      ></div>
                      <div className="fixed inset-x-4 top-32 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
                        <div className="py-3">
                          <div className="px-4 py-2 text-xs text-gray-400 font-medium uppercase tracking-wide">Select Muscle Group</div>
                          {muscleGroupOptions.map(muscleGroup => (
                            <button
                              key={muscleGroup}
                              onClick={() => {
                                setSelectedMuscleGroup(muscleGroup);
                                setShowMuscleGroupMenu(false);
                              }}
                              className={`w-full flex items-center px-4 py-4 text-base hover:bg-gray-700 transition-colors ${
                                selectedMuscleGroup === muscleGroup ? 'text-cyan-500 bg-gray-750' : 'text-white'
                              }`}
                            >
                              <span className="flex-1 text-left">{muscleGroup}</span>
                              {selectedMuscleGroup === muscleGroup && (
                                <div className="w-2 h-2 bg-cyan-500 rounded-full ml-2"></div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Exercise List */}
              <div className="flex-1 overflow-y-auto bg-gray-800 rounded-lg border border-gray-700 mb-4">
                {filteredExercises.map((exercise, index) => (
                  <div
                    key={exercise.id}
                    className={`hover:bg-gray-750 transition-colors border-b border-gray-700 last:border-b-0 ${
                      index === 0 ? 'rounded-t-lg' : ''
                    } ${
                      index === filteredExercises.length - 1 ? 'rounded-b-lg' : ''
                    }`}
                  >
                    <div className="flex items-center p-4">
                      {/* Exercise Thumbnail or Icon */}
                      <div className="w-12 h-12 rounded-full overflow-hidden mr-4 flex-shrink-0 bg-gray-700">
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
                      
                      {/* Exercise Info */}
                      <div className="flex-1">
                        <h3 className="font-semibold text-white mb-1">
                          {exercise.name}
                        </h3>
                        <div className="text-sm text-gray-400">
                          ({exercise.muscle_group})
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center space-x-3">
                        <div className="text-right">
                          <div className="text-sm text-gray-400">
                            {formatLastUsed(exercise.last_used_at)}
                          </div>
                        </div>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavourite(exercise.id);
                          }}
                          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          <Star 
                            className={`w-5 h-5 ${
                              exercise.is_favourite 
                                ? 'text-cyan-500 fill-cyan-500' 
                                : 'text-gray-400'
                            }`} 
                          />
                        </button>

                        {/* Select/Deselect Button */}
                        <button
                          onClick={() => toggleSelectExercise(exercise.id)}
                          className={`w-10 h-10 rounded-full border-2 transition-all duration-200 flex items-center justify-center ${
                            selectedExercises.has(exercise.id)
                              ? 'bg-cyan-500 border-cyan-500 text-black'
                              : 'border-gray-600 hover:border-cyan-500 text-gray-400 hover:text-cyan-500'
                          }`}
                        >
                          {selectedExercises.has(exercise.id) ? (
                            <Check className="w-5 h-5" />
                          ) : (
                            <Plus className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {filteredExercises.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <Search className="w-16 h-16 mb-4 opacity-50" />
                    <p className="text-lg mb-2">No exercises found</p>
                    <p className="text-sm text-center">
                      Try adjusting your search or filters
                    </p>
                  </div>
                )}
              </div>

              {/* Cart Status - Show selected count when exercises are selected */}
              {selectedExercises.size > 0 && (
                <div className="w-full bg-gray-800 rounded-lg p-4 border border-gray-700 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ShoppingCart className="w-5 h-5 text-cyan-500" />
                    <div className="text-white font-medium">
                      <div>{selectedExercises.size} Exercise{selectedExercises.size !== 1 ? 's' : ''} Selected</div>
                    </div>
                  </div>
                  <div className="w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center">
                    <span className="text-black text-sm font-semibold">{selectedExercises.size}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
