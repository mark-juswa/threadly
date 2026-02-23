import { createContext, useState, useEffect, useRef } from 'react';
import { noteService } from '../api/noteService';
import { useSocket } from './SocketContext';

export const NoteContext = createContext();

export const NoteProvider = ({ children }) => {
  const [topics, setTopics] = useState([]);
  const [currentTopic, setCurrentTopic] = useState(null);
  const [currentCategory, setCurrentCategory] = useState(null);
  const [currentNote, setCurrentNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const { socket, connected } = useSocket();

  // A mutable ref that always mirrors the latest topics array.
  // Used by updateNote (skipRefresh=true) to patch cached note data
  // WITHOUT calling setTopics — which would re-render every context consumer
  // and disturb the contentEditable cursor position.
  const topicsRef = useRef(topics);

  // Keep topicsRef in sync with topics state whenever it changes.
  // This lets us read the latest topics imperatively (without stale closure issues)
  // without needing to call setTopics during auto-save.
  useEffect(() => {
    topicsRef.current = topics;
  }, [topics]);

  // Fetch all notes hierarchy on mount
  useEffect(() => {
    fetchAllNotes();
  }, []);

  // Listen for WebSocket note updates to keep cache fresh
  useEffect(() => {
    if (!socket || !connected) return;

    const handleNoteSyncForCache = (data) => {
      const { noteId, content, version } = data;

      // Patch topicsRef.current in-place — same zero-re-render strategy as auto-save.
      // The editor's own socket listener (in RichTextEditor) already updates the DOM;
      // we just need to keep the cache fresh for note-switching without re-rendering.
      const patchNote = (structure) => {
        if (structure.notes) {
          for (let i = 0; i < structure.notes.length; i++) {
            if (structure.notes[i]._id === noteId) {
              structure.notes[i] = { ...structure.notes[i], content, version, updatedAt: new Date().toISOString() };
            }
          }
        }
        if (structure.orphanNotes) {
          for (let i = 0; i < structure.orphanNotes.length; i++) {
            if (structure.orphanNotes[i]._id === noteId) {
              structure.orphanNotes[i] = { ...structure.orphanNotes[i], content, version, updatedAt: new Date().toISOString() };
            }
          }
        }
        if (structure.categories) {
          structure.categories.forEach(cat => patchNote(cat));
        }
        if (structure.groups) {
          structure.groups.forEach(g => patchNote(g));
        }
        if (structure.subgroups) {
          structure.subgroups.forEach(sg => patchNote(sg));
        }
      };
      topicsRef.current.forEach(topic => patchNote(topic));
      // No setTopics call — zero re-renders, cursor preserved.
    };

    socket.on('note-sync', handleNoteSyncForCache);

    return () => {
      socket.off('note-sync', handleNoteSyncForCache);
    };
  }, [socket, connected]);

  const fetchAllNotes = async () => {
    try {
      setLoading(true);
      const data = await noteService.getAllNotes();
      setTopics(data);
      
      // Auto-select first topic if available, or update currentTopic with fresh data
      if (data.length > 0) {
        if (!currentTopic) {
          setCurrentTopic(data[0]);
        } else {
          // Update currentTopic with fresh data from server
          const updatedCurrentTopic = data.find(t => t._id === currentTopic._id);
          if (updatedCurrentTopic) {
            setCurrentTopic(updatedCurrentTopic);
            
            // Also update currentCategory if it exists
            if (currentCategory) {
              const updatedCategory = updatedCurrentTopic.categories?.find(
                c => c._id === currentCategory._id
              );
              if (updatedCategory) {
                setCurrentCategory(updatedCategory);
              } else {
                setCurrentCategory(null);
              }
            }
            
            // Also update currentNote if it exists
            if (currentNote) {
              let foundNote = null;
              
              // First check orphan notes (notes without category)
              foundNote = updatedCurrentTopic.orphanNotes?.find(n => n._id === currentNote._id);
              
              // Helper function to recursively search for note in nested groups
              const findNoteInGroup = (group) => {
                // Check notes in current group
                const note = group.notes?.find(n => n._id === currentNote._id);
                if (note) return note;
                
                // Recursively check subgroups
                for (const subgroup of group.subgroups || []) {
                  const subNote = findNoteInGroup(subgroup);
                  if (subNote) return subNote;
                }
                return null;
              };
              
              // If not found, search in all categories and groups for the note
              if (!foundNote) {
                for (const category of updatedCurrentTopic.categories || []) {
                  // Check direct notes
                  foundNote = category.notes?.find(n => n._id === currentNote._id);
                  if (foundNote) break;
                  
                  // Check group notes (including nested subgroups)
                  for (const group of category.groups || []) {
                    foundNote = findNoteInGroup(group);
                    if (foundNote) break;
                  }
                  if (foundNote) break;
                }
              }
              
              if (foundNote) {
                setCurrentNote(foundNote);
              } else {
                setCurrentNote(null);
              }
            }
          } else {
            // Current topic was deleted, select first available
            setCurrentTopic(data[0]);
            setCurrentCategory(null);
            setCurrentNote(null);
          }
        }
      } else {
        setCurrentTopic(null);
        setCurrentCategory(null);
        setCurrentNote(null);
      }
    } catch (error) {
      console.error('Failed to fetch notes:', error);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // TOPIC OPERATIONS
  // ==========================================
  const createTopic = async (topicData) => {
    try {
      const newTopic = await noteService.createTopic(topicData);
      setTopics([...topics, newTopic]);
      return { success: true, topic: newTopic };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to create topic';
      return { success: false, error: message };
    }
  };

  const updateTopic = async (topicId, topicData) => {
    try {
      const updatedTopic = await noteService.updateTopic(topicId, topicData);
      setTopics(topics.map(t => t._id === topicId ? updatedTopic : t));
      if (currentTopic?._id === topicId) {
        setCurrentTopic(updatedTopic);
      }
      return { success: true, topic: updatedTopic };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to update topic';
      return { success: false, error: message };
    }
  };

  const deleteTopic = async (topicId) => {
    try {
      await noteService.deleteTopic(topicId);
      setTopics(topics.filter(t => t._id !== topicId));
      if (currentTopic?._id === topicId) {
        setCurrentTopic(null);
        setCurrentCategory(null);
        setCurrentNote(null);
      }
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to delete topic';
      return { success: false, error: message };
    }
  };

  // ==========================================
  // CATEGORY OPERATIONS
  // ==========================================
  const createCategory = async (categoryData) => {
    try {
      const newCategory = await noteService.createCategory(categoryData);
      await fetchAllNotes(); // Refresh to get updated hierarchy
      return { success: true, category: newCategory };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to create category';
      return { success: false, error: message };
    }
  };

  const updateCategory = async (categoryId, categoryData) => {
    try {
      await noteService.updateCategory(categoryId, categoryData);
      await fetchAllNotes();
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to update category';
      return { success: false, error: message };
    }
  };

  const deleteCategory = async (categoryId) => {
    try {
      await noteService.deleteCategory(categoryId);
      await fetchAllNotes();
      if (currentCategory?._id === categoryId) {
        setCurrentCategory(null);
        setCurrentNote(null);
      }
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to delete category';
      return { success: false, error: message };
    }
  };

  // ==========================================
  // GROUP OPERATIONS
  // ==========================================
  const createGroup = async (groupData) => {
    try {
      await noteService.createGroup(groupData);
      await fetchAllNotes();
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to create group';
      return { success: false, error: message };
    }
  };

  const updateGroup = async (groupId, groupData) => {
    try {
      await noteService.updateGroup(groupId, groupData);
      await fetchAllNotes();
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to update group';
      return { success: false, error: message };
    }
  };

  const deleteGroup = async (groupId) => {
    try {
      await noteService.deleteGroup(groupId);
      await fetchAllNotes();
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to delete group';
      return { success: false, error: message };
    }
  };

  // ==========================================
  // NOTE OPERATIONS
  // ==========================================
  const createNote = async (noteData) => {
    try {
      const newNote = await noteService.createNote(noteData);
      await fetchAllNotes();
      setCurrentNote(newNote);
      return { success: true, note: newNote };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to create note';
      return { success: false, error: message };
    }
  };

  const updateNote = async (noteId, noteData, options = {}) => {
    const { skipRefresh = false } = options;
    try {
      const result = await noteService.updateNote(noteId, noteData);
      
      // Check if it's a conflict response
      if (result.conflict) {
        return result;
      }
      
      const updatedNote = result;
      
      // Skip full hierarchy refresh for content-only updates (auto-save)
      // This prevents cursor reset and unnecessary re-renders
      if (!skipRefresh) {
        // Full refresh - update everything including currentNote
        await fetchAllNotes();
        
        // Update currentNote for non-auto-save updates (e.g., title changes)
        if (currentNote?._id === noteId) {
          setCurrentNote(updatedNote);
        }
      } else {
        // Auto-save mode: patch the cached topics ref IN-PLACE without calling setTopics.
        // Calling setTopics here would trigger a re-render of every NoteContext consumer —
        // including RichTextEditor — which causes React to reconcile the contentEditable DOM
        // node and the browser loses the cursor position. Instead we mutate topicsRef.current
        // directly so the cache stays fresh for when the user switches notes, with zero
        // re-renders and zero cursor disruption.
        const patchNoteInStructure = (structure) => {
          if (structure.notes) {
            for (let i = 0; i < structure.notes.length; i++) {
              if (structure.notes[i]._id === noteId) {
                structure.notes[i] = updatedNote;
              }
            }
          }
          if (structure.orphanNotes) {
            for (let i = 0; i < structure.orphanNotes.length; i++) {
              if (structure.orphanNotes[i]._id === noteId) {
                structure.orphanNotes[i] = updatedNote;
              }
            }
          }
          if (structure.categories) {
            structure.categories.forEach(cat => patchNoteInStructure(cat));
          }
          if (structure.groups) {
            structure.groups.forEach(g => patchNoteInStructure(g));
          }
          if (structure.subgroups) {
            structure.subgroups.forEach(sg => patchNoteInStructure(sg));
          }
        };
        topicsRef.current.forEach(topic => patchNoteInStructure(topic));
        // topicsRef.current is now up-to-date. We do NOT call setTopics here
        // so React does not re-render anything.
      }
      
      return { success: true, note: updatedNote };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to update note';
      return { success: false, error: message };
    }
  };

  const deleteNote = async (noteId) => {
    try {
      await noteService.deleteNote(noteId);
      await fetchAllNotes();
      if (currentNote?._id === noteId) {
        setCurrentNote(null);
      }
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to delete note';
      return { success: false, error: message };
    }
  };

  // Move note to a different category or group
  const moveNote = async (noteId, targetCategoryId, targetGroupId = null) => {
    try {
      const updatedNote = await noteService.updateNote(noteId, {
        categoryId: targetCategoryId,
        groupId: targetGroupId
      });
      await fetchAllNotes();
      if (currentNote?._id === noteId) {
        setCurrentNote(updatedNote);
      }
      return { success: true, note: updatedNote };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to move note';
      return { success: false, error: message };
    }
  };

  const value = {
    topics,
    currentTopic,
    currentCategory,
    currentNote,
    loading,
    setCurrentTopic,
    setCurrentCategory,
    setCurrentNote,
    fetchAllNotes,
    createTopic,
    updateTopic,
    deleteTopic,
    createCategory,
    updateCategory,
    deleteCategory,
    createGroup,
    updateGroup,
    deleteGroup,
    createNote,
    updateNote,
    deleteNote,
    moveNote,
  };

  return <NoteContext.Provider value={value}>{children}</NoteContext.Provider>;
};