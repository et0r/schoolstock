/**
 * movements.js — Stock Movements page logic
 *
 * Loads and renders transaction history.
 * Provides a "Record Movement" modal that posts to /api/stock-transactions.
 * The backend handles updating item quantity automatically.
 *
 * Movement types: the UI only ever sends "in" or "out" to the API.
 * The backend translates these internally; we never display the richer
 * backend enum (added/returned/issued/removed) — we map all "in-direction"
 * values to "Stock In" and all "out-direction" values to "Stock Out".
 */

import { requireAuth } from './auth.js';
import { apiGet, apiPost } from './api.js';
import { initNav, esc, formatDate, setLoading } from './nav.js';

// ── Guard ─────────────────────────────────────────────────────────────────────
const user = requireAuth();
initNav(user);

// ── State ─────────────────────────────────────────────────────────────────────
let transactions = [];
let items        = [];

// ── DOM refs ──────────────────────────────────────────────────────────────────
const tbody          = document.getElementById('movements-tbody');
const countEl        = document.getElementById('movements-count');
const errorBanner    = document.getElementById('movements-error');
const successBanner  = document.getElementById('movements-success');

const modalOverlay   = document.getElementById('movement-modal-overlay');
const modalErrBanner = document.getElementById('movement-modal-error');
const saveBtn        = document.getElementById('movement-save-btn');
const cancelBtn      = document.getElementById('movement-cancel-btn');
const closeBtn       = document.getElementById('movement-modal-close');

// ── Type helpers ──────────────────────────────────────────────────────────────
function resolveType(type) {
  // Handle both the short form and the backend's richer enum
  const isIn = type === 'in' || type === 'added' || type === 'returned';
  return isIn ? 'in' : 'out';
}

function typeBadge(type) {
  const dir = resolveType(type);
  return dir === 'in'
    ? `<span class="badge badge-stock-in"><i class="fas fa-arrow-down" aria-hidden="true"></i> Stock In</span>`
    : `<span class="badge badge-stock-out"><i class="fas fa-arrow-up" aria-hidden="true"></i> Stock Out</span>`;
}

// ── Table render ──────────────────────────────────────────────────────────────
function renderTable() {
  const itemMap = {};
  items.forEach((i) => { itemMap[i.id] = i; });

  // Sort newest first
  const sorted = [...transactions].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );

  if (countEl) countEl.textContent = `${sorted.length} transaction${sorted.length !== 1 ? 's' : ''}`;

  if (!sorted.length) {
    tbody.innerHTML = `<tr><td colspan="5">
      <div class="empty-state">
        <i class="fas fa-right-left"></i>
        <p>No stock movements recorded yet.</p>
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = sorted.map((tx) => {
    const item = itemMap[tx.item_id];
    const itemName = item ? esc(item.name) : `<span class="text-muted">Item #${tx.item_id}</span>`;
    return `
      <tr>
        <td class="fw-600">${itemName}</td>
        <td>${typeBadge(tx.type)}</td>
        <td>
          <span class="qty-tag ${resolveType(tx.type) === 'in' ? 'ok' : 'out'}">
            ${resolveType(tx.type) === 'in' ? '+' : '-'}${esc(tx.quantity_changed)}
          </span>
        </td>
        <td class="td-muted">${formatDate(tx.timestamp)}</td>
        <td class="td-muted">${esc(tx.notes || '—')}</td>
      </tr>`;
  }).join('');
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function openModal() {
  // Populate product dropdown
  const itemSel = document.getElementById('movement-item');
  itemSel.innerHTML = `<option value="">Select a product…</option>` +
    items.map((i) => `<option value="${esc(i.id)}">${esc(i.name)}${i.sku ? ` (${esc(i.sku)})` : ''} — Qty: ${esc(i.quantity)}</option>`).join('');

  document.getElementById('movement-type').value  = '';
  document.getElementById('movement-qty').value   = '';
  document.getElementById('movement-notes').value = '';
  modalErrBanner.hidden = true;

  clearFieldError('movement-item');
  clearFieldError('movement-type');
  clearFieldError('movement-qty');

  modalOverlay.classList.add('open');
  itemSel.focus();
}

function closeModal() {
  modalOverlay.classList.remove('open');
}

function clearFieldError(id) {
  const errEl = document.getElementById('err-' + id);
  const input = document.getElementById(id);
  if (errEl) { errEl.hidden = true; errEl.textContent = ''; }
  if (input) input.classList.remove('error');
}

function setFieldError(id, msg) {
  const errEl = document.getElementById('err-' + id);
  const input = document.getElementById(id);
  if (errEl) { errEl.textContent = msg; errEl.hidden = !msg; }
  if (input) { msg ? input.classList.add('error') : input.classList.remove('error'); }
}

function validate() {
  let ok = true;
  const itemId = document.getElementById('movement-item').value;
  const type   = document.getElementById('movement-type').value;
  const qty    = document.getElementById('movement-qty').value;

  if (!itemId) { setFieldError('movement-item', 'Please select a product.'); ok = false; }
  else clearFieldError('movement-item');

  if (!type) { setFieldError('movement-type', 'Please select a movement type.'); ok = false; }
  else clearFieldError('movement-type');

  if (!qty || isNaN(Number(qty)) || Number(qty) < 1) {
    setFieldError('movement-qty', 'Enter a valid quantity (1 or more).'); ok = false;
  } else clearFieldError('movement-qty');

  return ok;
}

async function recordMovement() {
  if (!validate()) return;

  const item_id          = Number(document.getElementById('movement-item').value);
  const type             = document.getElementById('movement-type').value;        // "in" | "out"
  const quantity_changed = Number(document.getElementById('movement-qty').value);
  const notes            = document.getElementById('movement-notes').value.trim() || undefined;

  const restore = setLoading(saveBtn, 'Recording…');
  modalErrBanner.hidden = true;

  try {
    await apiPost('/api/stock-transactions', { item_id, type, quantity_changed, notes });
    closeModal();
    successBanner.textContent = 'Movement recorded successfully.';
    successBanner.hidden = false;
    setTimeout(() => { successBanner.hidden = true; }, 4000);
    await loadData();
  } catch (err) {
    modalErrBanner.textContent = err.message || 'Failed to record movement.';
    modalErrBanner.hidden = false;
  } finally {
    restore();
  }
}

// ── Data loading ──────────────────────────────────────────────────────────────
async function loadData() {
  try {
    const [txData, itemsData] = await Promise.all([
      apiGet('/api/stock-transactions'),
      apiGet('/api/items'),
    ]);
    transactions = txData.transactions || [];
    items        = itemsData.items     || [];
    renderTable();
  } catch (err) {
    errorBanner.textContent = err.message;
    errorBanner.hidden = false;
    tbody.innerHTML = `<tr><td colspan="5">
      <div class="empty-state">
        <i class="fas fa-circle-exclamation text-danger"></i>
        <p>${esc(err.message)}</p>
      </div>
    </td></tr>`;
  }
}

// ── Event wiring ──────────────────────────────────────────────────────────────
document.getElementById('btn-record-movement').addEventListener('click', openModal);
saveBtn.addEventListener('click', recordMovement);
cancelBtn.addEventListener('click', closeModal);
closeBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

// ── Boot ──────────────────────────────────────────────────────────────────────
loadData();
