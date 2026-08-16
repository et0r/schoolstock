/**
 * nav.js — Sidebar rendering, mobile nav toggle, and shared DOM utilities
 *
 * Call `initNav()` at the top of every protected page module.
 * It renders the sidebar, marks the active link, populates the user
 * profile block, computes the alert badge count, and wires up the
 * mobile hamburger / overlay toggle.
 *
 * Also exports `esc()` — a minimal XSS-safe HTML escaper.
 */

import { clearSession } from './auth.js';
import { apiGet } from './api.js';
import { DEFAULT_LOW_STOCK_THRESHOLD } from './config.js';

// ─── XSS Helper ──────────────────────────────────────────────────────────────

const ESC_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escape a string for safe insertion into HTML.
 * @param {any} val
 * @returns {string}
 */
export function esc(val) {
  if (val === null || val === undefined) return '';
  return String(val).replace(/[&<>"']/g, (ch) => ESC_MAP[ch]);
}

// ─── Sidebar HTML ─────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: '/dashboard.html', icon: 'fa-gauge-high',     label: 'Dashboard',       section: 'Main'   },
  { href: '/products.html',  icon: 'fa-boxes-stacked',  label: 'Inventory',       section: 'Main'   },
  { href: '/movements.html', icon: 'fa-right-left',     label: 'Stock Movements', section: 'Main'   },
  { href: '/suppliers.html', icon: 'fa-truck',          label: 'Suppliers',       section: 'Main'   },
  { href: '/alerts.html',    icon: 'fa-bell',           label: 'Alerts',          section: 'Main',  id: 'nav-alerts' },
  { href: '/users.html',     icon: 'fa-users-gear',     label: 'User Management', section: 'Admin', adminOnly: true  },
];

function buildSidebar(user, alertCount) {
  const currentPath = window.location.pathname;
  const isAdminUser = user.role === 'admin';

  // Group items by section
  let lastSection = null;
  const navLinks = NAV_ITEMS
    .filter(item => !item.adminOnly || isAdminUser)
    .map((item) => {
      const isActive = currentPath.endsWith(item.href.replace('/', '')) || currentPath === item.href;
      const badge =
        item.id === 'nav-alerts' && alertCount > 0
          ? `<span class="nav-badge">${alertCount > 99 ? '99+' : alertCount}</span>`
          : '';
      const sectionLabel = item.section && item.section !== lastSection
        ? `<div class="sidebar-section-label">${item.section}</div>`
        : '';
      lastSection = item.section;
      return `
        ${sectionLabel}
        <a href="${item.href}" class="nav-link${isActive ? ' active' : ''}"${item.id ? ` id="${item.id}"` : ''}>
          <i class="fas ${item.icon}"></i>
          <span>${item.label}</span>
          ${badge}
        </a>`;
    }).join('');

  // Handle both 'username' (auth payload field) and 'name' (DB column)
  const displayName = user.username || user.name || 'User';
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

  const roleLabel = user.role === 'admin'  ? 'Administrator'
                  : user.role === 'clerk'  ? 'Clerk'
                  : 'Staff';

  return `
    <aside class="sidebar" id="sidebar" aria-label="Main navigation">
      <div class="sidebar-header">
        <div class="sidebar-logo">
          <i class="fas fa-warehouse"></i>
          <span>SchoolStock</span>
        </div>
        <button class="sidebar-close-btn" id="sidebar-close-btn" aria-label="Close navigation">
          <i class="fas fa-xmark"></i>
        </button>
      </div>

      <nav class="sidebar-nav">
        ${navLinks}
      </nav>

      <div class="sidebar-footer">
        <div class="user-profile">
          <div class="user-avatar" aria-hidden="true">${esc(initials)}</div>
          <div class="user-info">
            <p class="user-name">${esc(displayName)}</p>
            <p class="user-role">${esc(roleLabel)}</p>
          </div>
          <button class="btn-logout" id="btn-logout" title="Log out" aria-label="Log out">
            <i class="fas fa-right-from-bracket"></i>
          </button>
        </div>
      </div>
    </aside>`;
}

// ─── Mobile Nav helpers ───────────────────────────────────────────────────────

function openSidebar() {
  document.getElementById('sidebar')?.classList.add('sidebar-open');
  document.getElementById('mobile-overlay')?.classList.add('overlay-open');
  document.getElementById('mobile-menu-btn')?.setAttribute('aria-expanded', 'true');
  document.body.classList.add('nav-open');
}

function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('sidebar-open');
  document.getElementById('mobile-overlay')?.classList.remove('overlay-open');
  document.getElementById('mobile-menu-btn')?.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('nav-open');
}

