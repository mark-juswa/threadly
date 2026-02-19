import { useNotes } from '../../hooks/useNotes';

const TopicSidebar = ({ showContextMenu, onCreateTopic }) => {
  const { topics, currentTopic, setCurrentTopic } = useNotes();

  const handleTopicClick = (topic) => {
    setCurrentTopic(topic);
  };

  const handleTopicContextMenu = (e, topic) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e, 'topic', topic);
  };

  return (
    <aside className="w-20 bg-black border-r border-[#222225] flex flex-col items-center py-6 flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center justify-center w-12 h-12 mb-8 text-xs font-bold text-black transition bg-gray-200 rounded-lg shadow-lg cursor-pointer hover:bg-white shadow-white/10">
        <img src="/Logo3.png" alt="" />
      </div>

      {/* Topic Buttons */}
      <div className="flex flex-col items-center flex-1 w-full gap-4 px-2 overflow-y-auto no-scrollbar">
        {topics.map((topic) => (
          <button
            key={topic._id}
            onClick={() => handleTopicClick(topic)}
            onContextMenu={(e) => handleTopicContextMenu(e, topic)}
            className={`w-12 h-12 rounded-xl text-black font-bold text-[10px] flex items-center justify-center hover:bg-gray-200 hover:scale-105 transition duration-200 shadow-md ${
              currentTopic?._id === topic._id
                ? 'bg-gray-100 ring-2 ring-green-500'
                : 'bg-white'
            }`}
            title={topic.name}
          >
            {topic.icon ? (
              topic.icon.startsWith('http') ? (
                <img src={topic.icon} alt={topic.name} className="object-cover w-full h-full rounded-xl" />
              ) : (
                <span className="text-2xl">{topic.icon}</span>
              )
            ) : (
              <span>{topic.name.substring(0, 3).toUpperCase()}</span>
            )}
          </button>
        ))}
      </div>

      {/* Add Topic Button */}
      <button
        onClick={onCreateTopic}
        className="flex items-center justify-center w-10 h-10 mt-4 transition bg-gray-800 rounded-lg hover:bg-gray-700 hover:text-green-400"
        title="Add Topic"
      >
        <svg
          className="w-6 h-6 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 4v16m8-8H4"
          />
        </svg>
      </button>
    </aside>
  );
};

export default TopicSidebar;