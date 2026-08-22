/**
 * suppliers.js — Suppliers page logic (v2)
 *
 * Features:
 *  - Lists all suppliers with product count (via items.supplier_id)
 *  - Add Supplier modal  → POST /api/suppliers
 *  - Edit Supplier modal → PUT  /api/suppliers/:id
 *  - Delete confirmation → DELETE /api/suppliers/:id  (admin only)
 */

import { requireAuth, isAdmin } from './auth.js';
import { apiGet, apiPost, apiPut, apiDelete } from './api.js';
import { initNav, esc, setLoading, showBanner, hideBanner } from './nav.js';

// ── Guard ─────────────────────────────────────────────────────────────────────
const user = requireAuth();
initNav(user);

// ── State ─────────────────────────────────────────────────────────────────────
let suppliers  = [];
let items      = [];
let editingId  = null;  // null = add mode, number = edit mode

// ── DOM refs ──────────────────────────────────────────────────────────────────
const tbody          = document.getElementById('suppliers-tbody');
const cardGrid       = document.getElementById('suppliers-card-grid');
const countEl        = document.getElementById('suppliers-count');
const errorBanner    = document.getElementById('suppliers-error');
const successBanner  = document.getElementById('suppliers-success');

const modalOverlay   = document.getElementById('supplier-modal-overlay');
const modalTitle     = document.getElementById('supplier-modal-title');
const modalErrBanner = document.getElementById('supplier-modal-error');
const saveBtn        = document.getElementById('supplier-save-btn');
const cancelBtn      = document.getElementById('supplier-cancel-btn');
const closeBtn       = document.getElementById('supplier-modal-close');

const deleteOverlay   = document.getElementById('supplier-delete-overlay');
const deleteNameEl    = document.getElementById('supplier-delete-name');
const deleteConfirmBtn = document.getElementById('supplier-delete-confirm');
const deleteCancelBtn = document.getElementById('supplier-delete-cancel');
const deleteCloseBtn  = document.getElementById('supplier-delete-close');
const deleteErrBanner = document.getElementById('supplier-delete-error');
let deletingId = null;

// ── Helpers ───────────────────────────────────────────────────────────────────
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

function showSuccess(msg) {
  if (!successBanner) return;
  successBanner.textContent = msg;
  successBanner.hidden = false;
  if (errorBanner) errorBanner.hidden = true;
  setTimeout(() => successBanner.hidden = true, 4000);
}

function showError(msg) {
  if (!errorBanner) return;
  errorBanner.textContent = msg;
  errorBanner.hidden = false;
  if (successBanner) successBanner.hidden = true;
}

function validate() {
  let ok = true;
  const name  = document.getElementById('supplier-name').value.trim();
  const email = document.getElementById('supplier-email').value.trim();

  if (!name) { setFieldError('supplier-name', 'Supplier name is required.'); ok = false; }
  else clearFieldError('supplier-name');

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setFieldError('supplier-email', 'Enter a valid email address.'); ok = false;
  } else clearFieldError('supplier-email');

  return ok;
}

