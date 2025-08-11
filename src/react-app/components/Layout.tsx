import { ReactNode } from 'react';
import { Settings, Dumbbell, History, ArrowLeft } from 'lucide-react';
import { useNavigate, useLocation, useSearchParams } from 'react-router';
import { useSettings } from '@/react-app/hooks/useSettings';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({
  children
}: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { settings } = useSettings();

  const getHeaderConfig = () => {
    const path = location.pathname;
    
    if (path === '/') {
      return {
        leftElement: (
          <div className="w-8 h-8 bg-cyan-500 rounded flex items-center justify-center">
            <span className="text-black font-bold text-sm">FT</span>
          </div>
        ),
        centerTitle: 'Home',
        showSettings: true,
        hideHeader: false,
        hideFooter: false
      };
    }
    
    if (path === '/settings') {
      const returnTo = searchParams.get('returnTo') || '/';
      return {
        leftElement: (
          <button
            onClick={() => navigate(returnTo)}
            className={`p-2 rounded-lg transition-colors ${
              settings.theme === 'dark' 
                ? 'hover:bg-gray-700' 
                : 'hover:bg-gray-100'
            }`}
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
        ),
        centerTitle: 'Settings',
        showSettings: false,
        hideHeader: false,
        hideFooter: false
      };
    }
    
    if (path === '/exercises') {
      return {
        leftElement: (
          <button
            onClick={() => navigate('/')}
            className={`p-2 rounded-lg transition-colors ${
                  settings.theme === 'dark' 
                    ? 'hover:bg-gray-700' 
                    : 'hover:bg-gray-100'
                }`}
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
        ),
        centerTitle: 'Exercise List',
        showSettings: true,
        hideHeader: false,
        hideFooter: false
      };
    }
    
    if (path.startsWith('/exercises/') && path.endsWith('/edit')) {
      // Hide header for edit exercise page as it has its own custom header
      return {
        leftElement: null,
        centerTitle: '',
        showSettings: false,
        hideHeader: true,
        hideFooter: true
      };
    }
    
    if (path === '/exercises/new') {
      return {
        leftElement: (
          <button
            onClick={() => navigate('/exercises')}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
        ),
        centerTitle: 'Add Exercise',
        showSettings: false,
        hideHeader: false,
        hideFooter: true
      };
    }
    
    if (path.startsWith('/exercises/')) {
      const returnTo = searchParams.get('returnTo') || '/exercises';
      return {
        leftElement: (
          <button
            onClick={() => navigate(returnTo)}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
        ),
        centerTitle: '',
        showSettings: true,
        hideHeader: false,
        hideFooter: false
      };
    }
    
    if (path === '/history') {
      return {
        leftElement: (
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
        ),
        centerTitle: 'Workout History',
        showSettings: true,
        hideHeader: false,
        hideFooter: false
      };
    }
    
    if (path === '/profile/edit') {
      return {
        leftElement: null,
        centerTitle: '',
        showSettings: false,
        hideHeader: true,
        hideFooter: true
      };
    }
    
    if (path === '/workout/start') {
      return {
        leftElement: null,
        centerTitle: 'Active Workout',
        showSettings: false,
        hideHeader: true,
        hideFooter: true
      };
    }
    
    if (path === '/workout/select-exercises') {
      return {
        leftElement: null,
        centerTitle: '',
        showSettings: false,
        hideHeader: true,
        hideFooter: true
      };
    }
    
    if (path.startsWith('/workout/exercise/')) {
      return {
        leftElement: null,
        centerTitle: '',
        showSettings: false,
        hideHeader: true,
        hideFooter: true
      };
    }
    
    if (path === '/workout/summary') {
      return {
        leftElement: null,
        centerTitle: '',
        showSettings: false,
        hideHeader: true,
        hideFooter: true
      };
    }
    
    if (path.startsWith('/workouts/')) {
      return {
        leftElement: null,
        centerTitle: '',
        showSettings: false,
        hideHeader: true,
        hideFooter: true
      };
    }
    
    // Default config for other pages
    return {
      leftElement: (
        <button
          onClick={() => navigate('/')}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
      ),
      centerTitle: '',
      showSettings: true,
      hideHeader: false,
      hideFooter: false
    };
  };

  const headerConfig = getHeaderConfig();

  return <div className={`min-h-screen flex flex-col max-w-md mx-auto ${
    settings.theme === 'dark' 
      ? 'bg-gray-900 text-white' 
      : 'bg-zinc-50 text-gray-900'
  }`}>
      {/* Header */}
      {!headerConfig.hideHeader && (
        <header className={`sticky top-0 z-50 flex items-center justify-between p-4 ${
          settings.theme === 'dark' 
            ? 'bg-gray-800 border-gray-700 shadow-2xl shadow-black/50' 
            : 'bg-white border-gray-200 shadow-2xl shadow-gray-900/20'
        } border-b backdrop-blur-lg`}>
          <div className="flex items-center">
            {headerConfig.leftElement}
          </div>
          <h1 className={`font-semibold text-lg tracking-wide ${
            settings.theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            {headerConfig.centerTitle}
          </h1>
          <div className="flex items-center">
            {headerConfig.showSettings ? (
              <button 
                onClick={() => {
                  // Pass the current path as returnTo parameter
                  const currentPath = location.pathname + location.search;
                  navigate(`/settings?returnTo=${encodeURIComponent(currentPath)}`);
                }} 
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <Settings className="w-6 h-6" />
              </button>
            ) : (
              <div className="w-10 h-10"></div> // Spacer to maintain layout balance
            )}
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className={`flex-1 ${headerConfig.hideHeader ? 'p-0' : 'p-4'}`}>
        {children}
      </main>

      {/* Bottom Navigation */}
      {!headerConfig.hideFooter && (
        <nav className={`sticky bottom-0 z-50 flex items-center justify-between p-4 ${
          settings.theme === 'dark' 
            ? 'bg-gray-800 border-gray-700 shadow-2xl shadow-black/50' 
            : 'bg-white border-gray-200 shadow-2xl shadow-gray-900/20'
        } border-t backdrop-blur-lg`}>
          <button onClick={() => navigate('/')} className={`p-3 rounded-lg transition-colors ${
            location.pathname === '/' 
              ? 'bg-cyan-500 text-black' 
              : settings.theme === 'dark' 
                ? 'text-gray-400 hover:text-white' 
                : 'text-gray-600 hover:text-gray-900'
          }`}>
            <Dumbbell className="w-6 h-6" />
          </button>
          <button onClick={() => navigate('/history')} className={`p-3 rounded-lg transition-colors ${
            location.pathname === '/history' 
              ? 'bg-cyan-500 text-black' 
              : settings.theme === 'dark' 
                ? 'text-gray-400 hover:text-white' 
                : 'text-gray-600 hover:text-gray-900'
          }`}>
            <History className="w-6 h-6" />
          </button>
        </nav>
      )}
    </div>;
}
