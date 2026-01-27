/**
 * Authentication service
 */
import { post } from './api';
import { setCachedJson } from '../utils/cache';

/**
 * Login user
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{token: string, profile: object}>}
 */
export async function login(username, password) {
  const data = await post('/api/login', { username, password }, { skipAuth: true });

  // Store token
  localStorage.setItem('token', data.token);

  // Store profile WITHOUT avatar_url to avoid localStorage quota issues
  if (data.profile) {
    const { avatar_url, ...profileWithoutAvatar } = data.profile;
    localStorage.setItem('profile', JSON.stringify(profileWithoutAvatar));

    // Cache full profile (including avatar) in memory/indexedDB
    if (data.profile.username) {
      setCachedJson(`cache:profile:${data.profile.username}`, data.profile);
    }
  }

  return data;
}

/**
 * Register new user
 * @param {object} userData - {username, password, nickname, avatar_url}
 * @returns {Promise<{token: string, profile: object}>}
 */
export async function register(userData) {
  const data = await post('/api/register', userData, { skipAuth: true });

  // Store token
  localStorage.setItem('token', data.token);

  // Store profile WITHOUT avatar_url to avoid localStorage quota issues
  if (data.profile) {
    const { avatar_url, ...profileWithoutAvatar } = data.profile;
    localStorage.setItem('profile', JSON.stringify(profileWithoutAvatar));

    // Cache full profile (including avatar) in memory/indexedDB
    if (data.profile.username) {
      setCachedJson(`cache:profile:${data.profile.username}`, data.profile);
    }
  }

  return data;
}

/**
 * Update user profile
 * @param {object} profileData - {nickname, avatar_url}
 * @returns {Promise<object>}
 */
export async function updateProfile(profileData) {
  const data = await post('/api/profile', profileData);

  // Update stored profile WITHOUT avatar_url to avoid localStorage quota issues
  if (data.profile) {
    const { avatar_url, ...profileWithoutAvatar } = data.profile;
    localStorage.setItem('profile', JSON.stringify(profileWithoutAvatar));

    // Cache full profile (including avatar) in memory/indexedDB
    if (data.profile.username) {
      setCachedJson(`cache:profile:${data.profile.username}`, data.profile);
    }
  }

  return data;
}

/**
 * Logout user
 */
export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('profile');
}

/**
 * Get current user profile from storage
 * @returns {object|null}
 */
export function getCurrentUser() {
  try {
    const profile = localStorage.getItem('profile');
    return profile ? JSON.parse(profile) : null;
  } catch {
    return null;
  }
}

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
export function isAuthenticated() {
  return !!localStorage.getItem('token');
}
