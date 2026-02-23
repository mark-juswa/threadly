import { createContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
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

  // fetchAllNotes uses functional setState forms (prev => ...) so it never closes
  // over stale state values — this lets us wrap it in useCallback([]) with no deps,
  // giving it a stable reference that never changes. A stable reference means
  // NoteContext consumers (including RichTextEditor) do NOT re-render just because
  // fetchAllNotes was "recreated".
  const fetchAllNotes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await noteService.getAllNotes();
      setTopics(data);

      // Use functional updater forms to read latest state without closing over it
      setCurrentTopic(prevTopic => {
        if (data.length === 0) return null;
        if (!prevTopic) return data[0];
        const updated = data.find(t => t._id === prevTopic._id);
        return updated || data[0];
      });

      setCurrentCategory(prevCategory => {
        if (!prevCategory) return null;
        // Find the updated topic to look inside it
        // We read from `data` which is in scope (not state)
        for (const topic of data) {
          const found = topic.categories?.find(c => c._id === prevCategory._id);
          if (found) return found;
        }
        return null;
      });

      setCurrentNote(prevNote => {
        if (!prevNote) return null;

        const findNoteInGroup = (group) => {
          const note = group.notes?.find(n => n._id === prevNote._id);
          if (note) return note;
          for (const sg of group.subgroups || []) {
            const found = findNoteInGroup(sg);
            if (found) return found;
          }
          return null;
        };

        for (const topic of data) {
          // Check orphan notes
          const orphan = topic.orphanNotes?.find(n => n._id === prevNote._id);
          if (orphan) return orphan;
          // Check categories
          for (const cat of topic.categories || []) {
            const direct = cat.notes?.find(n => n._id === prevNote._id);
            if (direct) return direct;
            for (const grp of cat.groups || []) {
              const inGroup = findNoteInGroup(grp);
              if (inGroup) return inGroup;
            }
          }
        }
        return null; // Note was deleted
      });

    } catch (error) {
      console.error('Failed to fetch notes:', error);
    } finally {
      setLoading(false);
    }
  }, []); // stable — uses functional setState, reads `data` from closure (not stale state)

  // ==========================================
  // TOPIC OPERATIONS
  // ==========================================
  const createTopic = useCallback(async (topicData) => {
    try {
      const newTopic = await noteService.createTopic(topicData);
      setTopics(prev => [...prev, newTopic]);
      return { success: true, topic: newTopic };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to create topic';
      return { success: false, error: message };
    }
  }, []);

  const updateTopic = useCallback(async (topicId, topicData) => {
    try {
      const updatedTopic = await noteService.updateTopic(topicId, topicData);
      setTopics(prev => prev.map(t => t._id === topicId ? updatedTopic : t));
      setCurrentTopic(prev => prev?._id === topicId ? updatedTopic : prev);
      return { success: true, topic: updatedTopic };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to update topic';
      return { success: false, error: message };
    }
  }, []);

  const deleteTopic = useCallback(async (topicId) => {
    try {
      await noteService.deleteTopic(topicId);
      setTopics(prev => prev.filter(t => t._id !== topicId));
      setCurrentTopic(prev => {
        if (prev?._id === topicId) {
          setCurrentCategory(null);
          setCurrentNote(null);
          return null;
        }
        return prev;
      });
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to delete topic';
      return { success: false, error: message };
    }
  }, []);

  // ==========================================
  // CATEGORY OPERATIONS
  // ==========================================
  const createCategory = useCallback(async (categoryData) => {
    try {
      const newCategory = await noteService.createCategory(categoryData);
      await fetchAllNotes();
      return { success: true, category: newCategory };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to create category';
      return { success: false, error: message };
    }
  }, [fetchAllNotes]);

  const updateCategory = useCallback(async (categoryId, categoryData) => {
    try {
      await noteService.updateCategory(categoryId, categoryData);
      await fetchAllNotes();
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to update category';
      return { success: false, error: message };
    }
  }, [fetchAllNotes]);

  const deleteCategory = useCallback(async (categoryId) => {
    try {
      await noteService.deleteCategory(categoryId);
      await fetchAllNotes();
      setCurrentCategory(prev => {
        if (prev?._id === categoryId) {
          setCurrentNote(null);
          return null;
        }
        return prev;
      });
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to delete category';
      return { success: false, error: message };
    }
  }, [fetchAllNotes]);

  // ==========================================
  // GROUP OPERATIONS
  // ==========================================
  const createGroup = useCallback(async (groupData) => {
    try {
      await noteService.createGroup(groupData);
      await fetchAllNotes();
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to create group';
      return { success: false, error: message };
    }
  }, [fetchAllNotes]);

  const updateGroup = useCallback(async (groupId, groupData) => {
    try {
      await noteService.updateGroup(groupId, groupData);
      await fetchAllNotes();
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to update group';
      return { success: false, error: message };
    }
  }, [fetchAllNotes]);

  const deleteGroup = useCallback(async (groupId) => {
    try {
      await noteService.deleteGroup(groupId);
      await fetchAllNotes();
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to delete group';
      return { success: false, error: message };
    }
  }, [fetchAllNotes]);

  // ==========================================
  // NOTE OPERATIONS
  // ==========================================
  const createNote = useCallback(async (noteData) => {
    try {
      const newNote = await noteService.createNote(noteData);
      await fetchAllNotes();
      setCurrentNote(newNote);
      return { success: true, note: newNote };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to create note';
      return { success: false, error: message };
    }
  }, [fetchAllNotes]);

  const updateNote = useCallback(async (noteId, noteData, options = {}) => {
    const { skipRefresh = false } = options;
    try {
      const result = await noteService.updateNote(noteId, noteData);

      // Check if it's a conflict response
      if (result.conflict) {
        return result;
      }

      const updatedNote = result;

      if (!skipRefresh) {
        // Full refresh for metadata changes (title, etc.)
        await fetchAllNotes();
        setCurrentNote(prev => prev?._id === noteId ? updatedNote : prev);
      } else {
        // AUTO-SAVE MODE: patch topicsRef in-place — zero React state changes,
        // zero re-renders, cursor stays exactly where the user left it.
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
          if (structure.categories) structure.categories.forEach(cat => patchNoteInStructure(cat));
          if (structure.groups) structure.groups.forEach(g => patchNoteInStructure(g));
          if (structure.subgroups) structure.subgroups.forEach(sg => patchNoteInStructure(sg));
        };
        topicsRef.current.forEach(topic => patchNoteInStructure(topic));
      }

      return { success: true, note: updatedNote };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to update note';
      return { success: false, error: message };
    }
  }, [fetchAllNotes]);

  const deleteNote = useCallback(async (noteId) => {
    try {
      await noteService.deleteNote(noteId);
      await fetchAllNotes();
      setCurrentNote(prev => prev?._id === noteId ? null : prev);
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to delete note';
      return { success: false, error: message };
    }
  }, [fetchAllNotes]);

  const moveNote = useCallback(async (noteId, targetCategoryId, targetGroupId = null) => {
    try {
      const updatedNote = await noteService.updateNote(noteId, {
        categoryId: targetCategoryId,
        groupId: targetGroupId
      });
      await fetchAllNotes();
      setCurrentNote(prev => prev?._id === noteId ? updatedNote : prev);
      return { success: true, note: updatedNote };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to move note';
      return { success: false, error: message };
    }
  }, [fetchAllNotes]);

  // Memoize the context value so consumers only re-render when the values
  // they actually care about change — not on every NoteProvider render.
  // All function references are stable (useCallback), so this object is only
  // recreated when the actual data (topics, currentNote, etc.) changes.
  const value = useMemo(() => ({
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
  }), [
    topics,
    currentTopic,
    currentCategory,
    currentNote,
    loading,
    fetchAllNotes,
    createTopic, updateTopic, deleteTopic,
    createCategory, updateCategory, deleteCategory,
    createGroup, updateGroup, deleteGroup,
    createNote, updateNote, deleteNote, moveNote,
  ]);

  return <NoteContext.Provider value={value}>{children}</NoteContext.Provider>;
};