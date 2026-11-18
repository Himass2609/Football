import { api } from '../../api.js';
import { $, escapeHtml, formatDateTime, html, icon, toast } from '../../ui.js';
import { createCrudPage, mainCell } from '../crud.js';
import { mountAdmin } from '../shell.js';

if (await mountAdmin({ active: 'reviews', title: 'Đánh giá' })) {
  $('[data-page-heading]').textContent = 'Đánh giá sản phẩm';
  $('[data-page-desc]').textContent = 'Chỉ khách đã nhận hàng mới đánh giá được. Ẩn đánh giá vi phạm — điểm trung bình sản phẩm tự tính lại.';

  const stars = (n) => `<span class="stars" aria-label="${n} sao">${[1, 2, 3, 4, 5].map((i) => `<span class="${i <= n ? '' : 'off'}">${icon('star', 14)}</span>`).join('')}</span>`;

  createCrudPage({
    endpoint: '/admin/reviews',
    label: 'đánh giá',
    emptyIcon: 'star',
    searchPlaceholder: 'Tìm theo nội dung, sản phẩm, khách hàng...',
    canCreate: false,
    canEdit: false,
    canDelete: false,
    filters: [
      { name: 'rating', label: 'Mọi số sao', options: [5, 4, 3, 2, 1].map((n) => ({ value: n, label: `${n} sao` })) },
      { name: 'isHidden', label: 'Mọi trạng thái', options: [{ value: 'false', label: 'Đang hiển thị' }, { value: 'true', label: 'Đã ẩn' }] },
    ],
    columns: [
      { label: 'Sản phẩm', render: (r) => html`<a class="cell-main" href="/product.html?slug=${r.product.slug}" target="_blank" rel="noopener">${r.product.name}</a><div class="cell-sub">Đơn ${r.order.orderCode}</div>` },
      { label: 'Khách hàng', render: (r) => mainCell(r.customer.fullName, r.customer.account?.email) },
      { label: 'Đánh giá', render: (r) => `${stars(r.rating)}<div class="cell-sub mt-1" style="max-width:360px;white-space:normal">${escapeHtml(r.content ?? '—')}</div>` },
      { label: 'Ngày', render: (r) => `<span class="cell-sub">${escapeHtml(formatDateTime(r.createdAt))}</span>` },
      { label: 'Trạng thái', render: (r) => (r.isHidden ? '<span class="pill pill-gray">Đã ẩn</span>' : '<span class="pill pill-green">Hiển thị</span>') },
    ],
    rowActions: (r) => [
      {
        key: 'toggle',
        icon: r.isHidden ? 'eye' : 'eye-off',
        label: r.isHidden ? 'Hiện lại' : 'Ẩn đánh giá',
        run: async () => {
          await api.patch(`/admin/reviews/${r.id}/visibility`, { isHidden: !r.isHidden });
          toast(r.isHidden ? 'Đã hiện lại đánh giá' : 'Đã ẩn đánh giá', 'success');
        },
      },
    ],
  });
}
