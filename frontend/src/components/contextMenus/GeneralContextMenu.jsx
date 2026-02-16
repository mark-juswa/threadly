import { useNotes } from '../../hooks/useNotes';

const GeneralContextMenu = ({ x, y, onClose, onCreateCategory, onCreateTopic, onCreateOrphanNote }) => {
  const { currentTopic } = useNotes();

  const handleCreateCategory = () => {
    onClose();
    onCreateCategory?.();
  };

  const handleCreateTopic = () => {
    onClose();
    onCreateTopic?.();
  };

  const handleCreateOrphanNote = () => {
    onClose();
    onCreateOrphanNote?.();
  };

  // If no topic is selected, show option to create a topic instead
  const noTopicSelected = !currentTopic;

  return (
    <div
      className="fixed z-[60] w-52 bg-[#111111] border border-[#2a2a2a] rounded-lg shadow-2xl py-1.5 flex flex-col fade-in"
      style={{ left: `${x}px`, top: `${y}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      {noTopicSelected ? (
        <>
          {/* No topic selected - guide user to create one */}
          <div className="px-4 py-2 mb-1 text-xs text-gray-500 border-b border-gray-800">
            No topic selected
          </div>
          <button
            onClick={handleCreateTopic}
            className="text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-green-600 hover:text-white flex items-center gap-3 transition mx-1.5 rounded"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Create New Topic
          </button>
        </>
      ) : (
        <>
          {/* Topic selected - can create category or orphan note */}
          <button
            onClick={handleCreateCategory}
            className="text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-green-600 hover:text-white flex items-center gap-3 transition mx-1.5 rounded"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Create New Category
          </button>
          
          <button
            onClick={handleCreateOrphanNote}
            className="text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-blue-600 hover:text-white flex items-center gap-3 transition mx-1.5 rounded"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Create New Note
          </button>
        </>
      )}
    </div>
  );
};

export default GeneralContextMenu;