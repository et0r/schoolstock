/**
 * alerts.js — Alerts page logic
 *
 * Computes alert lists entirely client-side from GET /api/items.
 * No separate alerts endpoint — items carry a `threshold` field.
 *
 * Two categories:
 *   Out of Stock  — quantity === 0
 *   Low Stock     — quantity > 0 && quantity <= threshold (and threshold > 0)
 */

import { requireAuth } from './auth.js';
import { apiGet } from './api.js';
import { initNav, esc } from './nav.js';
import { DEFAULT_LOW_STOCK_THRESHOLD } from './config.js';

// ── Guard ─────────────────────────────────────────────────────────────────────
const user = requireAuth();
initNav(user);

// ── DOM refs ──────────────────────────────────────────────────────────────────
const contentEl   = document.getElementById('alerts-content');
const summaryEl   = document.getElementById('alerts-summary');
const errorBanner = document.getElementById('alerts-error');
const refreshBtn  = document.getElementById('btn-refresh-alerts');

// ── Render helpers ────────────────────────────────────────────────────────────
function alertCard(item, severity) {
  const isDanger = severity === 'danger';
  const icon     = isDanger ? 'fa-circle-xmark' : 'fa-triangle-exclamation';
  const qtyClass = isDanger ? 'danger' : 'warning';

  // Show a stock-fill bar relative to DEFAULT_LOW_STOCK_THRESHOLD for low-stock items
  const pct      = isDanger ? 0 : Math.min(100, Math.round((item.quantity / DEFAULT_LOW_STOCK_THRESHOLD) * 100));
  const barClass = isDanger ? 'out' : 'low';

  return `
    <div class="alert-item-card">
      <div class="alert-item-icon ${severity}">
        <i class="fas ${icon}" aria-hidden="true"></i>
      </div>
      <div class="alert-item-info">
        <p class="alert-item-name">${esc(item.name)}</p>
        <div class="alert-item-meta" style="display:flex; flex-wrap:wrap; gap:0.4rem; align-items:center;">
          ${item.sku ? `<span>SKU: ${esc(item.sku)}</span>` : ''}
          ${item.sku && item.category ? `<span>·</span>` : ''}
          ${item.category ? `<span>Cat: ${esc(item.category)}</span>` : ''}
          ${(item.sku || item.category) ? `<span>·</span>` : ''}
          <span>Unit: ${esc(item.unit || '—')}</span>
        </div>
        ${!isDanger ? `
        <div style="margin-top:0.5rem;">
          <div class="stock-bar-wrapper" style="min-width:120px; display:inline-block; vertical-align:middle;">
            <div class="stock-bar ${barClass}" style="width:${pct}%"></div>
          </div>
          <span style="font-size:0.72rem; color:var(--color-text-muted); margin-left:0.5rem;">
            ${item.quantity} / ${DEFAULT_LOW_STOCK_THRESHOLD} (alert threshold)
          </span>
        </div>` : ''}
      </div>
      <div class="alert-item-stats">
        <div class="alert-stat">
          <p class="alert-stat-val ${qtyClass}">${esc(item.quantity)}</p>
          <p class="alert-stat-lbl">Current</p>
        </div>
        <div class="alert-stat">
          <p class="alert-stat-val" style="color:var(--color-text-muted);">${DEFAULT_LOW_STOCK_THRESHOLD}</p>
          <p class="alert-stat-lbl">Alert at</p>
        </div>
      </div>
    </div>`;
}

function renderAlerts(items) {
  const outOfStock = items.filter((i) => i.quantity === 0);
  const lowStock   = items.filter((i) => {
    const t = i.threshold ?? DEFAULT_LOW_STOCK_THRESHOLD;
    return i.quantity > 0 && t > 0 && i.quantity <= t;
  });

  // Summary chips
  summaryEl.innerHTML = `
    <div class="alerts-summary-chip danger">
      <i class="fas fa-circle-xmark" aria-hidden="true"></i>
      ${outOfStock.length} Out of Stock
    </div>
    <div class="alerts-summary-chip warning">
      <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
      ${lowStock.length} Low Stock
    </div>`;

  if (!outOfStock.length && !lowStock.length) {
    contentEl.innerHTML = `
      <div class="card">
        <div class="card-body">
          <div class="empty-state">
            <i class="fas fa-check-circle" style="color:var(--color-success-dark); font-size:3.5rem;"></i>
            <p style="font-size:1rem; font-weight:600; color:var(--color-text);">All clear!</p>
            <p>No stock alerts at this time. All products are within healthy levels.</p>
          </div>
        </div>
      </div>`;
    return;
  }

  let html = '';

  if (outOfStock.length) {
    html += `
      <div class="alerts-section">
        <h2 class="alerts-section-title danger">
          <i class="fas fa-circle-xmark" aria-hidden="true"></i>
          Out of Stock (${outOfStock.length})
        </h2>
        ${outOfStock.map((i) => alertCard(i, 'danger')).join('')}
      </div>`;
  }

  if (lowStock.length) {
    html += `
      <div class="alerts-section">
        <h2 class="alerts-section-title warning">
          <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
          Low Stock (${lowStock.length})
        </h2>
        ${lowStock.map((i) => alertCard(i, 'warning')).join('')}
      </div>`;
  }

  contentEl.innerHTML = html;
}

// ── Data loading ──────────────────────────────────────────────────────────────
async function loadAlerts() {
  contentEl.innerHTML = `<div class="spinner-wrapper"><div class="spinner"></div><p class="spinner-text">Checking inventory…</p></div>`;
  summaryEl.innerHTML = '';
  errorBanner.hidden = true;

  try {
    const data  = await apiGet('/api/items');
    const items = data.items || [];
    renderAlerts(items);
  } catch (err) {
    errorBanner.textContent = err.message;
    errorBanner.hidden = false;
    contentEl.innerHTML = '';
  }
}

// ── Event wiring ──────────────────────────────────────────────────────────────
refreshBtn.addEventListener('click', loadAlerts);

// ── Boot ──────────────────────────────────────────────────────────────────────
loadAlerts();
