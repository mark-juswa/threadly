import { useState } from 'react';
import { useNotes } from '../../hooks/useNotes';
import UserProfile from './UserProfile';

const CategorySidebar = ({ showContextMenu, toggleMobileMenu, onCreateTopic, onCreateCategory }) => {
  const { topics, currentTopic, currentNote, setCurrentCategory, setCurrentNote, moveNote } = useNotes();
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [draggedNote, setDraggedNote] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  const toggleCollapse = (categoryId) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  const toggleGroupCollapse = (groupId) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  // Drag and Drop Handlers
  const handleDragStart = (e, note) => {
    setDraggedNote(note);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', note._id);
    // Add a slight delay to allow the drag image to be set
    setTimeout(() => {
      e.target.style.opacity = '0.5';
    }, 0);
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedNote(null);
    setDropTarget(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnterCategory = (e, categoryId) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedNote) {
      setDropTarget({ type: 'category', id: categoryId });
    }
  };

  const handleDragEnterGroup = (e, groupId, categoryId) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedNote) {
      setDropTarget({ type: 'group', id: groupId, categoryId });
    }
  };

  const handleDragEnterOrphan = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedNote) {
      setDropTarget({ type: 'orphan', id: 'orphan' });
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    // Only clear if leaving to an element outside the drop zone
    const relatedTarget = e.relatedTarget;
    if (!e.currentTarget.contains(relatedTarget)) {
      setDropTarget(null);
    }
  };

  const handleDropOnCategory = async (e, categoryId) => {
    e.preventDefault();
    e.stopPropagation();
    // Move note if it's from a different category OR if it's currently in a group (to remove from group)
    if (draggedNote && (draggedNote.categoryId !== categoryId || draggedNote.groupId)) {
      await moveNote(draggedNote._id, categoryId, null);
    }
    setDraggedNote(null);
    setDropTarget(null);
  };

  const handleDropOnGroup = async (e, groupId, categoryId) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedNote && (draggedNote.groupId !== groupId || draggedNote.categoryId !== categoryId)) {
      await moveNote(draggedNote._id, categoryId, groupId);
    }
    setDraggedNote(null);
    setDropTarget(null);
  };

  const handleDropOnOrphan = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedNote && (draggedNote.categoryId || draggedNote.groupId)) {
      await moveNote(draggedNote._id, null, null);
    }
    setDraggedNote(null);
    setDropTarget(null);
  };

  const isDropTarget = (type, id) => {
    return dropTarget?.type === type && dropTarget?.id === id;
  };

  const handleCategoryContextMenu = (e, category) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e, 'category', category);
  };

  const handleSubtopicContextMenu = (e, note) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e, 'subtopic', note);
  };

  const handleGeneralContextMenu = (e) => {
    if (e.target.closest('.sidebar-item')) return;
    e.preventDefault();
    showContextMenu(e, 'general', null);
  };

  const handleGroupContextMenu = (e, group) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e, 'group', group);
  };

  const handleNoteClick = (note) => {
    setCurrentNote(note);
    if (window.innerWidth < 768) {
      toggleMobileMenu();
    }
  };

  // Filter categories, groups, and notes based on search
  const searchLower = searchQuery.toLowerCase();
  
  const getFilteredCategoryData = (category) => {
    const categoryMatches = category.name.toLowerCase().includes(searchLower);
    
    // Filter direct notes
    const filteredNotes = category.notes?.filter(note =>
      note.title.toLowerCase().includes(searchLower)
    ) || [];
    
    // Filter groups and their notes
    const filteredGroups = category.groups?.map(group => {
      const groupMatches = group.name.toLowerCase().includes(searchLower);
      const filteredGroupNotes = group.notes?.filter(note =>
        note.title.toLowerCase().includes(searchLower)
      ) || [];
      
      // Include group if it matches or has matching notes
      if (groupMatches || filteredGroupNotes.length > 0) {
        return {
          ...group,
          notes: groupMatches ? group.notes : filteredGroupNotes, // Show all notes if group name matches
          _matchedGroup: groupMatches
        };
      }
      return null;
    }).filter(Boolean) || [];
    
    // Include category if it matches, has matching notes, or has matching groups
    const hasMatchingContent = filteredNotes.length > 0 || filteredGroups.length > 0;
    
    if (categoryMatches || hasMatchingContent) {
      return {
        ...category,
        notes: categoryMatches ? category.notes : filteredNotes, // Show all notes if category name matches
        groups: categoryMatches ? category.groups : filteredGroups, // Show all groups if category name matches
        _matchedCategory: categoryMatches
      };
    }
    return null;
  };

  const filteredCategories = searchQuery
    ? (currentTopic?.categories?.map(getFilteredCategoryData).filter(Boolean) || [])
    : (currentTopic?.categories || []);

  // Filter orphan notes based on search
  const filteredOrphanNotes = currentTopic?.orphanNotes?.filter(note =>
    !searchQuery || note.title.toLowerCase().includes(searchLower)
  ) || [];

  return (
    <aside className="w-72 bg-black border-r border-[#222225] flex flex-col flex-shrink-0">
      {/* Header */}
      <div className="flex items-center h-20 px-6 border-b border-gray-800">
        <h1 className="text-xl font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500">
          THREADIFY
        </h1>
      </div>

      {/* Search */}
      <div className="px-4 py-4">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search"
            className="w-full bg-[#1B1B1B] text-gray-300 text-sm rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-gray-700 placeholder-gray-600 transition-all"
          />
        </div>
      </div>

      {/* Categories List */}
      <div
        className="flex-1 px-2 overflow-y-auto"
        onContextMenu={handleGeneralContextMenu}
      >
        {!currentTopic ? (
          <div className="flex flex-col items-center justify-center h-full px-4">
            {topics.length === 0 ? (
              // No topics exist - show subtle placeholder for new users
              <div className="flex flex-col items-center text-center opacity-40">
                <div className="flex items-center justify-center w-12 h-12 mb-3 rounded-full bg-gray-800/50">
                  <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <p className="mb-3 text-sm text-gray-600">
                  No topics yet
                </p>
                <button
                  onClick={onCreateTopic}
                  className="flex items-center justify-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors duration-200"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Create Topic</span>
                </button>
              </div>
            ) : (
              // Topics exist but none selected
              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 mx-auto mb-3 bg-gray-800 rounded-full">
                  <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                  </svg>
                </div>
                <p className="text-sm text-gray-500">Select a topic to get started</p>
                <p className="mt-2 text-xs text-gray-600">Click a topic on the left sidebar</p>
              </div>
            )}
          </div>
        ) : filteredCategories.length === 0 && filteredOrphanNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4">
            {searchQuery ? (
              <p className="text-sm text-gray-500">No matching results</p>
            ) : (
              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 mx-auto mb-3 bg-gray-800 rounded-full">
                  <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <p className="mb-3 text-sm text-gray-500">No categories yet</p>
                <button
                  onClick={onCreateCategory}
                  className="flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-green-400 bg-[#1a1a1a] hover:bg-[#222] border border-gray-800 hover:border-green-500/30 rounded-lg px-4 py-2.5 transition-all duration-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Create Category</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
          {filteredCategories.map((category) => (
            <div key={category._id} className="mb-2 sidebar-item">
              {/* Category Header */}
              <div
                onClick={() => toggleCollapse(category._id)}
                onContextMenu={(e) => handleCategoryContextMenu(e, category)}
                onDragOver={handleDragOver}
                onDragEnter={(e) => handleDragEnterCategory(e, category._id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDropOnCategory(e, category._id)}
                className={`relative flex items-center justify-between px-2 py-2 text-gray-400 transition rounded-lg cursor-pointer select-none hover:text-white group hover:bg-gray-900/50 ${
                  isDropTarget('category', category._id) ? 'ring-2 ring-green-500 bg-green-500/10' : ''
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <svg
                    className={`w-3 h-3 transition-transform duration-200 ${
                      collapsedCategories[category._id] ? '-rotate-90' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                  <span className="searchable-text">{category.name}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    showContextMenu(e, 'addSubtopic', category);
                  }}
                  className="text-gray-500 transition opacity-0 group-hover:opacity-100 hover:text-green-400"
                  title="Add Subtopic"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>

              {/* Category Notes - auto-expand when searching */}
              {(!collapsedCategories[category._id] || searchQuery) && (
                <div 
                  className="pl-2 ml-2 transition-all duration-300 ease-in-out border-l border-gray-800"
                  onDragOver={handleDragOver}
                  onDragEnter={(e) => handleDragEnterCategory(e, category._id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDropOnCategory(e, category._id)}
                >
                  {/* Direct notes */}
                  {category.notes?.map((note) => {
                    const isActive = currentNote?._id === note._id;
                    const isDragging = draggedNote?._id === note._id;
                    return (
                      <div
                        key={note._id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, note)}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleNoteClick(note)}
                        onContextMenu={(e) => handleSubtopicContextMenu(e, note)}
                        className={`sidebar-item flex items-center px-3 py-2 bg-[#0d0d0e] rounded-md text-gray-200 text-sm cursor-grab mb-1 transition ${
                          isActive 
                            ? ' bg-[#1A1A1D] border border-gray-700 hover:border-gray-500' 
                            : 'hover:bg-[#222225]'
                        } ${isDragging ? 'opacity-50' : ''}`}
                      >
                        {isActive && <div className="w-2 h-2 mr-2 border-2 border-green-500 rounded-full" />}
                        <span className="truncate searchable-text">{note.title}</span>
                      </div>
                    );
                  })}

                  {/* Groups */}
                  {category.groups?.map((group) => (
                    <div 
                      key={group._id} 
                      className={`mb-2 rounded-md transition ${
                        isDropTarget('group', group._id) ? 'ring-2 ring-blue-500 bg-blue-500/10' : ''
                      }`}
                      onDragOver={handleDragOver}
                      onDragEnter={(e) => handleDragEnterGroup(e, group._id, category._id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDropOnGroup(e, group._id, category._id)}
                    >
                      {/* Group Header */}
                      <div 
                        onClick={() => toggleGroupCollapse(group._id)}
                        onContextMenu={(e) => handleGroupContextMenu(e, group)}
                        className="flex items-center gap-1 px-3 py-1 text-xs tracking-wider text-gray-500 uppercase transition cursor-pointer select-none hover:text-gray-400 group/header"
                      >
                        <svg
                          className={`w-2.5 h-2.5 transition-transform duration-200 ${
                            collapsedGroups[group._id] ? '-rotate-90' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                        <span>{group.name}</span>
                      </div>
                      {/* Group Notes - auto-expand when searching */}
                      {(!collapsedGroups[group._id] || searchQuery) && group.notes?.map((note) => {
                        const isActive = currentNote?._id === note._id;
                        const isDragging = draggedNote?._id === note._id;
                        return (
                          <div
                            key={note._id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, note)}
                            onDragEnd={handleDragEnd}
                            onClick={() => handleNoteClick(note)}
                            onContextMenu={(e) => handleSubtopicContextMenu(e, note)}
                            className={`sidebar-item flex items-center px-3 py-2 bg-[#0d0d0e] rounded-md text-gray-200 text-sm cursor-grab mb-1 transition ml-2 ${
                              isActive 
                                ? 'border border-gray-700 hover:border-gray-500' 
                                : 'hover:bg-[#222225]'
                            } ${isDragging ? 'opacity-50' : ''}`}
                          >
                            {isActive && <div className="w-2 h-2 mr-2 border-2 border-blue-500 rounded-full" />}
                            <span className="truncate searchable-text">{note.title}</span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Orphan Notes (notes without category) */}
          {(filteredOrphanNotes.length > 0 || draggedNote) && (
          <div 
            className={`mt-4 mb-2 rounded-md transition min-h-[40px] ${
              isDropTarget('orphan', 'orphan') ? 'ring-2 ring-purple-500 bg-purple-500/10' : ''
            }`}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnterOrphan}
            onDragLeave={handleDragLeave}
            onDrop={handleDropOnOrphan}
          >
            {filteredOrphanNotes.length === 0 && draggedNote && (
              <div className="px-3 py-2 text-xs text-center text-gray-500">
                Drop here to remove from category
              </div>
            )}
            {filteredOrphanNotes.map((note) => {
              const isActive = currentNote?._id === note._id;
              const isDragging = draggedNote?._id === note._id;
              return (
                <div
                  key={note._id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, note)}
                  onDragEnd={handleDragEnd}
                  onClick={() => handleNoteClick(note)}
                  onContextMenu={(e) => handleSubtopicContextMenu(e, note)}
                  className={`sidebar-item flex items-center px-3 py-2 bg-[#0d0d0e] rounded-md text-gray-200 text-sm cursor-grab mb-1 transition ${
                    isActive 
                      ? 'bg-[#1A1A1D] border border-gray-700 hover:border-gray-500' 
                      : 'hover:bg-[#222225]'
                  } ${isDragging ? 'opacity-50' : ''}`}
                >
                  {isActive && <div className="w-2 h-2 mr-2 border-2 border-purple-500 rounded-full" />}
                  <span className="truncate searchable-text">{note.title}</span>
                </div>
              );
            })}
          </div>
          )}

          {/* Spacer */}
          <div className="h-full min-h-[100px] w-full" />
        </>
        )}
      </div>

      {/* User Profile */}
      <UserProfile />
    </aside>
  );
};

export default CategorySidebar;