/**
 * Custom hook for blog posts
 */
import { useState, useEffect } from 'react';
import * as blogService from '../services/blogService';

export function useBlogList(params = {}) {
  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchPosts() {
      try {
        setLoading(true);
        setError(null);
        const data = await blogService.getBlogList(params);

        if (!cancelled) {
          setPosts(data.items || data);
          setTotal(data.total || (data.items || data).length);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchPosts();

    return () => {
      cancelled = true;
    };
  }, [JSON.stringify(params)]);

  return { posts, total, loading, error, refetch: () => { } };
}

export function useBlogPost(slug) {
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchPost() {
      if (!slug) return;

      try {
        setLoading(true);
        setError(null);
        const data = await blogService.getBlogPost(slug);

        if (!cancelled) {
          setPost(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchPost();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return { post, loading, error };
}