/**
 * Inject the mobile hamburger button (into .page-header) and the
 * full-screen overlay (into <body>).  Idempotent — safe to call multiple times.
 */
function injectMobileElements() {
  // Overlay
  if (!document.getElementById('mobile-overlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'mobile-overlay';
    overlay.className = 'mobile-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.addEventListener('click', closeSidebar);
    document.body.appendChild(overlay);
  }

  // Hamburger button in .page-header
  if (!document.getElementById('mobile-menu-btn')) {
    const pageHeader = document.querySelector('.page-header');
    if (pageHeader) {
      const btn = document.createElement('button');
      btn.id = 'mobile-menu-btn';
      btn.className = 'mobile-menu-btn';
      btn.setAttribute('aria-label', 'Open navigation menu');
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-controls', 'sidebar');
      btn.innerHTML = '<i class="fas fa-bars" aria-hidden="true"></i>';
      btn.addEventListener('click', openSidebar);
      pageHeader.insertBefore(btn, pageHeader.firstChild);
    }
  }
}

/**
 * Wire all sidebar events after every innerHTML rebuild.
 * @param {HTMLElement} root - #sidebar-root element
 */
function wireEvents(root) {
  // Logout
  document.getElementById('btn-logout')?.addEventListener('click', () => clearSession());

  // Close sidebar on internal close button (mobile)
  document.getElementById('sidebar-close-btn')?.addEventListener('click', closeSidebar);

  // Close sidebar when a nav link is clicked on mobile
  root.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 768) closeSidebar();
    });
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Render the sidebar into #sidebar-root, wire mobile nav, and
 * asynchronously compute + render the alert badge.
 *
 * @param {object} user  - User object from getUser()
 */
export async function initNav(user) {
  const root = document.getElementById('sidebar-root');
  if (!root) return;

  // First render (badge = 0 initially)
  root.innerHTML = buildSidebar(user, 0);
  wireEvents(root);

  // Inject mobile elements (only added once, idempotent)
  injectMobileElements();

  // Fetch alert count in the background — non-blocking
  try {
    const data  = await apiGet('/api/items');
    const items = data.items || [];
    const alertCount = items.filter((i) => {
      const threshold = i.threshold ?? DEFAULT_LOW_STOCK_THRESHOLD;
      return i.quantity === 0 || (i.quantity > 0 && i.quantity <= threshold);
    }).length;

    if (alertCount > 0) {
      root.innerHTML = buildSidebar(user, alertCount);
      wireEvents(root);
    }
  } catch {
    // Non-fatal — badge stays at 0
  }
}

// ─── Shared UI helpers ────────────────────────────────────────────────────────

/**
 * Show an inline error/success banner inside a container element.
 */
export function showBanner(container, message, type = 'error') {
  let banner = container.querySelector('.alert-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.className = 'alert-banner';
    container.prepend(banner);
  }
  banner.className = `alert-banner alert-banner--${type}`;
  banner.textContent = message;
  banner.hidden = false;
  if (type === 'success') {
    setTimeout(() => { banner.hidden = true; }, 4000);
  }
}

/** Hide a banner inside a container. */
export function hideBanner(container) {
  const banner = container.querySelector('.alert-banner');
  if (banner) banner.hidden = true;
}

/**
 * Set a button into loading state (disabled + spinner text).
 * Returns a restore function.
 */
export function setLoading(btn, loadingText = 'Saving…') {
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${esc(loadingText)}`;
  return () => {
    btn.disabled = false;
    btn.innerHTML = original;
  };
}

/** Render a full-page loading spinner inside a container. */
export function renderSpinner(container) {
  container.innerHTML = `
    <div class="spinner-wrapper">
      <div class="spinner"></div>
      <p class="spinner-text">Loading…</p>
    </div>`;
}

/** Render an empty-state message inside a container. */
export function renderEmpty(container, message = 'No data found.', icon = 'fa-inbox') {
  container.innerHTML = `
    <div class="empty-state">
      <i class="fas ${esc(icon)}"></i>
      <p>${esc(message)}</p>
    </div>`;
}

/**
 * Format an ISO/UTC timestamp string to a readable local datetime.
 */
export function formatDate(ts) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

/**
 * Build a <select> populated with { id, name } items.
 */
export function populateSelect(sel, items, placeholder, selectedId = null) {
  sel.innerHTML = `<option value="">${esc(placeholder)}</option>` +
    items.map((i) =>
      `<option value="${esc(i.id)}"${String(i.id) === String(selectedId) ? ' selected' : ''}>${esc(i.name)}</option>`
    ).join('');
}
