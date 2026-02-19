import { useState, useEffect, useCallback } from 'react';
import { useNotes } from '../../hooks/useNotes';

const EditorOutlineSidebar = ({ editorRef }) => {
  const { currentNote } = useNotes();
  const [outlineItems, setOutlineItems] = useState({
    headings: [],
    bulletLists: [],
    numberedLists: [],
    checklists: [],
    highlights: []
  });
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [collapsedSections, setCollapsedSections] = useState({
    timestamps: false,
    headings: false,
    bulletLists: true,
    numberedLists: true,
    checklists: false,
    highlights: true
  });

  const toggleSection = (section) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Extract outline items from editor content
  const extractOutlineItems = useCallback(() => {
    if (!editorRef?.current) return {
      headings: [],
      bulletLists: [],
      numberedLists: [],
      checklists: [],
      highlights: []
    };

    const editor = editorRef.current;
    const items = {
      headings: [],
      bulletLists: [],
      numberedLists: [],
      checklists: [],
      highlights: []
    };

    // Extract headings (H1, H2, H3)
    const headings = editor.querySelectorAll('h1, h2, h3');
    headings.forEach((heading, index) => {
      const id = `heading-${index}`;
      heading.setAttribute('data-outline-id', id);
      
      items.headings.push({
        id,
        type: heading.tagName.toLowerCase(),
        text: heading.textContent.trim().slice(0, 50) || 'Untitled',
        element: heading,
        icon: getHeadingIcon(heading.tagName.toLowerCase()),
      });
    });

    // Extract bullet lists (unordered lists)
    const ulLists = editor.querySelectorAll('ul');
    ulLists.forEach((ul, ulIndex) => {
      const listItems = ul.querySelectorAll(':scope > li');
      listItems.forEach((li, liIndex) => {
        // Check if this is a checklist item (has checkbox)
        const checkbox = li.querySelector('input[type="checkbox"]');
        if (checkbox) return; // Skip, will be handled in checklists
        
        const text = li.textContent.trim();
        if (text && text.length > 0) {
          const id = `bullet-${ulIndex}-${liIndex}`;
          li.setAttribute('data-outline-id', id);
          
          items.bulletLists.push({
            id,
            type: 'bullet',
            text: text.slice(0, 40) + (text.length > 40 ? '...' : ''),
            element: li,
          });
        }
      });
    });

    // Extract numbered lists (ordered lists)
    const olLists = editor.querySelectorAll('ol');
    olLists.forEach((ol, olIndex) => {
      const listItems = ol.querySelectorAll(':scope > li');
      listItems.forEach((li, liIndex) => {
        const text = li.textContent.trim();
        if (text && text.length > 0) {
          const id = `numbered-${olIndex}-${liIndex}`;
          li.setAttribute('data-outline-id', id);
          
          items.numberedLists.push({
            id,
            type: 'numbered',
            number: liIndex + 1,
            text: text.slice(0, 40) + (text.length > 40 ? '...' : ''),
            element: li,
          });
        }
      });
    });

    // Extract checklists (li with checkboxes or specific checklist patterns)
    const checkboxes = editor.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((checkbox, index) => {
      const li = checkbox.closest('li') || checkbox.parentElement;
      if (li) {
        const text = li.textContent.trim();
        if (text && text.length > 0) {
          const id = `checklist-${index}`;
          li.setAttribute('data-outline-id', id);
          
          items.checklists.push({
            id,
            type: 'checklist',
            checked: checkbox.checked,
            text: text.slice(0, 40) + (text.length > 40 ? '...' : ''),
            element: li,
            checkbox: checkbox,
          });
        }
      }
    });

    // Also check for [x] or [ ] style checklists in text
    const allElements = editor.querySelectorAll('li, p, div');
    allElements.forEach((el, index) => {
      const text = el.textContent.trim();
      const checkboxMatch = text.match(/^\[([xX ])\]\s*(.+)/);
      if (checkboxMatch && !el.querySelector('input[type="checkbox"]')) {
        const id = `checklist-text-${index}`;
        el.setAttribute('data-outline-id', id);
        
        items.checklists.push({
          id,
          type: 'checklist',
          checked: checkboxMatch[1].toLowerCase() === 'x',
          text: checkboxMatch[2].slice(0, 40) + (checkboxMatch[2].length > 40 ? '...' : ''),
          element: el,
        });
      }
    });

    // Extract highlighted/marked text
    const highlights = editor.querySelectorAll('mark, .highlight, [style*="background"]');
    highlights.forEach((highlight, index) => {
      const text = highlight.textContent.trim();
      if (text && text.length > 2) {
        const id = `highlight-${index}`;
        highlight.setAttribute('data-outline-id', id);
        
        items.highlights.push({
          id,
          type: 'highlight',
          text: text.slice(0, 40) + (text.length > 40 ? '...' : ''),
          element: highlight,
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

  const { headings, bulletLists, numberedLists, checklists, highlights } = outlineItems;
  const completedChecklists = checklists.filter(item => item.checked).length;
  const totalItems = headings.length + bulletLists.length + numberedLists.length + checklists.length + highlights.length;

  // Collapsible Section Header Component
  const SectionHeader = ({ section, icon, title, count, badge = null }) => (
    <button
      onClick={() => toggleSection(section)}
      className="w-full flex items-center gap-2 mb-2 text-xs text-gray-500 hover:text-gray-400 transition-colors"
    >
      <svg 
        className={`w-3 h-3 transition-transform duration-200 ${collapsedSections[section] ? '-rotate-90' : 'rotate-0'}`} 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
      </svg>
      {icon}
      <span>{title}</span>
      {badge}
      <span className="ml-auto text-gray-600">{count}</span>
    </button>
  );

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
              <SectionHeader
                section="timestamps"
                icon={
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                title="Timestamps"
                count=""
              />
              {!collapsedSections.timestamps && (
                <div className="space-y-1 text-xs text-gray-500 ml-5">
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
              )}
            </div>
          )}

          {/* Headings Section */}
          <div className="px-3 py-3 border-b border-gray-800/30">
            <SectionHeader
              section="headings"
              icon={
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h8m-8 6h16" />
                </svg>
              }
              title="Headings"
              count={headings.length}
            />
            
            {!collapsedSections.headings && (
              headings.length > 0 ? (
                <nav className="space-y-1 ml-5">
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
                <p className="text-xs text-gray-600 italic ml-5">
                  Use # for H1, ## for H2, ### for H3
                </p>
              )
            )}
          </div>

          {/* Bullet Lists Section */}
          <div className="px-3 py-3 border-b border-gray-800/30">
            <SectionHeader
              section="bulletLists"
              icon={
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              }
              title="Bullet Lists"
              count={bulletLists.length}
            />
            
            {!collapsedSections.bulletLists && (
              bulletLists.length > 0 ? (
                <nav className="space-y-1 ml-5">
                  {bulletLists.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-all duration-200 ${
                        activeId === item.id 
                          ? 'bg-blue-500/10 text-blue-400' 
                          : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                      }`}
                    >
                      <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-gray-500"></span>
                      <span className="truncate">{item.text}</span>
                    </button>
                  ))}
                </nav>
              ) : (
                <p className="text-xs text-gray-600 italic ml-5">
                  Use - or * for bullet lists
                </p>
              )
            )}
          </div>

          {/* Numbered Lists Section */}
          <div className="px-3 py-3 border-b border-gray-800/30">
            <SectionHeader
              section="numberedLists"
              icon={
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                </svg>
              }
              title="Numbered Lists"
              count={numberedLists.length}
            />
            
            {!collapsedSections.numberedLists && (
              numberedLists.length > 0 ? (
                <nav className="space-y-1 ml-5">
                  {numberedLists.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-all duration-200 ${
                        activeId === item.id 
                          ? 'bg-purple-500/10 text-purple-400' 
                          : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                      }`}
                    >
                      <span className="flex-shrink-0 w-4 text-gray-600 text-[10px] font-mono">{item.number}.</span>
                      <span className="truncate">{item.text}</span>
                    </button>
                  ))}
                </nav>
              ) : (
                <p className="text-xs text-gray-600 italic ml-5">
                  Use 1. for numbered lists
                </p>
              )
            )}
          </div>

          {/* Checklists Section */}
          <div className="px-3 py-3 border-b border-gray-800/30">
            <SectionHeader
              section="checklists"
              icon={
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              title="Checklists"
              count={checklists.length}
              badge={checklists.length > 0 ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400">
                  {completedChecklists}/{checklists.length}
                </span>
              ) : null}
            />
            
            {!collapsedSections.checklists && (
              checklists.length > 0 ? (
                <nav className="space-y-1 ml-5">
                  {checklists.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-all duration-200 ${
                        activeId === item.id 
                          ? 'bg-green-500/10 text-green-400' 
                          : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                      }`}
                    >
                      <span className={`flex-shrink-0 w-3.5 h-3.5 rounded border ${
                        item.checked 
                          ? 'bg-green-500/30 border-green-500/50' 
                          : 'border-gray-600'
                      } flex items-center justify-center`}>
                        {item.checked && (
                          <svg className="w-2.5 h-2.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span className={`truncate ${item.checked ? 'line-through text-gray-600' : ''}`}>
                        {item.text}
                      </span>
                    </button>
                  ))}
                </nav>
              ) : (
                <p className="text-xs text-gray-600 italic ml-5">
                  Use [ ] or [x] for checklists
                </p>
              )
            )}
          </div>

          {/* Highlights Section */}
          <div className="px-3 py-3">
            <SectionHeader
              section="highlights"
              icon={
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              }
              title="Highlights"
              count={highlights.length}
            />
            
            {!collapsedSections.highlights && (
              highlights.length > 0 ? (
                <nav className="space-y-1 ml-5">
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
                <p className="text-xs text-gray-600 italic ml-5">
                  Select text and highlight it
                </p>
              )
            )}
          </div>
        </div>
      )}

      {/* Collapsed State Icons */}
      {isCollapsed && (
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="text-gray-500 relative" title={`${headings.length} headings`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h8m-8 6h16" />
            </svg>
            {headings.length > 0 && (
              <span className="absolute -top-1 -right-1 w-3 h-3 text-[8px] bg-green-500/30 text-green-400 rounded-full flex items-center justify-center">
                {headings.length}
              </span>
            )}
          </div>
          <div className="text-gray-500 relative" title={`${bulletLists.length} bullet items`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            {bulletLists.length > 0 && (
              <span className="absolute -top-1 -right-1 w-3 h-3 text-[8px] bg-blue-500/30 text-blue-400 rounded-full flex items-center justify-center">
                {bulletLists.length}
              </span>
            )}
          </div>
          <div className="text-gray-500 relative" title={`${numberedLists.length} numbered items`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
            </svg>
            {numberedLists.length > 0 && (
              <span className="absolute -top-1 -right-1 w-3 h-3 text-[8px] bg-purple-500/30 text-purple-400 rounded-full flex items-center justify-center">
                {numberedLists.length}
              </span>
            )}
          </div>
          <div className="text-gray-500 relative" title={`${completedChecklists}/${checklists.length} completed`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {checklists.length > 0 && (
              <span className="absolute -top-1 -right-1 w-3 h-3 text-[8px] bg-green-500/30 text-green-400 rounded-full flex items-center justify-center">
                {checklists.length}
              </span>
            )}
          </div>
          <div className="text-gray-500 relative" title={`${highlights.length} highlights`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            {highlights.length > 0 && (
              <span className="absolute -top-1 -right-1 w-3 h-3 text-[8px] bg-yellow-500/30 text-yellow-400 rounded-full flex items-center justify-center">
                {highlights.length}
              </span>
            )}
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
