import { api, request } from '../../api.js';
import { productArt } from '../../product-card.js';
import { $, $$, clearFieldErrors, confirmDialog, emptyState, formatCurrency, getParam, handleFormError, html, icon, raw, setLoading, toast } from '../../ui.js';
import { mountFields, openFormDialog } from '../crud.js';
import { PRODUCT_STATUS, productFields, statusPill } from '../product-fields.js';
import { mountAdmin } from '../shell.js';
import { openAdjustStock } from '../stock.js';

const root = $('[data-product-editor]');
const productId = Number(getParam('id'));
const state = { product: null, tab: ['info', 'variants', 'images'].includes(getParam('tab')) ? getParam('tab') : 'info', sizes: [], colors: [] };

// Hành động trạng thái hợp lệ theo trạng thái hiện tại
const STATUS_ACTIONS = {
  DRAFT: [{ to: 'ACTIVE', label: 'Mở bán', className: 'btn-primary' }],
  ACTIVE: [
    { to: 'INACTIVE', label: 'Ngừng bán', className: 'btn-outline' },
    { to: 'DRAFT', label: 'Về nháp', className: 'btn-ghost' },
  ],
  INACTIVE: [
    { to: 'ACTIVE', label: 'Mở bán lại', className: 'btn-primary' },
    { to: 'DRAFT', label: 'Về nháp', className: 'btn-ghost' },
  ],
};

async function reload() {
  state.product = (await api.get(`/admin/products/${productId}`)).data;
  render();
}

function setTab(tab) {
  state.tab = tab;
  const url = new URL(location.href);
  url.searchParams.set('tab', tab);
  history.replaceState(null, '', url);
  render();
}

// ───────── Khung trang ─────────
function render() {
  const p = state.product;
  document.title = `${p.name} — Quản trị JERSEY`;
  root.innerHTML = html`
    <div class="editor-head">
      <div>
        <a class="link-more" href="/admin/products.html">${raw(icon('arrow-left', 14))}Danh sách sản phẩm</a>
        <h1 class="display">${p.name}</h1>
        <p class="cell-sub mt-1">${raw(statusPill(p.status))} &nbsp;/${p.slug} · Giá hiện tại ${formatCurrency(p.pricing.price)}${p.pricing.promotion ? ` (đang áp “${p.pricing.promotion.name}”)` : ''}</p>
      </div>
      <div class="editor-actions">
        ${p.status === 'ACTIVE' ? raw(html`<a class="btn btn-ghost btn-sm" href="/product.html?slug=${encodeURIComponent(p.slug)}" target="_blank" rel="noopener">${raw(icon('external-link', 14))}Xem trên cửa hàng</a>`) : ''}
        ${STATUS_ACTIONS[p.status].map((a) => raw(html`<button class="btn ${a.className} btn-sm" type="button" data-status="${a.to}">${a.label}</button>`))}
        <button class="btn btn-ghost btn-sm" type="button" data-delete-product style="color:var(--c-danger)">${raw(icon('trash', 14))}Xóa</button>
      </div>
    </div>
    <div class="tabs editor-tabs" role="tablist">
      ${[
        ['info', 'Thông tin', null],
        ['variants', 'Biến thể', p.variants.length],
        ['images', 'Hình ảnh', p.images.length],
      ].map(([key, label, count]) =>
        raw(html`<button class="tab" type="button" role="tab" data-tab="${key}" aria-selected="${String(state.tab === key)}">${label}${count != null ? raw(`<span class="count">${count}</span>`) : ''}</button>`),
      )}
    </div>
    <div data-panel></div>`;

  ({ info: renderInfo, variants: renderVariants, images: renderImages })[state.tab]($('[data-panel]', root));
}