// ── Table + Card render ───────────────────────────────────────────────────────
function renderTable() {
  const countMap = {};
  items.forEach((i) => {
    if (i.supplier_id) countMap[i.supplier_id] = (countMap[i.supplier_id] || 0) + 1;
  });

  if (countEl) countEl.textContent = `${suppliers.length} supplier${suppliers.length !== 1 ? 's' : ''}`;

  const empty = `
    <div class="empty-state">
      <i class="fas fa-truck"></i>
      <p>No suppliers yet. Click "+ Add Supplier" to get started.</p>
    </div>`;

  if (!suppliers.length) {
    tbody.innerHTML = `<tr><td colspan="7">${empty}</td></tr>`;
    if (cardGrid) cardGrid.innerHTML = empty;
    return;
  }

  // ── Desktop table ──────────────────────────────────────────────────────────
  tbody.innerHTML = suppliers.map((s) => {
    const pc = countMap[s.id] || 0;
    return `
      <tr>
        <td class="fw-600">${esc(s.name)}</td>
        <td class="td-muted">${esc(s.contact || '—')}</td>
        <td class="td-muted">
          ${s.email ? `<a href="mailto:${esc(s.email)}" style="color:var(--color-accent);">${esc(s.email)}</a>` : '—'}
        </td>
        <td class="td-muted">${esc(s.phone || '—')}</td>
        <td class="td-muted">${esc(s.address || '—')}</td>
        <td>
          <span class="supplier-product-count">
            <i class="fas fa-box" aria-hidden="true"></i>
            ${pc} item${pc !== 1 ? 's' : ''}
          </span>
        </td>
        <td>
          <div class="td-actions">
            ${isAdmin() ? `<button class="btn-action-edit btn-edit-supplier" data-id="${s.id}" title="Edit supplier">
              <i class="fas fa-pencil"></i>
            </button>` : ''}
            ${isAdmin() ? `<button class="btn-action-delete btn-delete-supplier"
              data-id="${s.id}" data-name="${esc(s.name)}" title="Delete supplier">
              <i class="fas fa-trash"></i>
            </button>` : ''}
          </div>
        </td>
      </tr>`;
  }).join('');

  // ── Mobile cards ───────────────────────────────────────────────────────────
  if (cardGrid) {
    cardGrid.innerHTML = suppliers.map((s) => {
      const pc = countMap[s.id] || 0;
      return `
        <div class="product-card">
          <div class="product-card-header">
            <div class="product-card-image" style="background:var(--color-accent-soft);color:var(--color-accent);">
              <i class="fas fa-truck"></i>
            </div>
            <div class="product-card-info">
              <div class="product-card-name">${esc(s.name)}</div>
            </div>
          </div>
          <div class="product-card-meta">
            ${s.contact ? `<span><i class="fas fa-user"></i> ${esc(s.contact)}</span>` : ''}
            ${s.email   ? `<span><i class="fas fa-envelope"></i> ${esc(s.email)}</span>` : ''}
            ${s.phone   ? `<span><i class="fas fa-phone"></i> ${esc(s.phone)}</span>` : ''}
            ${s.address ? `<span><i class="fas fa-map-marker-alt"></i> ${esc(s.address)}</span>` : ''}
          </div>
          <div class="product-card-footer">
            <div class="product-card-footer-left">
              <span class="qty-tag ok"><i class="fas fa-box" style="font-size:0.7rem;"></i> ${pc} item${pc !== 1 ? 's' : ''}</span>
            </div>
            <div class="product-card-actions">
              ${isAdmin() ? `<button class="btn-action-edit btn-edit-supplier" data-id="${s.id}" title="Edit">
                <i class="fas fa-pencil"></i>
              </button>` : ''}
              ${isAdmin() ? `<button class="btn-action-delete btn-delete-supplier"
                data-id="${s.id}" data-name="${esc(s.name)}" title="Delete">
                <i class="fas fa-trash"></i>
              </button>` : ''}
            </div>
          </div>
        </div>`;
    }).join('');
  }

  // ── Bind events ────────────────────────────────────────────────────────────
  [tbody, cardGrid].forEach(container => {
    if (!container) return;
    container.querySelectorAll('.btn-edit-supplier').forEach(btn =>
      btn.addEventListener('click', () => openEditModal(Number(btn.dataset.id)))
    );
    container.querySelectorAll('.btn-delete-supplier').forEach(btn =>
      btn.addEventListener('click', () => openDeleteModal(Number(btn.dataset.id), btn.dataset.name))
    );
  });
}

// ── Add / Edit Modal ──────────────────────────────────────────────────────────
function openAddModal() {
  editingId = null;
  modalTitle.textContent = 'Add Supplier';
  saveBtn.textContent = 'Add Supplier';
  ['supplier-name','supplier-contact','supplier-email','supplier-phone','supplier-address']
    .forEach(id => document.getElementById(id) && (document.getElementById(id).value = ''));
  modalErrBanner.hidden = true;
  clearFieldError('supplier-name');
  clearFieldError('supplier-email');
  modalOverlay.classList.add('open');
  document.getElementById('supplier-name').focus();
}

