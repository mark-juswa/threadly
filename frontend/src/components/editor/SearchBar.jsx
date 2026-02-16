import { useState, useRef } from 'react';

const SearchBar = () => {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const [showControls, setShowControls] = useState(false);

  const performSearch = (searchQuery) => {
    const editor = document.getElementById('editor');
    if (!editor) return;

    // Clear previous highlights
    clearHighlights();

    if (!searchQuery) {
      setShowControls(false);
      setMatches([]);
      setCurrentMatchIndex(-1);
      return;
    }

    const content = editor.innerHTML;
    const regex = new RegExp(`(${searchQuery})`, 'gi');

    if (!content.match(regex)) {
      setShowControls(true);
      setMatches([]);
      setCurrentMatchIndex(-1);
      return;
    }

    // Add highlights
    const newContent = content.replace(regex, '<span class="search-highlight">$1</span>');
    editor.innerHTML = newContent;

    const highlightElements = editor.querySelectorAll('.search-highlight');
    setMatches(Array.from(highlightElements));
    
    if (highlightElements.length > 0) {
      setCurrentMatchIndex(0);
      highlightActiveMatch(highlightElements, 0);
      setShowControls(true);
    }
  };

  const clearHighlights = () => {
    const editor = document.getElementById('editor');
    if (!editor) return;

    const highlights = editor.querySelectorAll('.search-highlight');
    highlights.forEach(span => {
      const parent = span.parentNode;
      parent.replaceChild(document.createTextNode(span.textContent), span);
      parent.normalize();
    });
  };

  const highlightActiveMatch = (matchElements, index) => {
    matchElements.forEach((m, i) => {
      if (i === index) {
        m.classList.add('active');
        m.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        m.classList.remove('active');
      }
    });
  };

  const navigateSearch = (direction) => {
    if (matches.length === 0) return;

    let newIndex = currentMatchIndex + direction;
    if (newIndex >= matches.length) newIndex = 0;
    if (newIndex < 0) newIndex = matches.length - 1;

    setCurrentMatchIndex(newIndex);
    highlightActiveMatch(matches, newIndex);
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    performSearch(value);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Search Controls */}
      {showControls && (
        <div className="flex items-center bg-[#262626] rounded-full px-2 py-1 gap-1 border border-gray-700 h-9 transition-all fade-in">
          <span className="text-[10px] text-gray-400 px-1 font-mono">
            {matches.length > 0 ? `${currentMatchIndex + 1}/${matches.length}` : '0/0'}
          </span>
          <div className="w-px h-3 bg-gray-600" />
          <button
            onClick={() => navigateSearch(-1)}
            className="p-1 hover:text-white text-gray-400 transition"
            title="Previous"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            onClick={() => navigateSearch(1)}
            className="p-1 hover:text-white text-gray-400 transition"
            title="Next"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      )}

      {/* Search Input */}
      <div className="relative flex items-center justify-end">
        <div className="relative flex items-center">
          <svg className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none z-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={handleSearchChange}
            placeholder="Search..."
            className="bg-[#262626] text-white rounded-full h-10 w-10 focus:w-64 transition-all duration-300 ease-in-out pl-10 pr-4 outline-none cursor-pointer focus:cursor-text placeholder-transparent focus:placeholder-gray-500 shadow-lg text-sm z-10 border border-transparent focus:border-gray-700"
          />
        </div>
      </div>
    </div>
  );
};

export default SearchBar;