import { useCallback, useEffect, useState } from 'react';
import { aiService } from '../api/aiService';

export const useAIReview = (currentNoteId) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [response, setResponse] = useState(null);

  useEffect(() => {
    setError('');
    setResponse(null);
  }, [currentNoteId]);

  const runRequest = useCallback(async (request) => {
    setLoading(true);
    setError('');

    try {
      const data = await request();
      setResponse(data);
      return { success: true, data };
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'AI request failed';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, []);

  const reviewNote = useCallback((noteId) => (
    runRequest(() => aiService.reviewNote(noteId))
  ), [runRequest]);

  const summarizeGroup = useCallback((groupId) => (
    runRequest(() => aiService.summarizeGroup(groupId))
  ), [runRequest]);

  const summarizeCategory = useCallback((categoryId) => (
    runRequest(() => aiService.summarizeCategory(categoryId))
  ), [runRequest]);

  const clear = useCallback(() => {
    setError('');
    setResponse(null);
  }, []);

  return {
    loading,
    error,
    response,
    reviewNote,
    summarizeGroup,
    summarizeCategory,
    clear,
  };
};
