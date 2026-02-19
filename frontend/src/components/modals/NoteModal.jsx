import { useState } from 'react';
import { useNotes } from '../../hooks/useNotes';
import { uploadService } from '../../api/uploadService';

const NoteModal = ({ type = 'note', mode = 'create', onClose, data = null }) => {
  const { createTopic, createCategory, createNote, createGroup, updateTopic, currentTopic } = useNotes();
  
  const isEditMode = mode === 'edit';
  const [name, setName] = useState(data?.name || data?.title || '');
  const [icon, setIcon] = useState(data?.icon || '');
  const [iconPreview, setIconPreview] = useState(isEditMode && data?.icon ? data.icon : null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newIconUploaded, setNewIconUploaded] = useState(false);

  const handleIconUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const result = await uploadService.uploadImage(file);
        const imageUrl = uploadService.getImageUrl(result.imageUrl);
        setIcon(imageUrl);
        setNewIconUploaded(true);
        
        const reader = new FileReader();
        reader.onload = (evt) => setIconPreview(evt.target.result);
        reader.readAsDataURL(file);
      } catch (error) {
        setError('Failed to upload icon');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let result;

      if (type === 'topic') {
        if (isEditMode) {
          // When editing, only update icon if a new one was uploaded
          const updateData = { name };
          if (newIconUploaded) {
            updateData.icon = icon;
          }
          result = await updateTopic(data._id, updateData);
        } else {
          result = await createTopic({ name, icon });
        }
      } else if (type === 'category') {
        if (!currentTopic) {
          setError('Please select a topic first');
          setLoading(false);
          return;
        }
        result = await createCategory({ name, topicId: currentTopic._id });
      } else if (type === 'note') {
        if (!currentTopic) {
          setError('Please select a topic first');
          setLoading(false);
          return;
        }
        result = await createNote({
          title: name,
          content: '',
          topicId: currentTopic._id,
          categoryId: data?.categoryId || null,
          groupId: data?.groupId || null,
        });
      } else if (type === 'group') {
        if (!currentTopic || !data?.categoryId) {
          setError('Invalid context for group creation');
          setLoading(false);
          return;
        }
        result = await createGroup({
          name,
          categoryId: data.categoryId,
          topicId: currentTopic._id,
        });
      } else if (type === 'subgroup') {
        if (!currentTopic || !data?.categoryId || !data?.parentGroupId) {
          setError('Invalid context for subgroup creation');
          setLoading(false);
          return;
        }
        result = await createGroup({
          name,
          categoryId: data.categoryId,
          topicId: currentTopic._id,
          parentGroupId: data.parentGroupId,
        });
      }

      if (result.success) {
        onClose();
      } else {
        setError(result.error || 'Operation failed');
      }
    } catch (err) {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    if (type === 'topic') return isEditMode ? 'Edit Topic' : 'Create Topic';
    if (type === 'category') return 'Create Category';
    if (type === 'note') return 'Create Note';
    if (type === 'group') return 'Create Group';
    if (type === 'subgroup') return 'Create Subgroup';
    return 'Create';
  };

  const getPlaceholder = () => {
    if (type === 'topic') return 'Topic Name (e.g., BTC)';
    if (type === 'category') return 'Category Name (e.g., Finance)';
    if (type === 'note') return 'Note Title';
    if (type === 'group') return 'Group Name';
    if (type === 'subgroup') return 'Subgroup Name';
    return 'Name';
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 fade-in">
      <div className="bg-[#1c1c1c] w-full max-w-[400px] rounded-2xl p-6 shadow-2xl border border-gray-800">
        {/* Title */}
        <div className="text-center mb-6">
          <h3 className="text-white text-lg font-semibold mb-2">{getTitle()}</h3>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Icon Upload (only for topics) */}
          {type === 'topic' && (
            <div className="flex justify-center mb-6">
              <input
                type="file"
                id="icon-upload"
                className="hidden"
                accept="image/*"
                onChange={handleIconUpload}
              />
              <div
                onClick={() => document.getElementById('icon-upload').click()}
                className="relative w-24 h-24 rounded-full border-2 border-dashed border-gray-600 flex flex-col items-center justify-center cursor-pointer hover:border-white transition group overflow-hidden bg-[#121212]"
              >
                {iconPreview || icon ? (
                  <img src={iconPreview || icon} alt="Icon" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center">
                    <svg className="w-8 h-8 text-gray-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-[10px] font-bold text-white group-hover:scale-110 transition">Upload</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Name Input */}
          <div className="mb-6">
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
              disabled={loading}
            >
              {loading ? (isEditMode ? 'Saving...' : 'Creating...') : (isEditMode ? 'Save' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NoteModal;