function openEditModal(id) {
  const s = suppliers.find(x => x.id === id);
  if (!s) return;
  editingId = id;
  modalTitle.innerHTML = `<i class="fas fa-pencil"></i> Edit Supplier`;
  saveBtn.innerHTML = `<i class="fas fa-check"></i> Save Changes`;
  document.getElementById('supplier-name').value    = s.name    || '';
  document.getElementById('supplier-contact').value = s.contact || '';
  document.getElementById('supplier-email').value   = s.email   || '';
  
  if (document.getElementById('supplier-phone')) document.getElementById('supplier-phone').value = s.phone || '';
  if (document.getElementById('supplier-address')) document.getElementById('supplier-address').value = s.address || '';
  
  modalErrBanner.hidden = true;
  clearFieldError('supplier-name');
  clearFieldError('supplier-email');
  modalOverlay.classList.add('open');
  document.getElementById('supplier-name').focus();
}

function closeModal() { modalOverlay.classList.remove('open'); editingId = null; }

async function saveSupplier() {
  if (!validate()) return;

  const payload = {
    name:    document.getElementById('supplier-name').value.trim(),
    contact: document.getElementById('supplier-contact').value.trim() || null,
    email:   document.getElementById('supplier-email').value.trim()   || null,
    phone:   document.getElementById('supplier-phone') ? document.getElementById('supplier-phone').value.trim() : null,
    address: document.getElementById('supplier-address') ? document.getElementById('supplier-address').value.trim() : null,
  };

  const restore = setLoading(saveBtn, editingId ? 'Saving…' : 'Adding…');
  modalErrBanner.hidden = true;

  try {
    if (editingId) {
      await apiPut(`/api/suppliers/${editingId}`, payload);
      showSuccess(`Supplier "${payload.name}" updated.`);
    } else {
      await apiPost('/api/suppliers', payload);
      showSuccess(`Supplier "${payload.name}" added.`);
    }
    closeModal();
    await loadData();
  } catch (err) {
    modalErrBanner.textContent = err.message || 'Failed to save supplier.';
    modalErrBanner.hidden = false;
  } finally {
    restore();
  }
}

// ── Delete Modal ──────────────────────────────────────────────────────────────
function openDeleteModal(id, name) {
  deletingId = id;
  deleteNameEl.textContent = name;
  deleteErrBanner.hidden = true;
  deleteOverlay.classList.add('open');
}

function closeDeleteModal() { deleteOverlay.classList.remove('open'); deletingId = null; }

deleteConfirmBtn.addEventListener('click', async () => {
  if (!deletingId) return;
  deleteErrBanner.hidden = true;
  const restore = setLoading(deleteConfirmBtn, 'Deleting…');
  try {
    await apiDelete(`/api/suppliers/${deletingId}`);
    closeDeleteModal();
    showSuccess('Supplier deleted. Linked items are now unassigned.');
    await loadData();
  } catch (err) {
    deleteErrBanner.textContent = err.message || 'Failed to delete supplier.';
    deleteErrBanner.hidden = false;
  } finally {
    restore();
  }
});

deleteCancelBtn.addEventListener('click', closeDeleteModal);
deleteCloseBtn.addEventListener('click', closeDeleteModal);
deleteOverlay.addEventListener('click', e => { if (e.target === deleteOverlay) closeDeleteModal(); });

// ── Data loading ──────────────────────────────────────────────────────────────
async function loadData() {
  try {
    const [suppData, itemsData] = await Promise.all([
      apiGet('/api/suppliers'),
      apiGet('/api/items'),
    ]);
    suppliers = suppData.suppliers || [];
    items     = itemsData.items   || [];
    renderTable();
  } catch (err) {
    showError(err.message || 'Failed to load suppliers.');
    tbody.innerHTML = `<tr><td colspan="7">
      <div class="empty-state"><i class="fas fa-circle-exclamation text-danger"></i><p>${esc(err.message)}</p></div>
    </td></tr>`;
    if (cardGrid) cardGrid.innerHTML = '';
  }
}

// ── Event wiring ──────────────────────────────────────────────────────────────
const addSupplierBtn = document.getElementById('btn-add-supplier');
if (!isAdmin()) {
  // Non-admins cannot create or edit suppliers — hide the Add button
  if (addSupplierBtn) addSupplierBtn.hidden = true;
}
addSupplierBtn.addEventListener('click', openAddModal);
saveBtn.addEventListener('click', saveSupplier);
cancelBtn.addEventListener('click', closeModal);
closeBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

// ── Boot ──────────────────────────────────────────────────────────────────────
loadData();
