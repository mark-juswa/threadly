const CategoryContextMenu = ({ x, y, data, onClose, onCreateNote, onCreateGroup, onEdit, onDelete, showAddSubtopic = false }) => {
  const handleDelete = (e) => {
    e.stopPropagation();
    if (onDelete) onDelete(data);
    onClose(true);
  };

  const handleAddSubtopic = () => {
    onClose();
    onCreateNote(data._id);
  };

  const handleAddGroup = () => {
    onClose();
    onCreateGroup(data._id);
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    if (onEdit) onEdit(data);
    onClose(true); // Skip document click handler
  };

  return (
    <div
      className="fixed z-[60] w-52 bg-[#111111] border border-[#2a2a2a] rounded-lg shadow-2xl py-1.5 flex flex-col fade-in"
      style={{ left: `${x}px`, top: `${y}px` }}
      onClick={(e) => e.stopPropagation()}
    >
        {/* Edit Category */}
        <button
          onClick={handleEdit}
          className="text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-green-600 hover:text-white flex items-center gap-3 mx-1.5 rounded transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          Edit Category
        </button>

        {/* Add Subtopic */}
        <button
          onClick={handleAddSubtopic}
          className="text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-green-600 hover:text-white flex items-center gap-3 mx-1.5 rounded transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Note
        </button>

        {/* Create Group */}
        <button
          onClick={handleAddGroup}
          className="text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-green-600 hover:text-white flex items-center gap-3 mx-1.5 rounded transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Create Group
        </button>

        {/* Divider */}
        <div className="h-px bg-[#2a2a2a] my-1 mx-2" />

        {/* Delete Category */}
        <button
          onClick={handleDelete}
          className="text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-600 hover:text-white flex items-center gap-3 mx-1.5 rounded transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete Category
        </button>
      </div>
    );
};

export default CategoryContextMenu;