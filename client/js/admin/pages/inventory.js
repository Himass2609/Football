import { api } from '../../api.js';
import { $, emptyState, formatDateTime, formatNumber, html, icon, raw } from '../../ui.js';
import { createCrudPage, mainCell } from '../crud.js';
import { mountAdmin } from '../shell.js';
import { openAdjustStock } from '../stock.js';

const REASON = { IMPORT: 'Nhập kho', ADJUST: 'Điều chỉnh', ORDER: 'Bán (đơn hàng)', CANCEL: 'Hoàn (hủy đơn)' };

if (await mountAdmin({ active: 'inventory', title: 'Tồn kho' })) {
  $('[data-page-heading]').textContent = 'Tồn kho';
  $('[data-page-desc]').textContent = 'Tồn kho quản lý theo từng biến thể (size + màu). Mọi lần nhập / điều chỉnh đều được ghi lịch sử.';

  const stockPill = (v, threshold) => {
    const tone = v.stockQuantity === 0 ? 'pill-red' : v.stockQuantity <= threshold ? 'pill-amber' : 'pill-green';
    return `<span class="pill ${tone}">${v.stockQuantity}</span>`;
  };
  let threshold = 5;

  const renderSummary = (s) => {
    threshold = s.threshold;
    const cards = [
      ['Tổng số lượng', formatNumber(s.totalUnits), 'Tất cả biến thể', 'layers', false],
      ['Biến thể', formatNumber(s.variantCount), 'Size × màu', 'shirt', false],
      ['Sắp hết hàng', formatNumber(s.lowStock), `Còn 1–${s.threshold} sản phẩm`, 'clock', true],
      ['Hết hàng', formatNumber(s.outOfStock), 'Đang bán nhưng tồn = 0', 'alert-circle', false],
    ];
    $('[data-summary]').innerHTML = cards
      .map(([label, value, hint, ic, accent]) =>
        html`<div class="col-12 col-sm-6 col-xl-3"><div class="card kpi ${accent ? 'kpi-accent' : ''}">
          <div><p class="kpi-label">${label}</p><p class="kpi-value">${value}</p><p class="kpi-hint">${hint}</p></div>
          <span class="kpi-icon">${raw(icon(ic, 22))}</span></div></div>`,
      )
      .join('');
  };

  async function showLogs(row) {
    const dialog = document.createElement('dialog');
    dialog.className = 'dialog dialog-lg';
    document.body.append(dialog);
    const close = () => (dialog.close(), dialog.remove());
    dialog.addEventListener('click', (e) => (e.target === dialog || e.target.closest('[data-close]')) && close());
    dialog.addEventListener('close', () => dialog.remove());
    dialog.innerHTML = html`<div class="dialog-head"><h2 class="dialog-title">Lịch sử kho — ${row.sku}</h2>
      <button class="icon-btn" type="button" data-close aria-label="Đóng">${raw(icon('x'))}</button></div>
      <div class="dialog-body" data-logs><div class="skeleton" style="height:120px"></div></div>`;
    dialog.showModal();
    try {
      const { data } = await api.get(`/admin/inventory/${row.id}/logs`);
      $('[data-logs]', dialog).innerHTML = data.length
        ? html`<div class="table-wrap"><table class="table"><thead><tr><th>Thời gian</th><th>Loại</th><th>Thay đổi</th><th>Tồn sau</th><th>Ghi chú</th><th>Người thực hiện</th></tr></thead><tbody>
          ${data.map((l) =>
            raw(html`<tr><td class="cell-sub">${formatDateTime(l.createdAt)}</td><td>${REASON[l.reason] ?? l.reason}</td>
              <td class="cell-main" style="color:${raw(l.change > 0 ? 'var(--c-success)' : 'var(--c-danger)')}">${l.change > 0 ? `+${l.change}` : l.change}</td>
              <td>${l.stockAfter}</td><td class="cell-sub">${l.note ?? '—'}</td><td class="cell-sub">${l.createdBy ?? 'Hệ thống'}</td></tr>`),
          )}</tbody></table></div>`
        : emptyState('layers', 'Chưa có lịch sử');
    } catch (err) {
      $('[data-logs]', dialog).innerHTML = emptyState('alert-circle', 'Không tải được lịch sử', err.message);
    }
  }

  createCrudPage({
    endpoint: '/admin/inventory',
    label: 'biến thể',
    emptyIcon: 'layers',
    searchPlaceholder: 'Tìm theo SKU hoặc tên sản phẩm...',
    canCreate: false,
    canEdit: false,
    canDelete: false,
    limit: 25,
    onLoaded: (meta) => renderSummary(meta.summary),
    filters: [
      {
        name: 'stock',
        label: 'Tất cả mức tồn',
        options: [
          { value: 'out', label: 'Hết hàng' },
          { value: 'low', label: 'Sắp hết hàng' },
          { value: 'in', label: 'Còn nhiều' },
        ],
      },
    ],
    columns: [
      {
        label: 'Sản phẩm',
        render: (v) =>
          `<a href="/admin/product-edit.html?id=${v.product.id}&tab=variants" class="d-block">${mainCell(v.product.name, v.sku)}</a>`,
      },
      { label: 'Size', render: (v) => `<span class="cell-main">${v.size.name}</span>` },
      { label: 'Màu', render: (v) => html`<span class="d-inline-flex align-items-center gap-2"><span class="swatch" style="background:${v.color.hex}"></span>${v.color.name}</span>` },
      { label: 'Tồn kho', render: (v) => stockPill(v, threshold) + (v.isActive ? '' : ' <span class="cell-sub">· ngừng bán</span>') },
      { label: 'Cập nhật', render: (v) => `<span class="cell-sub">${formatDateTime(v.updatedAt)}</span>` },
    ],
    rowActions: () => [
      {
        key: 'adjust',
        icon: 'plus',
        label: 'Nhập / điều chỉnh kho',
        run: async (row) => Boolean(await openAdjustStock(row)),
      },
      { key: 'logs', icon: 'clock', label: 'Lịch sử kho', run: (row) => (showLogs(row), false) },
    ],
  });
}
