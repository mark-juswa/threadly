import { useState } from 'react';
import { useNotes } from '../../hooks/useNotes';

const DeleteModal = ({ type, data, onClose }) => {
  const { deleteTopic, deleteCategory, deleteGroup, deleteNote } = useNotes();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const getTitle = () => {
    switch (type) {
      case 'topic': return 'Delete Topic';
      case 'category': return 'Delete Category';
      case 'group': return 'Delete Group';
      case 'note': return 'Delete Note';
      default: return 'Delete';
    }
  };

  const getName = () => {
    return data?.name || data?.title || 'this item';
  };

  const getMessage = () => {
    switch (type) {
      case 'topic':
        return 'This will permanently delete all categories, groups, and notes inside this topic.';
      case 'category':
        return 'This will permanently delete all groups and notes inside this category.';
      case 'group':
        return 'Notes inside this group will be moved to the parent category.';
      case 'note':
        return 'This note will be permanently deleted.';
      default:
        return 'This action cannot be undone.';
    }
  };

  const getIcon = () => {
    return (
      <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    );
  };

  const handleDelete = async () => {
    setError('');
    setLoading(true);

    try {
      let result;

      switch (type) {
        case 'topic':
          result = await deleteTopic(data._id);
          break;
        case 'category':
          result = await deleteCategory(data._id);
          break;
        case 'group':
          result = await deleteGroup(data._id);
          break;
        case 'note':
          result = await deleteNote(data._id);
          break;
        default:
          throw new Error('Unknown type');
      }

      if (result?.success !== false) {
        onClose();
      } else {
        setError(result?.error || 'Delete failed');
      }
    } catch (err) {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 fade-in">
      <div className="bg-[#1c1c1c] w-full max-w-[400px] rounded-2xl p-6 shadow-2xl border border-gray-800">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
            {getIcon()}
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-2">
          <h3 className="text-white text-lg font-semibold">{getTitle()}</h3>
        </div>

        {/* Item Name */}
        <div className="text-center mb-4">
          <span className="text-gray-300 font-medium">"{getName()}"</span>
        </div>

        {/* Warning Message */}
        <div className="text-center mb-6">
          <p className="text-gray-500 text-sm">{getMessage()}</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm text-center">
            {error}
          </div>
        )}

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
            onClick={handleDelete}
            className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteModal;
