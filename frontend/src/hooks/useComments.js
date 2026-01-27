/**
 * Custom hook for comments
 */
import { useState, useEffect } from 'react';
import * as blogService from '../services/blogService';

export function useComments(slug) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchComments = async () => {
    if (!slug) return;

    try {
      setLoading(true);
      setError(null);
      const data = await blogService.getComments(slug);
      setComments(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [slug]);

  const addComment = async (commentData) => {
    try {
      const newComment = await blogService.addComment(slug, commentData);
      setComments(prev => [...prev, newComment]);
      return newComment;
    } catch (err) {
      throw err;
    }
  };

  return {
    comments,
    loading,
    error,
    addComment,
    refetch: fetchComments,
  };
}
