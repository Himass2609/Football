import { ORDER_STATUS, paymentPill, statusPill } from '../../order-ui.js';
import { $, escapeHtml, formatCurrency, formatDateTime, html } from '../../ui.js';
import { createCrudPage, mainCell } from '../crud.js';
import { mountAdmin } from '../shell.js';

if (await mountAdmin({ active: 'orders', title: 'Đơn hàng' })) {
  $('[data-page-heading]').textContent = 'Đơn hàng';
  $('[data-page-desc]').textContent = 'Xử lý đơn theo thứ tự: Chờ xác nhận → Đã xác nhận → Đang chuẩn bị → Đang giao → Đã giao.';

  const detailHref = (o) => `/admin/order-detail.html?id=${o.id}`;

  createCrudPage({
    endpoint: '/admin/orders',
    label: 'đơn hàng',
    emptyIcon: 'receipt',
    searchPlaceholder: 'Mã đơn, tên / SĐT người nhận, email...',
    canCreate: false,
    canEdit: false,
    canDelete: false,
    filters: [
      { name: 'status', label: 'Tất cả trạng thái', options: Object.entries(ORDER_STATUS).map(([value, s]) => ({ value, label: s.label })) },
      { name: 'paymentMethod', label: 'Mọi hình thức thanh toán', options: [{ value: 'COD', label: 'COD' }, { value: 'ONLINE', label: 'Online' }] },
    ],
    columns: [
      { label: 'Mã đơn', render: (o) => html`<a class="cell-main" href="${detailHref(o)}">${o.orderCode}</a><div class="cell-sub">${formatDateTime(o.createdAt)}</div>` },
      { label: 'Khách hàng', render: (o) => mainCell(o.receiverName, `${o.receiverPhone} · ${o.customer?.email ?? ''}`) },
      { label: 'Sản phẩm', render: (o) => `<span class="cell-main">${o.itemCount}</span><div class="cell-sub">${escapeHtml(o.previews[0]?.productName ?? '')}${o.lineCount > 1 ? ` +${o.lineCount - 1}` : ''}</div>` },
      { label: 'Tổng tiền', render: (o) => `<span class="cell-main">${formatCurrency(o.total)}</span>` },
      { label: 'Thanh toán', render: (o) => `<div class="cell-sub mb-1">${o.paymentMethod === 'COD' ? 'COD' : 'Online'}</div>${paymentPill(o.paymentStatus)}` },
      { label: 'Trạng thái', render: (o) => statusPill(o.status) },
    ],
    rowActions: () => [{ key: 'view', icon: 'eye', label: 'Xem & xử lý', run: (o) => ((location.href = detailHref(o)), false) }],
  });
}
