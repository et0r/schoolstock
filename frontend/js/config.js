/**
 * config.js — SchoolStock Frontend Configuration
 */

export const API_BASE = 'http://13.60.92.189:5000'; // deployed EC2 backend

export const APP_NAME = 'SchoolStock';

/** Token / session storage keys */
export const TOKEN_KEY = 'ss_token';
export const USER_KEY = 'ss_user';

export const DEFAULT_CATEGORIES = [
  { id: 1, name: 'Electronics' },
  { id: 2, name: 'Furniture' },
  { id: 3, name: 'Stationery' },
  { id: 4, name: 'Sports Gear' },
];

export const DEFAULT_DEPARTMENTS = [
  { id: 1, name: 'Science Lab' },
  { id: 2, name: 'Sports' },
  { id: 3, name: 'IT' },
  { id: 4, name: 'Library' },
];

export const DEFAULT_LOW_STOCK_THRESHOLD = 5;
