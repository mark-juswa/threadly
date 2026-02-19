import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

const LogoutModal = ({ onClose }) => {
  const { logout } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logout();
      onClose();
    } catch (err) {
      // Even if logout fails, close the modal
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 fade-in">
      <div className="bg-[#1c1c1c] w-full max-w-[360px] rounded-2xl p-6 shadow-2xl border border-gray-800">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-full bg-orange-500/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-2">
          <h3 className="text-white text-lg font-semibold">Log Out</h3>
        </div>

        {/* Message */}
        <div className="text-center mb-6">
          <p className="text-gray-500 text-sm">Are you sure you want to log out of your account?</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white transition font-medium"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="flex-1 px-4 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? 'Logging out...' : 'Log Out'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogoutModal;
