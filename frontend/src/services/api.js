/**
 * Base API client with error handling and common functionality
 */

const API_BASE_URL = '';

/**
 * Make an API request with error handling
 * @param {string} url - API endpoint
 * @param {object} options - Fetch options
 * @returns {Promise<any>} Response data
 */
export async function apiRequest(url, options = {}) {
  const token = localStorage.getItem('token');

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token && !options.skipAuth) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API Request failed:', error);
    throw error;
  }
}

/**
 * GET request
 */
export function get(url, options = {}) {
  return apiRequest(url, { ...options, method: 'GET' });
}

/**
 * POST request
 */
export function post(url, data, options = {}) {
  return apiRequest(url, {
    ...options,
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * PUT request
 */
export function put(url, data, options = {}) {
  return apiRequest(url, {
    ...options,
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * DELETE request
 */
export function del(url, options = {}) {
  return apiRequest(url, { ...options, method: 'DELETE' });
}
