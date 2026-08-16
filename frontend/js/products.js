/**
 * products.js — Products page logic
 *
 * Responsibilities:
 *  - Load items, categories, departments, suppliers in parallel
 *  - Render product table with status badges (In Stock / Low Stock / Out of Stock)
 *  - Client-side filtering (All / Low Stock / Out of Stock) and search
 *  - Add Product modal → POST /api/items (multipart if image, JSON otherwise)
 *  - Edit Product modal → PUT /api/items/:id
 *  - Delete Product (admin only) → DELETE /api/items/:id
 *  - Surface all server errors in the UI
 */

import { requireAuth, isAdmin } from './auth.js';
import { apiGet, apiPost, apiPut, apiDelete, apiFetch } from './api.js';
import { initNav, esc, populateSelect, showBanner, setLoading } from './nav.js';
import { DEFAULT_CATEGORIES, DEFAULT_DEPARTMENTS, DEFAULT_LOW_STOCK_THRESHOLD } from './config.js';

// ── Guard ─────────────────────────────────────────────────────────────────────
const user = requireAuth();
initNav(user);

// ── State ─────────────────────────────────────────────────────────────────────
let allItems      = [];
let categories    = [];
let departments   = [];
let suppliers     = [];
let activeFilter  = 'all';
let searchQuery   = '';
let editingId     = null;  // null = add mode, number = edit mode
let deletingId    = null;
let deletingName  = '';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const tbody          = document.getElementById('products-tbody');
const cardGrid       = document.getElementById('products-card-grid');
const errorBanner    = document.getElementById('products-error');
const successBanner  = document.getElementById('products-success');
const searchInput    = document.getElementById('product-search');

// Product modal
const productOverlay  = document.getElementById('product-modal-overlay');
const productTitle    = document.getElementById('product-modal-title');
const productForm     = document.getElementById('product-form');
const productSaveBtn  = document.getElementById('product-save-btn');
const productCancelBtn = document.getElementById('product-cancel-btn');
const productCloseBtn = document.getElementById('product-modal-close');
const modalErrBanner  = document.getElementById('product-modal-error');

// Delete modal
const deleteOverlay   = document.getElementById('delete-modal-overlay');
const deleteNameEl    = document.getElementById('delete-item-name');
const deleteConfirmBtn = document.getElementById('delete-confirm-btn');
const deleteCancelBtn = document.getElementById('delete-cancel-btn');
const deleteCloseBtn  = document.getElementById('delete-modal-close');
const deleteErrBanner = document.getElementById('delete-modal-error');

// ── Status helpers ────────────────────────────────────────────────────────────
function stockStatus(item) {
  if (item.quantity === 0) return 'out';
  const threshold = item.threshold ?? DEFAULT_LOW_STOCK_THRESHOLD;
  if (threshold > 0 && item.quantity <= threshold) return 'low';
  return 'ok';
}


function statusBadge(item) {
  const s = stockStatus(item);
  if (s === 'out') return `<span class="badge badge-danger"><i class="fas fa-circle-xmark"></i> Out of Stock</span>`;
  if (s === 'low') return `<span class="badge badge-warning"><i class="fas fa-triangle-exclamation"></i> Low Stock</span>`;
  return `<span class="badge badge-success"><i class="fas fa-circle-check"></i> In Stock</span>`;
}

// ── Filtering ─────────────────────────────────────────────────────────────────
function filteredItems() {
  let list = allItems;
  if (activeFilter === 'low') list = list.filter((i) => stockStatus(i) === 'low');
  if (activeFilter === 'out') list = list.filter((i) => stockStatus(i) === 'out');
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter((i) =>
      (i.name  || '').toLowerCase().includes(q) ||
      (i.sku   || '').toLowerCase().includes(q) ||
      (i.category   || '').toLowerCase().includes(q) ||
      (i.department || '').toLowerCase().includes(q)
    );
  }
  return list;
}

