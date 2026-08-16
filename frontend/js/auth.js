/**
 * auth.js — Session management for SchoolStock
 *
 * Handles storing/retrieving the JWT and user object from localStorage,
 * protecting pages that require authentication, and logging out.
 */

import { TOKEN_KEY, USER_KEY } from './config.js';

/**
 * Persist a new session after a successful login or register.
 * @param {string} token
 * @param {{ userId, username, role }} user
 */
export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/** Read the raw JWT string (or null if not logged in). */
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Read the stored user object.
 * @returns {{ userId: number, username: string, role: string } | null}
 */
export function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Returns true when the logged-in user has the 'admin' role. */
export function isAdmin() {
  const user = getUser();
  return user?.role === 'admin';
}

/**
 * Clear the session and redirect to the login page.
 * Call this on logout or whenever a 401 is received (api.js already calls it
 * automatically, but feature code can call it too, e.g. on an explicit Logout click).
 */
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.location.href = '/index.html';
}

/**
 * Guard for every protected page.
 * Call at the very top of each feature module's init function.
 * Redirects to login if there is no valid session, otherwise returns the user.
 *
 * @returns {{ userId: number, username: string, role: string }}
 */
export function requireAuth() {
  const token = getToken();
  const user  = getUser();
  if (!token || !user) {
    window.location.href = '/index.html';
    throw new Error('Not authenticated'); // stops further script execution
  }
  return user;
}
