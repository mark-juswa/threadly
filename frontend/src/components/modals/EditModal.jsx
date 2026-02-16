import { useState } from 'react';
import { useNotes } from '../../hooks/useNotes';

const EditModal = ({ type, data, onClose }) => {
  const { updateCategory, updateGroup, updateNote, updateTopic } = useNotes();
  
  const [name, setName] = useState(data?.name || data?.title || '');
  const [icon, setIcon] = useState(data?.icon || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let result;

      if (type === 'topic') {
        result = await updateTopic(data._id, { name, icon });
      } else if (type === 'category') {
        result = await updateCategory(data._id, { name });
      } else if (type === 'group') {
        result = await updateGroup(data._id, { name });
      } else if (type === 'note') {
        result = await updateNote(data._id, { title: name });
      }

      if (result.success) {
        onClose();
      } else {
        setError(result.error || 'Update failed');
      }
    } catch (err) {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    if (type === 'topic') return 'Edit Topic';
    if (type === 'category') return 'Edit Category';
    if (type === 'group') return 'Edit Group';
    if (type === 'note') return 'Edit Note';
    return 'Edit';
  };

  const getPlaceholder = () => {
    if (type === 'topic') return 'Topic Name';
    if (type === 'category') return 'Category Name';
    if (type === 'group') return 'Group Name';
    if (type === 'note') return 'Note Title';
    return 'Name';
  };

  const getIcon = () => {
    if (type === 'topic') {
      return (
        <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      );
    }
    if (type === 'category') {
      return (
        <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      );
    }
    if (type === 'group') {
      return (
        <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      );
    }
    if (type === 'note') {
      return (
        <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 fade-in">
      <div className="bg-[#1c1c1c] w-full max-w-[400px] rounded-2xl p-6 shadow-2xl border border-gray-800">
        {/* Header with Icon */}
        <div className="flex items-center justify-center gap-3 mb-6">
          {getIcon()}
          <h3 className="text-white text-lg font-semibold">{getTitle()}</h3>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Name Input */}
          <div className="mb-4">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={getPlaceholder()}
              className="w-full bg-[#121212] text-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-1 focus:ring-green-500 text-sm"
              required
              disabled={loading}
              autoFocus
            />
          </div>

          {/* Icon Input - Only for Topics */}
          {type === 'topic' && (
            <div className="mb-6">
              <label className="block text-gray-400 text-xs mb-2">Icon (emoji or image URL)</label>
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="🚀 or https://example.com/icon.png"
                className="w-full bg-[#121212] text-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm"
                disabled={loading}
              />
              {/* Icon Preview */}
              {icon && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-gray-400 text-xs">Preview:</span>
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                    {icon.startsWith('http') ? (
                      <img src={icon} alt="Icon" className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <span className="text-2xl">{icon}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between">
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-white transition"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-green-600 hover:bg-green-500 text-white font-bold px-6 py-2 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading || !name.trim()}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditModal;