// ── Table + card render ──────────────────────────────────────────────────────────────
function renderTable() {
  const items = filteredItems();

  // ── Empty state (shared) ────────────────────────────────────────────────────
  const emptyMsg = activeFilter !== 'all' || searchQuery
    ? 'No products match your filter or search.'
    : 'No products yet. Click “+ Add Product” to get started.';

  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="9">
      <div class="empty-state">
        <i class="fas fa-box-open"></i>
        <p>${emptyMsg}</p>
      </div>
    </td></tr>`;
    if (cardGrid) cardGrid.innerHTML = `<div class="empty-state">
      <i class="fas fa-box-open"></i>
      <p>${emptyMsg}</p>
    </div>`;
    return;
  }

  // ── Table rows (desktop) ────────────────────────────────────────────────────
  tbody.innerHTML = items.map((item) => {
    const imgCell = item.image_url
      ? `<img src="${esc(item.image_url)}" alt="" class="product-image-cell" loading="lazy" />`
      : `<div class="product-image-placeholder"><i class="fas fa-image"></i></div>`;

    return `
      <tr>
        <td>${imgCell}</td>
        <td class="td-muted">${esc(item.sku || '—')}</td>
        <td class="fw-600">${esc(item.name)}</td>
        <td class="td-muted">${esc(item.category   || '—')}</td>
        <td class="td-muted">${esc(item.department  || '—')}</td>
        <td>
          <span class="qty-tag ${stockStatus(item)}">${esc(item.quantity)}</span>
          <span class="td-muted" style="margin-left:0.25rem;font-size:0.75rem;">${esc(item.unit || '')}</span>
        </td>
        <td class="td-muted">${esc(item.condition || '—')}</td>
        <td>${statusBadge(item)}</td>
        <td>
          <div class="td-actions">
            <a href="item-detail?id=${item.id}"
              class="btn-action-edit" title="View details"
              aria-label="View details for ${esc(item.name)}"
              style="text-decoration:none;">
              <i class="fas fa-eye" aria-hidden="true"></i>
            </a>
            <button class="btn-action-edit btn-edit-item"
              data-id="${item.id}" title="Edit" aria-label="Edit ${esc(item.name)}">
              <i class="fas fa-pencil" aria-hidden="true"></i>
            </button>
            ${isAdmin() ? `<button class="btn-action-delete btn-delete-item"
              data-id="${item.id}" data-name="${esc(item.name)}"
              title="Delete" aria-label="Delete ${esc(item.name)}">
              <i class="fas fa-trash" aria-hidden="true"></i>
            </button>` : ''}
          </div>
        </td>
      </tr>`;
  }).join('');

  // ── Product cards (mobile) ──────────────────────────────────────────────────
  if (cardGrid) {
    cardGrid.innerHTML = items.map((item) => {
      const imgHtml = item.image_url
        ? `<img src="${esc(item.image_url)}" alt="" style="width:100%;height:100%;object-fit:cover;" loading="lazy" />`
        : `<i class="fas fa-image"></i>`;

      const s = stockStatus(item);
      const metaParts = [
        item.category   ? `<span><i class="fas fa-tag"></i> ${esc(item.category)}</span>`   : '',
        item.department ? `<span><i class="fas fa-building"></i> ${esc(item.department)}</span>` : '',
        item.condition  ? `<span><i class="fas fa-circle-info"></i> ${esc(item.condition)}</span>` : '',
      ].filter(Boolean).join('');

      return `
        <div class="product-card">
          <div class="product-card-header">
            <div class="product-card-image">${imgHtml}</div>
            <div class="product-card-info">
              <div class="product-card-name">${esc(item.name)}</div>
              ${item.sku ? `<div class="product-card-sku">${esc(item.sku)}</div>` : ''}
            </div>
          </div>
          ${metaParts ? `<div class="product-card-meta">${metaParts}</div>` : ''}
          <div class="product-card-footer">
            <div class="product-card-footer-left" style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
              <span class="qty-tag ${s}">${esc(item.quantity)} ${esc(item.unit || '')}</span>
              ${statusBadge(item)}
            </div>
            <div class="product-card-actions">
              <a href="item-detail?id=${item.id}"
                class="btn-action-edit" title="View details"
                style="text-decoration:none;">
                <i class="fas fa-eye"></i>
              </a>
              <button class="btn-action-edit btn-edit-item"
                data-id="${item.id}" title="Edit" aria-label="Edit ${esc(item.name)}">
                <i class="fas fa-pencil"></i>
              </button>
              ${isAdmin() ? `<button class="btn-action-delete btn-delete-item"
                data-id="${item.id}" data-name="${esc(item.name)}"
                title="Delete" aria-label="Delete ${esc(item.name)}">
                <i class="fas fa-trash"></i>
              </button>` : ''}
            </div>
          </div>
        </div>`;
    }).join('');
  }

  // ── Delegate events (both table + cards) ────────────────────────────────────
  [tbody, cardGrid].forEach((container) => {
    if (!container) return;
    container.querySelectorAll('.btn-edit-item').forEach((btn) =>
      btn.addEventListener('click', () => openEditModal(Number(btn.dataset.id)))
    );
    container.querySelectorAll('.btn-delete-item').forEach((btn) =>
      btn.addEventListener('click', () => openDeleteModal(Number(btn.dataset.id), btn.dataset.name))
    );
  });
}

// ── Modal helpers ─────────────────────────────────────────────────────────────
function openModal(overlay) {
  overlay.classList.add('open');
  // Focus first focusable element
  const first = overlay.querySelector('input, select, textarea, button');
  if (first) first.focus();
}

function closeModal(overlay) {
  overlay.classList.remove('open');
}

// Clear field errors
function clearFieldError(fieldId) {
  const errEl = document.getElementById('err-' + fieldId);
  const input = document.getElementById(fieldId);
  if (errEl) { errEl.hidden = true; errEl.textContent = ''; }
  if (input) input.classList.remove('error');
}

function setFieldError(fieldId, msg) {
  const errEl = document.getElementById('err-' + fieldId);
  const input = document.getElementById(fieldId);
  if (errEl) { errEl.textContent = msg; errEl.hidden = !msg; }
  if (input) { msg ? input.classList.add('error') : input.classList.remove('error'); }
}

// ── Product modal — open / populate ──────────────────────────────────────────
function resetProductForm() {
  productForm.reset();
  document.getElementById('product-id').value = '';
  document.getElementById('product-image-preview').hidden = true;
  modalErrBanner.hidden = true;
  ['product-name','product-category','product-department','product-condition','product-unit','product-quantity'].forEach(clearFieldError);
}

function openAddModal() {
  editingId = null;
  productTitle.textContent = 'Add Product';
  productSaveBtn.textContent = 'Save Product';
  resetProductForm();
  document.getElementById('product-sku').value = generateNextSKU();
  populateDropdowns();
  openModal(productOverlay);
}

function openEditModal(id) {
  const item = allItems.find((i) => i.id === id);
  if (!item) return;
  editingId = id;
  productTitle.textContent = 'Edit Product';
  productSaveBtn.textContent = 'Update Product';
  resetProductForm();
  populateDropdowns(item);

  document.getElementById('product-id').value       = item.id;
  document.getElementById('product-name').value     = item.name || '';
  document.getElementById('product-sku').value      = item.sku  || '';
  document.getElementById('product-quantity').value = item.quantity ?? 0;
  document.getElementById('product-unit').value     = item.unit || '';


  // Condition — set after DOM is ready (selects populated synchronously)
  const condSel = document.getElementById('product-condition');
  if (condSel && item.condition) condSel.value = item.condition;

  // Image preview
  if (item.image_url) {
    const preview = document.getElementById('product-image-preview');
    preview.src = item.image_url;
    preview.hidden = false;
  }

  openModal(productOverlay);
}

function populateDropdowns(item = null) {
  populateSelect(
    document.getElementById('product-category'),
    categories,
    'Select category…',
    item?.category_id
  );
  populateSelect(
    document.getElementById('product-department'),
    departments,
    'Select department…',
    item?.department_id
  );
  populateSelect(
    document.getElementById('product-supplier'),
    suppliers,
    'None (optional)',
    item?.supplier_id
  );
}

// ── Delete modal ──────────────────────────────────────────────────────────────
function openDeleteModal(id, name) {
  deletingId   = id;
  deletingName = name;
  deleteNameEl.textContent = name;
  deleteErrBanner.hidden   = true;
  openModal(deleteOverlay);
}

// ── Form validation ───────────────────────────────────────────────────────────
function validateProductForm() {
  let ok = true;

  const name = document.getElementById('product-name').value.trim();
  const cat  = document.getElementById('product-category').value;
  const dept = document.getElementById('product-department').value;
  const cond = document.getElementById('product-condition').value;
  const unit = document.getElementById('product-unit').value.trim();
  const qty  = document.getElementById('product-quantity').value;

  if (!name) { setFieldError('product-name', 'Name is required.'); ok = false; }
  else clearFieldError('product-name');

  if (!cat) { setFieldError('product-category', 'Please select a category.'); ok = false; }
  else clearFieldError('product-category');

  if (!dept) { setFieldError('product-department', 'Please select a department.'); ok = false; }
  else clearFieldError('product-department');

  if (!cond) { setFieldError('product-condition', 'Please select a condition.'); ok = false; }
  else clearFieldError('product-condition');

  if (!unit) { setFieldError('product-unit', 'Unit is required (e.g. pcs, box).'); ok = false; }
  else clearFieldError('product-unit');

  if (qty === '' || isNaN(Number(qty)) || Number(qty) < 0) {
    setFieldError('product-quantity', 'Enter a valid quantity (0 or more).'); ok = false;
  } else clearFieldError('product-quantity');

  return ok;
}

// ── Save product ──────────────────────────────────────────────────────────────
async function saveProduct() {
  if (!validateProductForm()) return;

  const name      = document.getElementById('product-name').value.trim();
  const sku       = document.getElementById('product-sku').value.trim();
  const category_id  = document.getElementById('product-category').value;
  const department_id = document.getElementById('product-department').value;
  const supplier_id  = document.getElementById('product-supplier').value || null;
  const condition = document.getElementById('product-condition').value;
  const unit      = document.getElementById('product-unit').value.trim();
  const quantity  = Number(document.getElementById('product-quantity').value);
  const imageFile = document.getElementById('product-image').files[0];

  const restore = setLoading(productSaveBtn, 'Saving…');
  modalErrBanner.hidden = true;

  try {
    if (editingId) {
      // Edit — PUT (no image support for PUT in current backend; send JSON)
      await apiPut(`/api/items/${editingId}`, {
        name, sku: sku || undefined,
        category_id, department_id,
        supplier_id,
        quantity,
        condition, unit,
      });
      successBanner.textContent = 'Product updated successfully.';
      successBanner.hidden = false;
      setTimeout(() => { successBanner.hidden = true; }, 4000);
    } else {
      // Add — POST; use FormData if an image is attached
      if (imageFile) {
        const fd = new FormData();
        fd.append('name',          name);
        if (sku) fd.append('sku',  sku);
        fd.append('category_id',   category_id);
        fd.append('department_id', department_id);
        if (supplier_id) fd.append('supplier_id', supplier_id);
        fd.append('quantity',      quantity);
        fd.append('condition',     condition);
        fd.append('unit',          unit);
        fd.append('image',         imageFile);
        await apiFetch('/api/items', { method: 'POST', body: fd });
      } else {
        await apiPost('/api/items', {
          name, sku: sku || undefined,
          category_id, department_id,
          supplier_id,
          quantity,
          condition, unit,
        });
      }
      successBanner.textContent = 'Product added successfully.';
      successBanner.hidden = false;
      setTimeout(() => { successBanner.hidden = true; }, 4000);
    }

    closeModal(productOverlay);
    await loadItems();

  } catch (err) {
    modalErrBanner.textContent = err.message || 'Save failed.';
    modalErrBanner.hidden = false;
  } finally {
    restore();
  }
}

// ── Delete product ────────────────────────────────────────────────────────────
async function deleteProduct() {
  if (!deletingId) return;
  const restore = setLoading(deleteConfirmBtn, 'Deleting…');
  deleteErrBanner.hidden = true;

  try {
    await apiDelete(`/api/items/${deletingId}`);
    closeModal(deleteOverlay);
    successBanner.textContent = `"${deletingName}" deleted.`;
    successBanner.hidden = false;
    setTimeout(() => { successBanner.hidden = true; }, 4000);
    await loadItems();
  } catch (err) {
    if (err.status === 403) {
      deleteErrBanner.textContent = 'Permission denied — only administrators can delete products.';
    } else {
      deleteErrBanner.textContent = err.message || 'Delete failed.';
    }
    deleteErrBanner.hidden = false;
  } finally {
    restore();
    deletingId = null;
  }
}

// ── Data loading ──────────────────────────────────────────────────────────────

/** Try an API lookup; return its payload or null on failure. */
async function tryFetch(path) {
  try { return await apiGet(path); } catch { return null; }
}

async function loadLookups() {
  // Fetch each endpoint independently so one 404 doesn't block the others.
  const [catData, deptData, suppData] = await Promise.all([
    tryFetch('/api/categories'),
    tryFetch('/api/departments'),
    tryFetch('/api/suppliers'),
  ]);

  let usingFallback = false;

  if (catData?.categories?.length) {
    categories = catData.categories;
  } else {
    categories = DEFAULT_CATEGORIES;
    usingFallback = true;
  }

  if (deptData?.departments?.length) {
    departments = deptData.departments;
  } else {
    departments = DEFAULT_DEPARTMENTS;
  }

  suppliers = suppData?.suppliers || [];
}

async function loadItems() {
  try {
    const data = await apiGet('/api/items');
    allItems = data.items || [];
    renderTable();
  } catch (err) {
    errorBanner.textContent = err.message;
    errorBanner.hidden = false;
    tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state"><i class="fas fa-circle-exclamation text-danger"></i><p>${esc(err.message)}</p></div></td></tr>`;
  }
}

