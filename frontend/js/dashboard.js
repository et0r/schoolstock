/**
 * dashboard.js — Dashboard page logic
 *
 * Fetches items + stock transactions in parallel, then renders:
 *   - 4 stat cards (total, in-stock, low-stock, out-of-stock)
 *   - Low-stock widget (up to 5 items)
 *   - Recent activity feed (last 10 transactions)
 */

import { requireAuth, getUser } from './auth.js';
import { apiGet } from './api.js';
import { initNav, esc, formatDate } from './nav.js';
import { DEFAULT_LOW_STOCK_THRESHOLD } from './config.js';

// ── Guard ─────────────────────────────────────────────────────────────────────
const user = requireAuth();

// ── Date header ───────────────────────────────────────────────────────────────
const dateEl = document.getElementById('dashboard-date');
if (dateEl) {
  dateEl.textContent = new Date().toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

// ── Init nav (non-blocking) ───────────────────────────────────────────────────
initNav(user);

// ── Helpers ───────────────────────────────────────────────────────────────────
function stockStatus(item) {
  if (item.quantity === 0) return 'out';
  const threshold = item.threshold ?? DEFAULT_LOW_STOCK_THRESHOLD;
  if (threshold > 0 && item.quantity <= threshold) return 'low';
  return 'ok';
}

function renderStatCard(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

// ── Low Stock Widget ──────────────────────────────────────────────────────────
function renderLowStock(items) {
  const body = document.getElementById('low-stock-body');
  const alertItems = items
    .filter((i) => stockStatus(i) !== 'ok')
    .sort((a, b) => a.quantity - b.quantity)
    .slice(0, 8);

  if (!alertItems.length) {
    body.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-check-circle" style="color:var(--color-success-dark)"></i>
        <p>All products are well stocked!</p>
      </div>`;
    return;
  }

  body.innerHTML = alertItems.map((item) => {
    const status = stockStatus(item);
    const pct = item.quantity === 0
      ? 0
      : Math.min(100, Math.round((item.quantity / DEFAULT_LOW_STOCK_THRESHOLD) * 100));

    return `
      <div class="low-stock-item">
        <div class="low-stock-info" style="min-width:0;flex:1;">
          <p class="low-stock-name">${esc(item.name)}</p>
          <p class="low-stock-sku">${esc(item.sku || 'No SKU')}</p>
        </div>
        <div class="stock-bar-wrapper">
          <div class="stock-bar ${status}" style="width:${pct}%"></div>
        </div>
        <span class="low-stock-qty ${status}">
          ${esc(item.quantity)} ${esc(item.unit || '')}
        </span>
      </div>`;
  }).join('');
}

// ── Activity Feed ─────────────────────────────────────────────────────────────
function renderActivity(transactions, items) {
  const body = document.getElementById('activity-body');

  // Build a quick lookup: item_id → item name
  const itemMap = {};
  items.forEach((i) => { itemMap[i.id] = i; });

  const recent = [...transactions]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 10);

  if (!recent.length) {
    body.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i><p>No transactions yet.</p></div>`;
    return;
  }

  // Map backend type values to display labels and direction
  const typeInfo = (t) => {
    // Backend stores 'added','returned','issued','removed' but UI only cares in/out
    const isIn = t === 'in' || t === 'added' || t === 'returned';
    return isIn
      ? { label: 'Stock In',  cls: 'in',  icon: 'fa-arrow-down' }
      : { label: 'Stock Out', cls: 'out', icon: 'fa-arrow-up'   };
  };

  body.innerHTML = `<div class="activity-list">` +
    recent.map((tx) => {
      const item = itemMap[tx.item_id];
      const itemName = item ? esc(item.name) : `Item #${tx.item_id}`;
      const info = typeInfo(tx.type);
      return `
        <div class="activity-item">
          <div class="activity-icon ${info.cls}" aria-hidden="true">
            <i class="fas ${info.icon}"></i>
          </div>
          <div class="activity-text">
            <p class="activity-title">
              <strong>${info.label}</strong> — ${itemName}
              <span class="text-muted"> &times;${esc(tx.quantity_changed)}</span>
            </p>
            <p class="activity-meta">${formatDate(tx.timestamp)}${tx.notes ? ` · ${esc(tx.notes)}` : ''}</p>
          </div>
        </div>`;
    }).join('') + `</div>`;
}

// ── Main fetch ────────────────────────────────────────────────────────────────
async function loadDashboard() {
  const errEl = document.getElementById('dashboard-error');

  try {
    const [itemsData, txData] = await Promise.all([
      apiGet('/api/items'),
      apiGet('/api/stock-transactions'),
    ]);

    const items        = itemsData.items || [];
    const transactions = txData.transactions || [];

    // Stat cards
    const total   = items.length;
    const outOf   = items.filter((i) => i.quantity === 0).length;
    const low     = items.filter((i) => {
      const t = i.threshold ?? DEFAULT_LOW_STOCK_THRESHOLD;
      return i.quantity > 0 && t > 0 && i.quantity <= t;
    }).length;
    const inStock = total - outOf - low;

    renderStatCard('stat-total',        total);
    renderStatCard('stat-in-stock',     inStock);
    renderStatCard('stat-low-stock',    low);
    renderStatCard('stat-out-of-stock', outOf);

    // Widgets
    renderLowStock(items);
    renderActivity(transactions, items);

  } catch (err) {
    // Stock transactions endpoint might not exist yet — fall back gracefully
    if (err.status === 404 || err.status === 0) {
      // Try fetching just items
      try {
        const itemsData = await apiGet('/api/items');
        const items = itemsData.items || [];

        const total   = items.length;
        const outOf   = items.filter((i) => i.quantity === 0).length;
        const low     = items.filter((i) => {
          const t = i.threshold ?? DEFAULT_LOW_STOCK_THRESHOLD;
          return i.quantity > 0 && t > 0 && i.quantity <= t;
        }).length;
        const inStock = total - outOf - low;

        renderStatCard('stat-total',        total);
        renderStatCard('stat-in-stock',     inStock);
        renderStatCard('stat-low-stock',    low);
        renderStatCard('stat-out-of-stock', outOf);

        renderLowStock(items);

        const activityBody = document.getElementById('activity-body');
        activityBody.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-info-circle" style="color:var(--color-info)"></i>
            <p>Stock transaction history is not yet available.</p>
          </div>`;
      } catch (innerErr) {
        errEl.textContent = innerErr.message;
        errEl.hidden = false;
      }
    } else {
      errEl.textContent = err.message;
      errEl.hidden = false;
    }
  }
}

loadDashboard();
