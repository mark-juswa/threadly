import api from './axiosConfig';

export const noteService = {
  // Get all notes hierarchy
  getAllNotes: async () => {
    const response = await api.get('/api/notes');
    return response.data;
  },

  // ==========================================
  // TOPICS
  // ==========================================
  createTopic: async (topicData) => {
    const response = await api.post('/api/notes/topics', topicData);
    return response.data;
  },

  updateTopic: async (topicId, topicData) => {
    const response = await api.put(`/api/notes/topics/${topicId}`, topicData);
    return response.data;
  },

  deleteTopic: async (topicId) => {
    const response = await api.delete(`/api/notes/topics/${topicId}`);
    return response.data;
  },

  // ==========================================
  // CATEGORIES
  // ==========================================
  createCategory: async (categoryData) => {
    const response = await api.post('/api/notes/categories', categoryData);
    return response.data;
  },

  updateCategory: async (categoryId, categoryData) => {
    const response = await api.put(`/api/notes/categories/${categoryId}`, categoryData);
    return response.data;
  },

  deleteCategory: async (categoryId) => {
    const response = await api.delete(`/api/notes/categories/${categoryId}`);
    return response.data;
  },

  // ==========================================
  // GROUPS
  // ==========================================
  // groupData can include: { name, categoryId, topicId, parentGroupId (optional for nested groups) }
  createGroup: async (groupData) => {
    const response = await api.post('/api/notes/groups', groupData);
    return response.data;
  },

  updateGroup: async (groupId, groupData) => {
    const response = await api.put(`/api/notes/groups/${groupId}`, groupData);
    return response.data;
  },

  deleteGroup: async (groupId) => {
    const response = await api.delete(`/api/notes/groups/${groupId}`);
    return response.data;
  },

  // ==========================================
  // NOTES (SubTopics)
  // ==========================================
  createNote: async (noteData) => {
    const response = await api.post('/api/notes', noteData);
    return response.data;
  },

  getNote: async (noteId) => {
    const response = await api.get(`/api/notes/${noteId}`);
    return response.data;
  },

  updateNote: async (noteId, noteData) => {
    try {
      const response = await api.put(`/api/notes/${noteId}`, noteData);
      return response.data;
    } catch (error) {
      // Handle conflict errors (409)
      if (error.response?.status === 409) {
        return {
          success: false,
          conflict: true,
          ...error.response.data
        };
      }
      throw error;
    }
  },

  deleteNote: async (noteId) => {
    const response = await api.delete(`/api/notes/${noteId}`);
    return response.data;
  },

  // Reorder notes within the same container
  // orderedIds: string[] — full ordered list of note IDs in the container
  reorderNotes: async (orderedIds) => {
    const response = await api.put('/api/notes/reorder', { orderedIds });
    return response.data;
  },
};