// ── Filter tab logic ──────────────────────────────────────────────────────────
document.querySelectorAll('.filter-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab').forEach((t) => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    activeFilter = tab.dataset.filter;
    renderTable();
  });
});

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value.trim();
  renderTable();
});

// ── Button wiring ─────────────────────────────────────────────────────────────
document.getElementById('btn-add-product').addEventListener('click', openAddModal);
productSaveBtn.addEventListener('click', saveProduct);
productCancelBtn.addEventListener('click', () => closeModal(productOverlay));
productCloseBtn.addEventListener('click', () => closeModal(productOverlay));

deleteConfirmBtn.addEventListener('click', deleteProduct);
deleteCancelBtn.addEventListener('click', () => closeModal(deleteOverlay));
deleteCloseBtn.addEventListener('click', () => closeModal(deleteOverlay));

// Close modals on overlay click
productOverlay.addEventListener('click', (e) => { if (e.target === productOverlay) closeModal(productOverlay); });
deleteOverlay.addEventListener('click', (e) => { if (e.target === deleteOverlay) closeModal(deleteOverlay); });

// Image preview
document.getElementById('product-image').addEventListener('change', (e) => {
  const file = e.target.files[0];
  const preview = document.getElementById('product-image-preview');
  if (file) {
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
  } else {
    preview.hidden = true;
  }
});

// ── Boot ──────────────────────────────────────────────────────────────────────
async function init() {
  await Promise.all([loadLookups(), loadItems()]);
}

function generateNextSKU() {
  let max = 0;
  allItems.forEach(item => {
    if (item.sku && item.sku.startsWith('SKU-')) {
      const num = parseInt(item.sku.replace('SKU-', ''), 10);
      if (!isNaN(num) && num > max) max = num;
    }
  });
  return `SKU-${String(max + 1).padStart(3, '0')}`;
}

init();
