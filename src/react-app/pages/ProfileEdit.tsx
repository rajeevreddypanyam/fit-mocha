import { useState } from 'react';
import { ArrowLeft, Camera, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router';

export default function ProfileEdit() {
  const navigate = useNavigate();
  
  // Form state
  const [name, setName] = useState('John');
  const [bio, setBio] = useState("I'm motivated to do gym on daily basis and most of my day is in gym");
  const [gender, setGender] = useState<'Male' | 'Female'>('Male');
  const [birthday, setBirthday] = useState('1990-10-29');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  

  const handleSave = async () => {
    try {
      // Here you would typically save to your backend API
      const profileData = {
        name,
        bio,
        gender,
        birthday,
        profilePicture
      };
      
      console.log('Saving profile:', profileData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Navigate back to settings
      navigate('/settings');
    } catch (error) {
      console.error('Failed to save profile:', error);
    }
  };

  const handlePictureChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfilePicture(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  

  return (
    <div className="h-full flex flex-col">
      {/* Custom Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700 -m-4 mb-2">
        <button
          onClick={() => navigate('/settings')}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-white font-semibold text-lg tracking-wide">
          Edit Profile
        </h1>
        <button
          onClick={handleSave}
          className="bg-cyan-500 hover:bg-cyan-600 text-black font-semibold py-2 px-4 rounded-lg transition-colors"
        >
          Save
        </button>
      </header>

      <div className="flex-1 overflow-y-auto space-y-6 mt-4">
        {/* Profile Picture Section */}
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center overflow-hidden">
              {profilePicture ? (
                <img 
                  src={profilePicture} 
                  alt="Profile" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
                  <span className="text-2xl">👤</span>
                </div>
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handlePictureChange}
              className="hidden"
              id="profile-picture-input"
            />
          </div>
          <label
            htmlFor="profile-picture-input"
            className="text-cyan-500 font-medium cursor-pointer hover:text-cyan-400 transition-colors flex items-center space-x-2"
          >
            <Camera className="w-4 h-4" />
            <span>Change Picture</span>
          </label>
        </div>

        {/* Form Fields */}
        <div className="space-y-6">
          {/* Name Field */}
          <div>
            <label className="block text-white font-medium mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg py-3 px-4 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500"
              placeholder="Enter your name"
            />
          </div>

          {/* Bio Field */}
          <div>
            <label className="block text-white font-medium mb-2">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg py-3 px-4 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500 resize-none"
              placeholder="Tell us about yourself"
            />
          </div>

          {/* Gender Field */}
          <div>
            <label className="block text-white font-medium mb-3">Gender</label>
            <div className="flex items-center space-x-4">
              <span className={`font-medium ${gender === 'Male' ? 'text-white' : 'text-gray-400'}`}>
                Male
              </span>
              <div 
                onClick={() => setGender(gender === 'Male' ? 'Female' : 'Male')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full cursor-pointer transition-colors ${
                  gender === 'Female' ? 'bg-cyan-500' : 'bg-gray-600'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  gender === 'Female' ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </div>
              <span className={`font-medium ${gender === 'Female' ? 'text-white' : 'text-gray-400'}`}>
                Female
              </span>
            </div>
          </div>

          {/* Birthday Field */}
          <div>
            <label className="block text-white font-medium mb-2">Birthday</label>
            <div className="relative">
              <input
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg py-3 px-4 text-white focus:outline-none focus:border-cyan-500 appearance-none"
                style={{
                  colorScheme: 'dark'
                }}
              />
              <Calendar className="absolute right-3 top-3 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Use calendar to select date input
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
