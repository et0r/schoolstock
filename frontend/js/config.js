/**
 * config.js — SchoolStock Frontend Configuration
 *
 * THIS IS THE ONLY PLACE you set the backend URL.
 * Change API_BASE to point at your deployed EC2 instance before going live.
 *
 * Local dev:   'http://localhost:5000'
 * Production:  'http://13.60.92.189:5000'   ← current deployed backend
 *
 * Update this value if the backend moves to a new IP or domain.
 */

export const API_BASE = 'http://13.60.92.189:5000'; // deployed EC2 backend

export const APP_NAME = 'SchoolStock';

/** Token / session storage keys */
export const TOKEN_KEY = 'ss_token';
export const USER_KEY = 'ss_user';

/**
 * Fallback data — used when /api/categories or /api/departments endpoints
 * are not yet available on the backend (routes not wired in server.js).
 * These must match the actual database rows.
 */
export const DEFAULT_CATEGORIES = [
  { id: 1, name: 'Electronics' },
  { id: 2, name: 'Furniture'   },
  { id: 3, name: 'Stationery'  },
  { id: 4, name: 'Sports Gear' },
];

export const DEFAULT_DEPARTMENTS = [
  { id: 1, name: 'Science Lab' },
  { id: 2, name: 'Sports'      },
  { id: 3, name: 'IT'          },
  { id: 4, name: 'Library'     },
];

/**
 * Default low-stock threshold used in alerts and dashboard widgets.
 * The `items` table does not have a `threshold` column in the current schema.
 * Items with quantity > 0 and quantity <= this value are flagged as low stock.
 */
export const DEFAULT_LOW_STOCK_THRESHOLD = 10;
