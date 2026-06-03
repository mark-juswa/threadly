import api from './axiosConfig';

export const aiService = {
  reviewNote: async (noteId) => {
    const response = await api.post('/api/ai/note-review', { noteId });
    return response.data;
  },

  summarizeGroup: async (groupId) => {
    const response = await api.post('/api/ai/group-summary', { groupId });
    return response.data;
  },

  summarizeCategory: async (categoryId) => {
    const response = await api.post('/api/ai/category-summary', { categoryId });
    return response.data;
  },
};
