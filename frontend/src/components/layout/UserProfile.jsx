import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import LogoutModal from '../modals/LogoutModal';

const UserProfile = () => {
  const { user } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogoutClick = () => {
    setShowLogoutModal(true);
  };

  const closeLogoutModal = () => {
    setShowLogoutModal(false);
  };

  if (!user) return null;

  const getInitial = () => {
    return user.username?.charAt(0).toUpperCase() || 'U';
  };

  return (
    <div className="bg-[#0f0f0f] border-t border-gray-900 flex items-center justify-between px-2 py-1.5 flex-shrink-0">
      <div className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-gray-800/50 cursor-pointer transition-colors group flex-1 mr-1">
        {/* Avatar */}
        <div className="relative w-8 h-8 flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-xs font-bold shadow-sm text-white">
            {getInitial()}
          </div>
          {/* Online indicator */}
          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[#0f0f0f] rounded-full flex items-center justify-center">
            <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
          </div>
        </div>

        {/* User Info */}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-xs font-semibold text-white leading-tight truncate">
            {user.username}
          </span>
          <span className="text-[10px] text-gray-400 leading-tight truncate group-hover:text-gray-300">
            {user.handle || '#0000'}
          </span>
        </div>
      </div>

      {/* Logout Button */}
      <button
        onClick={handleLogoutClick}
        className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800/50 rounded transition-colors"
        title="Logout"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      </button>

      {/* Logout Modal */}
      {showLogoutModal && (
        <LogoutModal onClose={closeLogoutModal} />
      )}
    </div>
  );
};

export default UserProfile;