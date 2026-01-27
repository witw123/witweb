/**
 * Blog service - posts, comments, likes, favorites
 */
import { get, post, put, del } from './api';

/**
 * Get blog posts list
 * @param {object} params - {page, size, q, tag, author}
 * @returns {Promise<{items: array, total: number}>}
 */
export async function getBlogList(params = {}) {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', params.page);
  if (params.size) searchParams.set('size', params.size);
  if (params.q) searchParams.set('q', params.q);
  if (params.tag) searchParams.set('tag', params.tag);
  if (params.author) searchParams.set('author', params.author);

  const query = searchParams.toString();
  return get(`/api/blog${query ? `?${query}` : ''}`);
}

/**
 * Get single blog post
 * @param {string} slug
 * @returns {Promise<object>}
 */
export async function getBlogPost(slug) {
  return get(`/api/blog/${slug}`);
}

/**
 * Create new blog post
 * @param {object} postData - {title, slug, content, tags}
 * @returns {Promise<object>}
 */
export async function createBlogPost(postData) {
  return post('/api/blog', postData);
}

/**
 * Update blog post
 * @param {string} slug
 * @param {object} postData - {title, content, tags}
 * @returns {Promise<object>}
 */
export async function updateBlogPost(slug, postData) {
  return put(`/api/blog/${slug}`, postData);
}

/**
 * Delete blog post
 * @param {string} slug
 * @returns {Promise<object>}
 */
export async function deleteBlogPost(slug) {
  return del(`/api/blog/${slug}`);
}

/**
 * Like a post
 * @param {string} slug
 * @returns {Promise<object>}
 */
export async function likePost(slug) {
  return post(`/api/blog/${slug}/like`, {});
}

/**
 * Dislike a post
 * @param {string} slug
 * @returns {Promise<object>}
 */
export async function dislikePost(slug) {
  return post(`/api/blog/${slug}/dislike`, {});
}

/**
 * Favorite a post
 * @param {string} slug
 * @returns {Promise<object>}
 */
export async function favoritePost(slug) {
  return post(`/api/blog/${slug}/favorite`, {});
}

/**
 * Get post comments
 * @param {string} slug
 * @returns {Promise<array>}
 */
export async function getComments(slug) {
  return get(`/api/blog/${slug}/comments`);
}

/**
 * Add comment to post
 * @param {string} slug
 * @param {object} commentData - {content, author, parent_id}
 * @returns {Promise<object>}
 */
export async function addComment(slug, commentData) {
  return post(`/api/blog/${slug}/comments`, commentData);
}

/**
 * Get user's favorites
 * @param {number} page
 * @param {number} size
 * @returns {Promise<{items: array, total: number}>}
 */
export async function getFavorites(page = 1, size = 10) {
  return get(`/api/favorites?page=${page}&size=${size}`);
}

/**
 * Upload image
 * @param {File} file
 * @returns {Promise<{url: string}>}
 */
export async function uploadImage(file) {
  const formData = new FormData();
  formData.append('file', file);

  const token = localStorage.getItem('token');
  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Upload failed');
  }

  return response.json();
}
