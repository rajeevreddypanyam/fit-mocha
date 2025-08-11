import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Camera, Image, X } from 'lucide-react';

interface ExerciseForm {
  name: string;
  equipment: string;
  primaryMuscle: string;
  otherMuscles: string[];
  exerciseType: string;
  image: File | null;
  imagePreview: string | null;
}

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

export default function EditExercise() {
  const navigate = useNavigate();
  const { id } = useParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  
  const [form, setForm] = useState<ExerciseForm>({
    name: '',
    equipment: '',
    primaryMuscle: '',
    otherMuscles: [],
    exerciseType: '',
    image: null,
    imagePreview: null
  });

  // Equipment options
  const equipmentOptions = [
    'Bodyweight',
    'Barbell',
    'Dumbbell',
    'Cable Machine',
    'Resistance Band',
    'Kettlebell',
    'Machine',
    'Medicine Ball',
    'Pull-up Bar',
    'Suspension Trainer',
    'Foam Roller',
    'Other'
  ];

  // Muscle group options
  const muscleOptions = [
    'Chest',
    'Back',
    'Shoulders',
    'Arms',
    'Biceps',
    'Triceps',
    'Forearms',
    'Abs',
    'Core',
    'Legs',
    'Quadriceps',
    'Hamstrings',
    'Calves',
    'Glutes',
    'Full Body',
    'Cardio'
  ];

  // Exercise type options
  const exerciseTypeOptions = [
    'Strength',
    'Cardio',
    'Flexibility',
    'Balance',
    'Plyometric',
    'Endurance',
    'Power',
    'Rehabilitation',
    'Warm-up',
    'Cool-down'
  ];

  useEffect(() => {
    if (id) {
      fetchExercise(parseInt(id));
    }
  }, [id]);

  const fetchExercise = async (exerciseId: number) => {
    try {
      const response = await fetch(`/api/exercises/${exerciseId}`);
      if (response.ok) {
        const data = await response.json();
        if (!data.is_custom) {
          // Redirect to exercise details if not custom
          navigate(`/exercises/${exerciseId}`);
          return;
        }
        setExercise(data);
        
        // Parse instructions to extract other muscles (basic parsing)
        const otherMuscles: string[] = [];
        if (data.instructions.includes(' and ')) {
          const parts = data.instructions.split(' and ');
          if (parts.length > 1) {
            const musclesPart = parts[1].split('.')[0];
            const muscles = musclesPart.split(', ').map((m: string) => m.trim());
            otherMuscles.push(...muscles.filter((m: string) => muscleOptions.includes(m)));
          }
        }
        
        setForm({
          name: data.name,
          equipment: data.equipment,
          primaryMuscle: data.muscle_group,
          otherMuscles: otherMuscles,
          exerciseType: data.category,
          image: null,
          imagePreview: null
        });
      }
    } catch (error) {
      console.error('Failed to fetch exercise:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setForm(prev => ({
          ...prev,
          image: file,
          imagePreview: e.target?.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setForm(prev => ({
      ...prev,
      image: null,
      imagePreview: null
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!form.name.trim() || !form.equipment || !form.primaryMuscle || !form.exerciseType) {
      alert('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Create the exercise data
      const exerciseData = {
        name: form.name.trim(),
        category: form.exerciseType,
        muscle_group: form.primaryMuscle,
        equipment: form.equipment,
        instructions: `${form.exerciseType} exercise targeting ${form.primaryMuscle}${form.otherMuscles.length > 0 ? ` and ${form.otherMuscles.join(', ')}` : ''}.`,
        is_custom: true
      };

      const response = await fetch(`/api/exercises/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exerciseData),
      });

      if (response.ok) {
        navigate(`/exercises/${id}`);
      } else {
        throw new Error('Failed to update exercise');
      }
    } catch (error) {
      console.error('Error updating exercise:', error);
      alert('Failed to update exercise. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
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

  return (
    <div className="h-full flex flex-col">
      {/* Custom Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700 -m-4 mb-2">
        <button
          onClick={() => navigate(`/exercises/${id}`)}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-white font-semibold text-lg tracking-wide">
          Edit Exercise
        </h1>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !form.name.trim() || !form.equipment || !form.primaryMuscle || !form.exerciseType}
          className="bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-semibold py-2 px-4 rounded-lg transition-colors"
        >
          {isSubmitting ? 'Updating...' : 'Update'}
        </button>
      </header>

      {/* Form */}
      <div className="flex-1 overflow-y-auto space-y-6 mt-4">
        {/* Exercise Image */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Exercise Image
          </label>
          
          {form.imagePreview ? (
            <div className="relative">
              <img
                src={form.imagePreview}
                alt="Exercise preview"
                className="w-full h-48 object-cover rounded-lg bg-gray-800"
              />
              <button
                type="button"
                onClick={removeImage}
                className="absolute top-2 right-2 p-1 bg-black bg-opacity-50 rounded-full hover:bg-opacity-70 transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center">
              <div className="flex flex-col items-center space-y-4">
                <div className="flex space-x-4">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg transition-colors"
                  >
                    <Image className="w-5 h-5" />
                    <span>Gallery</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg transition-colors"
                  >
                    <Camera className="w-5 h-5" />
                    <span>Camera</span>
                  </button>
                </div>
                <p className="text-gray-400 text-sm">Add a photo of the exercise</p>
              </div>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageUpload}
            className="hidden"
          />
        </div>

        {/* Exercise Name */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Exercise Name *
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Enter exercise name"
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500"
            required
          />
        </div>

        {/* Equipment */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Equipment *
          </label>
          <select
            value={form.equipment}
            onChange={(e) => setForm(prev => ({ ...prev, equipment: e.target.value }))}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500"
            required
          >
            <option value="">Select equipment</option>
            {equipmentOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        {/* Primary Muscle Group */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Primary Muscle Group *
          </label>
          <select
            value={form.primaryMuscle}
            onChange={(e) => setForm(prev => ({ ...prev, primaryMuscle: e.target.value }))}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500"
            required
          >
            <option value="">Select primary muscle</option>
            {muscleOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        {/* Other Muscles (Optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Other Muscles (Optional)
          </label>
          <select
            multiple
            value={form.otherMuscles}
            onChange={(e) => {
              const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
              setForm(prev => ({ ...prev, otherMuscles: selectedOptions }));
            }}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500 min-h-[120px]"
          >
            {muscleOptions.filter(muscle => muscle !== form.primaryMuscle).map(option => (
              <option key={option} value={option} className="py-2">
                {option}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">Hold Ctrl/Cmd to select multiple muscles</p>
        </div>

        {/* Exercise Type */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Exercise Type *
          </label>
          <select
            value={form.exerciseType}
            onChange={(e) => setForm(prev => ({ ...prev, exerciseType: e.target.value }))}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500"
            required
          >
            <option value="">Select exercise type</option>
            {exerciseTypeOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        </div>
    </div>
  );
}
