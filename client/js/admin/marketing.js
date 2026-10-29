// Phần dùng chung cho trang Khuyến mãi và Voucher
import { escapeHtml, formatCurrency, formatDateTime } from '../ui.js';
import { optionsFrom } from './crud.js';

export function stateOf(item, now = Date.now()) {
  if (!item.isActive) return { key: 'inactive', html: '<span class="pill pill-gray">Tắt</span>' };
  if (new Date(item.startAt) > now) return { key: 'upcoming', html: '<span class="pill pill-blue">Sắp diễn ra</span>' };
  if (new Date(item.endAt) < now) return { key: 'expired', html: '<span class="pill pill-red">Hết hạn</span>' };
  return { key: 'running', html: '<span class="pill pill-green">Đang chạy</span>' };
}

export const discountText = (item) =>
  item.discountType === 'PERCENT' ? `-${item.discountValue}%` : `-${formatCurrency(item.discountValue)}`;

export const periodText = (item) =>
  `<span class="cell-sub">${formatDateTime(item.startAt)}<br>→ ${formatDateTime(item.endAt)}</span>`;

export const STATE_FILTER = {
  name: 'state',
  label: 'Tất cả thời gian',
  options: [
    { value: 'running', label: 'Đang chạy' },
    { value: 'upcoming', label: 'Sắp diễn ra' },
    { value: 'expired', label: 'Hết hạn' },
  ],
};

const SCOPE_LABEL = { ALL: 'Toàn bộ cửa hàng', CATEGORY: 'Theo danh mục', TEAM: 'Theo đội bóng', PRODUCT: 'Theo sản phẩm' };

export const scopeText = (item) => {
  const target = item.category?.name ?? item.team?.name ?? item.product?.name;
  return `<span class="cell-sub">${SCOPE_LABEL[item.scope]}${target ? `: <b>${escapeHtml(target)}</b>` : ''}</span>`;
};

const nextWeek = () => new Date(Date.now() + 7 * 864e5).toISOString();

/** Trường chung về mức giảm, phạm vi, thời gian. scopes: các phạm vi cho phép */
export function discountFields(scopes) {
  return [
    {
      name: 'discountType',
      label: 'Kiểu giảm',
      type: 'select',
      required: true,
      options: [
        { value: 'PERCENT', label: 'Phần trăm (%)' },
        { value: 'FIXED', label: 'Số tiền cố định (₫)' },
      ],
    },
    { name: 'discountValue', label: 'Giá trị giảm', type: 'number', required: true, min: 1, help: 'Phần trăm (1–100) hoặc số tiền VNĐ.' },
    { name: 'scope', label: 'Phạm vi áp dụng', type: 'select', required: true, options: scopes.map((s) => ({ value: s, label: SCOPE_LABEL[s] })) },
    { name: 'categoryId', label: 'Danh mục áp dụng', type: 'select', numeric: true, required: true, options: optionsFrom('/admin/categories'), showIf: (v) => v.scope === 'CATEGORY' },
    { name: 'teamId', label: 'Đội bóng áp dụng', type: 'select', numeric: true, required: true, options: optionsFrom('/admin/teams'), showIf: (v) => v.scope === 'TEAM' },
    { name: 'startAt', label: 'Bắt đầu', type: 'datetime', required: true, default: new Date().toISOString() },
    { name: 'endAt', label: 'Kết thúc', type: 'datetime', required: true, default: nextWeek() },
  ];
}
