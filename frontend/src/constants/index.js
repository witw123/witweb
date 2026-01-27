// API Base URL
export const API_BASE_URL = '';

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/api/login',
  REGISTER: '/api/register',
  PROFILE: '/api/profile',

  // Blog
  BLOG_LIST: '/api/blog',
  BLOG_POST: (slug) => `/api/blog/${slug}`,
  BLOG_LIKE: (slug) => `/api/blog/${slug}/like`,
  BLOG_DISLIKE: (slug) => `/api/blog/${slug}/dislike`,
  BLOG_FAVORITE: (slug) => `/api/blog/${slug}/favorite`,
  BLOG_COMMENTS: (slug) => `/api/blog/${slug}/comments`,

  // Upload
  UPLOAD_IMAGE: '/api/upload',
  THUMBNAIL: '/api/thumbnail',
};

// Pagination
export const DEFAULT_PAGE_SIZE = 5;

// Cache Keys
export const CACHE_KEYS = {
  PROFILE: (username) => `cache:profile:${username}`,
  BLOG_LIST: (username, params) => `cache:blog:${username}:${params.toString()}`,
  BLOG_POST: (slug) => `cache:post:${slug}`,
  COMMENTS: (slug) => `cache:comments:${slug}`,
  FAVORITES: (username) => `cache:favorites:${username}`,
};

// Local Storage Keys
export const STORAGE_KEYS = {
  TOKEN: 'token',
  PROFILE: 'profile',
};

// Image Settings
export const IMAGE_SETTINGS = {
  MAX_SIZE_MB: 5,
  THUMBNAIL_SIZES: {
    SMALL: 64,
    MEDIUM: 256,
    LARGE: 400,
  },
};
