/**
 * api.js — Centralised fetch wrapper for SchoolStock
 *
 * All HTTP calls to the backend go through `apiFetch()`.
 * It handles:
 *   - Prepending API_BASE so the URL is never hard-coded in feature modules
 *   - Injecting the Authorization header for authenticated requests
 *   - Parsing JSON responses
 *   - Surfacing the backend's { error } field on non-OK responses
 *   - Auto-clearing the session and redirecting to login on 401
 */

import { API_BASE, TOKEN_KEY } from './config.js';

/**
 * Core fetch wrapper.
 *
 * @param {string} path        - API path, e.g. '/api/items'
 * @param {object} [options]   - fetch options (method, body, headers, etc.)
 * @param {boolean} [auth=true] - whether to attach the Bearer token
 * @returns {Promise<any>}     - parsed JSON body on success
 * @throws {{ status: number, message: string }} on non-OK responses
 */
export async function apiFetch(path, options = {}, auth = true) {
  const headers = { ...(options.headers || {}) };

  // Only set Content-Type to JSON if we're NOT sending FormData
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (auth) {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const url = `${API_BASE}${path}`;

  let response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (networkErr) {
    throw { status: 0, message: 'Network error — could not reach the server. Check your connection.' };
  }

  // Handle 401: expired/invalid token → force logout
  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('ss_user');
    window.location.href = '/index.html';
    // Throw so any awaiting code stops execution
    throw { status: 401, message: 'Session expired. Please log in again.' };
  }

  // Parse JSON (all endpoints return JSON, even errors)
  let data;
  try {
    data = await response.json();
  } catch {
    throw { status: response.status, message: 'Unexpected non-JSON response from server.' };
  }

  if (!response.ok) {
    throw {
      status: response.status,
      message: data.error || `Server error (${response.status})`,
    };
  }

  return data;
}

// ─── Convenience wrappers ────────────────────────────────────────────────────

export const apiGet = (path) => apiFetch(path, { method: 'GET' });

export const apiPost = (path, body, auth = true) =>
  apiFetch(
    path,
    {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    },
    auth
  );

export const apiPut = (path, body) =>
  apiFetch(path, {
    method: 'PUT',
    body: body instanceof FormData ? body : JSON.stringify(body),
  });

export const apiDelete = (path) => apiFetch(path, { method: 'DELETE' });

export const apiPatch = (path, body) =>
  apiFetch(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
