import { useState, useEffect, useCallback } from 'react';
import { useNotes } from '../../hooks/useNotes';

const EditorOutlineSidebar = ({ editorRef }) => {
  const { currentNote } = useNotes();
  const [outlineItems, setOutlineItems] = useState([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeId, setActiveId] = useState(null);

  // Extract outline items from editor content
  const extractOutlineItems = useCallback(() => {
    if (!editorRef?.current) return [];

    const items = [];
    const editor = editorRef.current;

    // Extract headings (H1, H2, H3)
    const headings = editor.querySelectorAll('h1, h2, h3');
    headings.forEach((heading, index) => {
      const id = `heading-${index}`;
      // Add id to the element for scrolling
      heading.setAttribute('data-outline-id', id);
      
      items.push({
        id,
        type: heading.tagName.toLowerCase(),
        text: heading.textContent.trim().slice(0, 50) || 'Untitled',
        element: heading,
        icon: getHeadingIcon(heading.tagName.toLowerCase()),
      });
    });

    // Extract highlighted/marked text
    const highlights = editor.querySelectorAll('mark, .highlight, [style*="background"]');
    highlights.forEach((highlight, index) => {
      const text = highlight.textContent.trim();
      if (text && text.length > 2) {
        const id = `highlight-${index}`;
        highlight.setAttribute('data-outline-id', id);
        
        items.push({
          id,
          type: 'highlight',
          text: text.slice(0, 40) + (text.length > 40 ? '...' : ''),
          element: highlight,
          icon: (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          ),
        });
      }
    });

    return items;
  }, [editorRef]);

  // Get icon for heading type
  const getHeadingIcon = (type) => {
    const baseClass = "font-bold text-xs";
    switch (type) {
      case 'h1':
        return <span className={`${baseClass} text-gray-300`}>H1</span>;
      case 'h2':
        return <span className={`${baseClass} text-gray-400`}>H2</span>;
      case 'h3':
        return <span className={`${baseClass} text-gray-500`}>H3</span>;
      default:
        return null;
    }
  };

  // Get indent level for heading type
  const getIndentLevel = (type) => {
    switch (type) {
      case 'h1': return 'pl-0';
      case 'h2': return 'pl-3';
      case 'h3': return 'pl-6';
      case 'highlight': return 'pl-0';
      default: return 'pl-0';
    }
  };

  // Scroll to element when clicked
  const handleItemClick = (item) => {
    if (item.element) {
      item.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setActiveId(item.id);
      
      // Highlight effect
      item.element.classList.add('outline-highlight-flash');
      setTimeout(() => {
        item.element.classList.remove('outline-highlight-flash');
      }, 1500);
    }
  };

  // Update outline when content changes
  useEffect(() => {
    const updateOutline = () => {
      const items = extractOutlineItems();
      setOutlineItems(items);
    };

    // Initial extraction
    updateOutline();

    // Set up MutationObserver to watch for content changes
    if (editorRef?.current) {
      const observer = new MutationObserver(() => {
        // Debounce updates
        setTimeout(updateOutline, 300);
      });

      observer.observe(editorRef.current, {
        childList: true,
        subtree: true,
        characterData: true,
      });

      return () => observer.disconnect();
    }
  }, [editorRef, extractOutlineItems, currentNote]);

  // Reset outline when note changes
  useEffect(() => {
    setActiveId(null);
    // Small delay to allow editor content to load
    const timer = setTimeout(() => {
      const items = extractOutlineItems();
      setOutlineItems(items);
    }, 100);
    return () => clearTimeout(timer);
  }, [currentNote?._id, extractOutlineItems]);

  // Don't render if no note is selected
  if (!currentNote) {
    return null;
  }

  const headings = outlineItems.filter(item => item.type !== 'highlight');
  const highlights = outlineItems.filter(item => item.type === 'highlight');

  return (
    <aside 
      className={`editor-outline-sidebar h-full bg-[#151515] border-l border-gray-800/50 transition-all duration-300 ease-in-out flex flex-col ${
        isCollapsed ? 'w-10' : 'w-64'
      }`}
    >
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-gray-800/50">
        {!isCollapsed && (
          <h3 className="text-xs font-semibold tracking-wider text-gray-400 uppercase">
            Page Outline
          </h3>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 text-gray-500 transition-colors rounded hover:text-gray-300 hover:bg-gray-800/50"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg 
            className={`w-4 h-4 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Sidebar Content */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* Timestamps Section */}
          {currentNote && (
            <div className="px-3 py-3 border-b border-gray-800/30">
              <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Timestamps</span>
              </div>
              <div className="space-y-1 text-xs text-gray-500">
                {currentNote.createdAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Created</span>
                    <span>{formatDate(currentNote.createdAt)}</span>
                  </div>
                )}
                {currentNote.updatedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Updated</span>
                    <span>{formatDate(currentNote.updatedAt)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Headings Section */}
          <div className="px-3 py-3 border-b border-gray-800/30">
            <div className="flex items-center gap-2 mb-3 text-xs text-gray-500">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h8m-8 6h16" />
              </svg>
              <span>Headings</span>
              <span className="ml-auto text-gray-600">{headings.length}</span>
            </div>
            
            {headings.length > 0 ? (
              <nav className="space-y-1">
                {headings.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm transition-all duration-200 group ${getIndentLevel(item.type)} ${
                      activeId === item.id 
                        ? 'bg-green-500/10 text-green-400' 
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                    }`}
                  >
                    <span className="flex-shrink-0 w-5">{item.icon}</span>
                    <span className="truncate">{item.text}</span>
                  </button>
                ))}
              </nav>
            ) : (
              <p className="text-xs text-gray-600 italic">
                No headings yet. Use # for H1, ## for H2, ### for H3
              </p>
            )}
          </div>

          {/* Highlights Section */}
          <div className="px-3 py-3">
            <div className="flex items-center gap-2 mb-3 text-xs text-gray-500">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              <span>Highlights</span>
              <span className="ml-auto text-gray-600">{highlights.length}</span>
            </div>
            
            {highlights.length > 0 ? (
              <nav className="space-y-1">
                {highlights.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-all duration-200 ${
                      activeId === item.id 
                        ? 'bg-yellow-500/10 text-yellow-400' 
                        : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                    }`}
                  >
                    <span className="flex-shrink-0 w-4 h-4 rounded bg-yellow-500/20 flex items-center justify-center">
                      <span className="w-2 h-2 rounded-sm bg-yellow-500/60"></span>
                    </span>
                    <span className="truncate">{item.text}</span>
                  </button>
                ))}
              </nav>
            ) : (
              <p className="text-xs text-gray-600 italic">
                No highlights yet. Select text and highlight it.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Collapsed State Icons */}
      {isCollapsed && (
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="text-gray-500" title={`${headings.length} headings`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h8m-8 6h16" />
            </svg>
          </div>
          <div className="text-gray-500" title={`${highlights.length} highlights`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </div>
        </div>
      )}
    </aside>
  );
};

// Helper function to format dates
const formatDate = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
};

export default EditorOutlineSidebar;
