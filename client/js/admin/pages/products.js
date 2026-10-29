import { api } from '../../api.js';
import { productArt } from '../../product-card.js';
import { $, escapeHtml, formatCurrency, formatDateTime, html } from '../../ui.js';
import { createCrudPage, mainCell } from '../crud.js';
import { PRODUCT_STATUS, createProductFields, statusPill } from '../product-fields.js';
import { mountAdmin } from '../shell.js';

if (await mountAdmin({ active: 'products', title: 'Sản phẩm' })) {
  $('[data-page-heading]').textContent = 'Sản phẩm';
  $('[data-page-desc]').textContent = 'Sản phẩm mới luôn ở trạng thái nháp; thêm biến thể (size × màu) rồi mới mở bán.';

  const [{ data: categories }, { data: teams }] = await Promise.all([
    api.get('/admin/categories', { limit: 200 }),
    api.get('/admin/teams', { limit: 200 }),
  ]);

  const thumb = (p) =>
    p.image
      ? html`<img class="thumb" src="${p.image}" alt="">`
      : `<span class="mini-jersey">${productArt({ ...p, colors: [] })}</span>`;

  const stockCell = (p) => {
    if (!p.variantCount) return '<span class="pill pill-amber">Chưa có biến thể</span>';
    const tone = p.totalStock === 0 ? 'pill-red' : p.totalStock <= 10 ? 'pill-amber' : 'pill-gray';
    return `<span class="pill ${tone}">${p.totalStock} sp</span><div class="cell-sub mt-1">${p.activeVariantCount}/${p.variantCount} biến thể bán</div>`;
  };

  createCrudPage({
    endpoint: '/admin/products',
    label: 'sản phẩm',
    emptyIcon: 'shirt',
    searchPlaceholder: 'Tìm theo tên sản phẩm...',
    filters: [
      { name: 'status', label: 'Tất cả trạng thái', options: Object.entries(PRODUCT_STATUS).map(([value, s]) => ({ value, label: s.label })) },
      { name: 'categoryId', label: 'Tất cả danh mục', options: categories.map((c) => ({ value: c.id, label: c.name })) },
      { name: 'teamId', label: 'Tất cả đội bóng', options: teams.map((t) => ({ value: t.id, label: t.name })) },
    ],
    columns: [
      {
        label: 'Sản phẩm',
        render: (p) =>
          `<div class="d-flex align-items-center gap-3">${thumb(p)}<div>${mainCell(p.name, [p.category?.name, p.brand?.name].filter(Boolean).join(' · '))}</div></div>`,
      },
      {
        label: 'Giá',
        render: (p) =>
          p.salePrice
            ? `<span class="cell-main">${formatCurrency(p.salePrice)}</span><div class="cell-sub" style="text-decoration:line-through">${formatCurrency(p.basePrice)}</div>`
            : `<span class="cell-main">${formatCurrency(p.basePrice)}</span>`,
      },
      { label: 'Tồn kho', render: stockCell },
      { label: 'Đã bán', render: (p) => String(p.soldCount) },
      { label: 'Trạng thái', render: (p) => statusPill(p.status) + (p.isFeatured ? ' <span class="badge badge-accent">Nổi bật</span>' : '') },
      { label: 'Cập nhật', render: (p) => `<span class="cell-sub">${escapeHtml(formatDateTime(p.updatedAt))}</span>` },
    ],
    fields: createProductFields,
    dialogSize: 'dialog-lg',
    editHref: (p) => `/admin/product-edit.html?id=${p.id}`,
    afterCreate: (saved) => (location.href = `/admin/product-edit.html?id=${saved.id}&tab=variants`),
    rowActions: (p) =>
      p.status === 'ACTIVE'
        ? [{ key: 'view', icon: 'external-link', label: 'Xem trên cửa hàng', run: () => (window.open(`/product.html?slug=${encodeURIComponent(p.slug)}`, '_blank', 'noopener'), false) }]
        : [],
  });
}