root.addEventListener('click', async (e) => {
  const tab = e.target.closest('[data-tab]');
  if (tab) return setTab(tab.dataset.tab);

  const status = e.target.closest('[data-status]');
  if (status) {
    try {
      await api.patch(`/admin/products/${productId}/status`, { status: status.dataset.status });
      toast(`Đã chuyển sang "${PRODUCT_STATUS[status.dataset.status].label}"`, 'success');
      await reload();
    } catch (err) {
      toast(err.message, 'error', 5000);
      if (err.code === 'NO_ACTIVE_VARIANT') setTab('variants');
    }
    return;
  }

  if (e.target.closest('[data-delete-product]')) {
    const ok = await confirmDialog({
      title: 'Xóa sản phẩm',
      message: `Sản phẩm "${state.product.name}" sẽ bị ẩn khỏi cửa hàng và danh sách quản trị. Lịch sử đơn hàng vẫn được giữ.`,
      confirmText: 'Xóa',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/admin/products/${productId}`);
      toast('Đã xóa sản phẩm', 'success');
      location.href = '/admin/products.html';
    } catch (err) {
      toast(err.message, 'error');
    }
  }
});

// ───────── Tab: Thông tin ─────────
async function renderInfo(panel) {
  panel.innerHTML = html`
    <form class="card" novalidate data-info-form>
      <div class="card-body" data-fields></div>
      <div class="dialog-foot"><button class="btn btn-dark btn-sm" type="submit" data-loading-text="Đang lưu...">Lưu thông tin</button></div>
    </form>`;
  const { form, values } = await mountFields($('[data-fields]', panel), productFields, { initial: state.product, mode: 'edit' });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFieldErrors(form);
    const button = $('[type="submit"]', form);
    setLoading(button, true);
    try {
      await api.put(`/admin/products/${productId}`, values());
      toast('Đã lưu thông tin sản phẩm', 'success');
      await reload();
    } catch (err) {
      handleFormError(form, err);
      setLoading(button, false);
    }
  });
}

// ───────── Tab: Biến thể ─────────
function renderVariants(panel) {
  const p = state.product;
  const sizeGroups = [
    ['ADULT', 'Người lớn'],
    ['KID', 'Trẻ em'],
    ['SHOE', 'Giày'],
    ['GLOVE', 'Găng tay'],
    ['ONE', 'Một cỡ'],
  ];

  panel.innerHTML = html`
    <form class="card mb-4" novalidate data-generate-form>
      <div class="card-head"><h2 class="card-title">Thêm biến thể</h2><span class="cell-sub">Tạo mọi tổ hợp size × màu đã chọn; tổ hợp đã có sẽ được bỏ qua.</span></div>
      <div class="card-body generator">
        <div class="field">
          <span class="label">Size</span>
          ${sizeGroups.map(([type, label]) => {
            const list = state.sizes.filter((s) => s.sizeType === type && s.isActive);
            return list.length
              ? raw(html`<div class="check-list mb-2" data-field="sizeIds"><span class="cell-sub w-100">${label}</span>${list.map((s) =>
                  raw(html`<label class="check"><input type="checkbox" name="sizeIds" value="${s.id}">${s.name}</label>`),
                )}</div>`)
              : '';
          })}
        </div>
        <div class="field">
          <span class="label">Màu</span>
          <div class="check-list" data-field="colorIds">${state.colors.filter((c) => c.isActive).map((c) =>
            raw(html`<label class="check color-check"><input type="checkbox" name="colorIds" value="${c.id}"><span class="swatch" style="background:${c.hex}"></span>${c.name}</label>`),
          )}</div>
        </div>
        <div>
          <label class="field"><span class="label">Tồn kho ban đầu</span><input class="input" type="number" name="stockQuantity" min="0" value="0"></label>
          <label class="field"><span class="label">Giá riêng (₫)</span><input class="input" type="number" name="price" min="0" step="1000" placeholder="Theo giá SP"></label>
          <button class="btn btn-dark btn-sm btn-block mt-3" type="submit" data-loading-text="Đang tạo...">${raw(icon('plus', 14))}Tạo biến thể</button>
        </div>
      </div>
    </form>

    <div class="card">
      <div class="card-head"><h2 class="card-title">Danh sách biến thể</h2><span class="cell-sub">${p.variants.filter((v) => v.isActive).length}/${p.variants.length} đang bán · ${p.variants.reduce((s, v) => s + v.stockQuantity, 0)} sản phẩm trong kho</span></div>
      ${p.variants.length
        ? raw(html`<div class="table-wrap"><table class="table">
            <thead><tr><th>SKU</th><th>Size</th><th>Màu</th><th>Giá</th><th>Tồn kho</th><th>Đang bán</th><th class="col-actions"></th></tr></thead>
            <tbody>${p.variants.map((v) =>
              raw(html`<tr data-variant="${v.id}">
                <td class="cell-main">${v.sku}</td>
                <td>${v.size.name}</td>
                <td><span class="d-inline-flex align-items-center gap-2"><span class="swatch" style="background:${v.color.hex}"></span>${v.color.name}</span></td>
                <td>${v.price != null ? formatCurrency(v.price) : raw('<span class="cell-sub">Theo SP</span>')}</td>
                <td><span class="pill ${v.stockQuantity === 0 ? 'pill-red' : v.stockQuantity <= 5 ? 'pill-amber' : 'pill-green'}">${v.stockQuantity}</span></td>
                <td><label class="switch"><input type="checkbox" data-toggle-variant ${v.isActive ? raw('checked') : ''} aria-label="Đang bán"></label></td>
                <td class="col-actions"><div class="row-actions">
                  <button class="icon-btn" type="button" data-variant-action="stock" title="Nhập / điều chỉnh kho" aria-label="Điều chỉnh kho">${raw(icon('plus', 18))}</button>
                  <button class="icon-btn" type="button" data-variant-action="price" title="Sửa giá riêng" aria-label="Sửa giá">${raw(icon('tag', 18))}</button>
                  <button class="icon-btn danger" type="button" data-variant-action="delete" title="Xóa" aria-label="Xóa">${raw(icon('trash', 18))}</button>
                </div></td>
              </tr>`),
            )}</tbody></table></div>`)
        : raw(emptyState('layers', 'Chưa có biến thể', 'Chọn size và màu ở trên để tạo biến thể, sau đó mới mở bán được sản phẩm.'))}
    </div>`;

  const form = $('[data-generate-form]', panel);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFieldErrors(form);
    const checked = (name) => $$(`input[name="${name}"]:checked`, form).map((cb) => Number(cb.value));
    const body = {
      sizeIds: checked('sizeIds'),
      colorIds: checked('colorIds'),
      stockQuantity: Number(form.elements.stockQuantity.value) || 0,
      price: form.elements.price.value ? Number(form.elements.price.value) : null,
    };
    if (!body.sizeIds.length || !body.colorIds.length) return toast('Chọn ít nhất một size và một màu', 'error');
    const button = $('[type="submit"]', form);
    setLoading(button, true);
    try {
      const { data } = await api.post(`/admin/products/${productId}/variants`, body);
      toast(`Đã tạo ${data.created} biến thể${data.skipped ? `, bỏ qua ${data.skipped} tổ hợp đã có` : ''}`, 'success');
      await reload();
    } catch (err) {
      handleFormError(form, err);
      setLoading(button, false);
    }
  });

  panel.addEventListener('change', async (e) => {
    const toggle = e.target.closest('[data-toggle-variant]');
    if (!toggle) return;
    const variantId = toggle.closest('[data-variant]').dataset.variant;
    try {
      await api.patch(`/admin/products/${productId}/variants/${variantId}`, { isActive: toggle.checked });
      await reload();
    } catch (err) {
      toggle.checked = !toggle.checked;
      toast(err.message, 'error');
    }
  });

  panel.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-variant-action]');
    if (!btn) return;
    const variant = state.product.variants.find((v) => String(v.id) === btn.closest('[data-variant]').dataset.variant);
    const action = btn.dataset.variantAction;
    try {
      if (action === 'stock' && (await openAdjustStock(variant))) await reload();
      if (action === 'price') {
        const saved = await openFormDialog({
          title: `Giá riêng — ${variant.sku}`,
          initial: { price: variant.price },
          fields: [{ name: 'price', label: 'Giá riêng (₫)', type: 'number', step: 1000, span: true, help: `Để trống để dùng giá sản phẩm (${formatCurrency(state.product.salePrice ?? state.product.basePrice)}).` }],
          submit: async ({ price }) => (await api.patch(`/admin/products/${productId}/variants/${variant.id}`, { price })).data,
        });
        if (saved) {
          toast('Đã cập nhật giá biến thể', 'success');
          await reload();
        }
      }
      if (action === 'delete') {
        const ok = await confirmDialog({ title: 'Xóa biến thể', message: `Xóa biến thể ${variant.sku}? Lịch sử kho của biến thể cũng sẽ bị xóa.`, confirmText: 'Xóa', danger: true });
        if (!ok) return;
        await api.delete(`/admin/products/${productId}/variants/${variant.id}`);
        toast('Đã xóa biến thể', 'success');
        await reload();
      }
    } catch (err) {
      toast(err.message, 'error', 5000);
    }
  });
}

// ───────── Tab: Hình ảnh ─────────
function renderImages(panel) {
  const p = state.product;
  const colorOptions = [...new Map(p.variants.map((v) => [v.color.id, v.color])).values()];

  panel.innerHTML = html`
    <div class="card">
      <div class="card-head">
        <div><h2 class="card-title">Hình ảnh</h2><p class="cell-sub mt-1">JPG, PNG, WEBP, AVIF tối đa 5MB. Gợi ý: tỉ lệ 4:5, rộng ~1200px, nền xám nhạt hoặc trong suốt.</p></div>
        <label class="btn btn-dark btn-sm">${raw(icon('upload', 14))}Tải ảnh lên
          <input type="file" accept="image/png,image/jpeg,image/webp,image/avif" multiple hidden data-upload-images>
        </label>
      </div>
      <div class="card-body">
        ${p.images.length
          ? raw(html`<div class="image-grid">${p.images.map((img, i) =>
              raw(html`<div class="image-card ${img.isPrimary ? 'is-primary' : ''}" data-image="${img.id}">
                <div class="image-card-media"><img src="${img.url}" alt="">${img.isPrimary ? raw('<span class="badge badge-accent">Ảnh chính</span>') : ''}</div>
                <div class="image-card-body">
                  <select class="select" data-image-color aria-label="Ảnh cho màu">
                    <option value="">Mọi màu</option>
                    ${colorOptions.map((c) => raw(html`<option value="${c.id}" ${c.id === img.colorId ? raw('selected') : ''}>${c.name}</option>`))}
                  </select>
                  <div class="image-card-actions">
                    <button class="icon-btn" type="button" data-image-action="left" aria-label="Lên trước" ${i === 0 ? raw('disabled') : ''}>${raw(icon('chevron-left', 16))}</button>
                    <button class="icon-btn" type="button" data-image-action="primary" aria-label="Đặt làm ảnh chính" title="Đặt làm ảnh chính" ${img.isPrimary ? raw('disabled') : ''}>${raw(icon('star', 16))}</button>
                    <button class="icon-btn" type="button" data-image-action="delete" aria-label="Xóa ảnh" title="Xóa ảnh">${raw(icon('trash', 16))}</button>
                    <button class="icon-btn" type="button" data-image-action="right" aria-label="Ra sau" ${i === p.images.length - 1 ? raw('disabled') : ''}>${raw(icon('chevron-right', 16))}</button>
                  </div>
                </div>
              </div>`),
            )}</div>`)
          : raw(html`<div class="d-flex flex-wrap align-items-center gap-4">
              <div class="art-preview">${raw(productArt(p, {}, p.variants[0]?.color))}</div>
              <div style="max-width:420px"><p class="cell-main">Chưa có ảnh thật</p>
                <p class="cell-sub mt-1">Cửa hàng đang hiển thị áo minh họa theo màu đội và màu biến thể. Tải ảnh lên để thay thế.</p></div>
            </div>`)}
      </div>
    </div>`;

  $('[data-upload-images]', panel).addEventListener('change', async (e) => {
    const files = [...e.target.files];
    if (!files.length) return;
    const body = new FormData();
    files.slice(0, 10).forEach((f) => body.append('files', f));
    try {
      const { data: uploaded } = await request('/admin/uploads', { method: 'POST', body });
      await api.post(`/admin/products/${productId}/images`, { images: uploaded.map((u) => ({ url: u.url })) });
      toast(`Đã thêm ${uploaded.length} ảnh`, 'success');
      await reload();
    } catch (err) {
      toast(err.message, 'error', 5000);
    }
  });

  panel.addEventListener('change', async (e) => {
    const select = e.target.closest('[data-image-color]');
    if (!select) return;
    const imageId = select.closest('[data-image]').dataset.image;
    try {
      await api.patch(`/admin/products/${productId}/images/${imageId}`, { colorId: select.value ? Number(select.value) : null });
      toast('Đã gắn ảnh cho màu', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  panel.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-image-action]');
    if (!btn) return;
    const imageId = Number(btn.closest('[data-image]').dataset.image);
    const ids = state.product.images.map((img) => img.id);
    const index = ids.indexOf(imageId);
    try {
      switch (btn.dataset.imageAction) {
        case 'primary':
          await api.patch(`/admin/products/${productId}/images/${imageId}`, { isPrimary: true });
          break;
        case 'delete':
          if (!(await confirmDialog({ title: 'Xóa ảnh', message: 'Xóa ảnh này khỏi sản phẩm?', confirmText: 'Xóa', danger: true }))) return;
          await api.delete(`/admin/products/${productId}/images/${imageId}`);
          break;
        case 'left':
        case 'right': {
          const target = index + (btn.dataset.imageAction === 'left' ? -1 : 1);
          [ids[index], ids[target]] = [ids[target], ids[index]];
          await api.put(`/admin/products/${productId}/images/order`, { imageIds: ids });
          break;
        }
      }
      await reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

// ───────── Khởi động ─────────
if (await mountAdmin({ active: 'products', title: 'Sửa sản phẩm' })) {
  try {
    if (!productId) throw new Error('Thiếu mã sản phẩm');
    const [sizes, colors] = await Promise.all([api.get('/admin/sizes', { limit: 200 }), api.get('/admin/colors', { limit: 200 })]);
    state.sizes = sizes.data;
    state.colors = colors.data;
    await reload();
  } catch (err) {
    root.innerHTML = `<div class="card">${emptyState('shirt', 'Không tải được sản phẩm', err.message)}</div>`;
  }
}
