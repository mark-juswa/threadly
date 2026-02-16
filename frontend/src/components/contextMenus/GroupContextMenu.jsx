const GroupContextMenu = ({ x, y, data, onClose, onCreateNote, onEdit, onDelete }) => {
  const handleEdit = (e) => {
    e.stopPropagation();
    if (onEdit) onEdit(data);
    onClose(true); // Skip document click handler
  };

  const handleAddNote = () => {
    onClose();
    if (onCreateNote) onCreateNote(data.categoryId, data._id);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (onDelete) onDelete(data);
    onClose(true);
  };

  return (
    <div
      className="fixed z-[60] w-52 bg-[#111111] border border-[#2a2a2a] rounded-lg shadow-2xl py-1.5 flex flex-col fade-in"
      style={{ left: `${x}px`, top: `${y}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Title */}
      <div className="px-4 py-2 mb-1 text-xs font-bold tracking-wider text-gray-500 uppercase truncate border-b border-gray-800">
        {data.name}
      </div>

      {/* Edit Group */}
      <button
        onClick={handleEdit}
        className="text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-blue-600 hover:text-white flex items-center gap-3 mx-1.5 rounded transition"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
        Edit Group
      </button>

      {/* Add Note */}
      <button
        onClick={handleAddNote}
        className="text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-blue-600 hover:text-white flex items-center gap-3 mx-1.5 rounded transition"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
        </svg>
        Add Note
      </button>

      {/* Divider */}
      <div className="h-px bg-[#2a2a2a] my-1 mx-2" />

      {/* Delete Group */}
      <button
        onClick={handleDelete}
        className="text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-600 hover:text-white flex items-center gap-3 mx-1.5 rounded transition"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Delete Group
      </button>
    </div>
  );
};

export default GroupContextMenu;
