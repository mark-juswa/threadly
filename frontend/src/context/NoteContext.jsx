import { createContext, useState, useEffect } from 'react';
import { noteService } from '../api/noteService';

export const NoteContext = createContext();

export const NoteProvider = ({ children }) => {
  const [topics, setTopics] = useState([]);
  const [currentTopic, setCurrentTopic] = useState(null);
  const [currentCategory, setCurrentCategory] = useState(null);
  const [currentNote, setCurrentNote] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch all notes hierarchy on mount
  useEffect(() => {
    fetchAllNotes();
  }, []);

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

  const updateNote = async (noteId, noteData) => {
    try {
      const updatedNote = await noteService.updateNote(noteId, noteData);
      await fetchAllNotes();
      if (currentNote?._id === noteId) {
        setCurrentNote(updatedNote);
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