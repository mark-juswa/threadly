import { useAuth } from './hooks/useAuth';
import LoginView from './components/auth/LoginView';
import MainApp from './components/layout/MainApp';

function App() {
  const { isAuthenticated, loading } = useAuth();

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login if not authenticated, otherwise show main app
  return (
    <div className="h-screen w-screen overflow-hidden">
      {!isAuthenticated ? <LoginView /> : <MainApp />}
    </div>
  );
}

export default App;