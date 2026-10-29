import { $, escapeHtml, formatCurrency, formatNumber } from '../../ui.js';
import { ACTIVE_FILTER, createCrudPage } from '../crud.js';
import { STATE_FILTER, discountFields, discountText, periodText, scopeText, stateOf } from '../marketing.js';
import { mountAdmin } from '../shell.js';

if (await mountAdmin({ active: 'vouchers', title: 'Voucher' })) {
  $('[data-page-heading]').textContent = 'Voucher';
  $('[data-page-desc]').textContent = 'Mã giảm giá khách nhập khi thanh toán. Voucher đã được dùng không thể xóa — hãy tắt kích hoạt.';

  createCrudPage({
    endpoint: '/admin/vouchers',
    label: 'voucher',
    emptyIcon: 'ticket',
    dialogSize: 'dialog-lg',
    searchPlaceholder: 'Tìm theo mã voucher...',
    filters: [STATE_FILTER, ACTIVE_FILTER],
    columns: [
      { label: 'Mã', render: (v) => `<div class="cell-main" style="letter-spacing:.04em">${escapeHtml(v.code)}</div><div class="cell-sub">${escapeHtml(v.description ?? '')}</div>` },
      {
        label: 'Mức giảm',
        render: (v) =>
          `<span class="cell-main">${discountText(v)}</span>${v.maxDiscount ? `<div class="cell-sub">Tối đa ${formatCurrency(v.maxDiscount)}</div>` : ''}<div class="cell-sub">Đơn từ ${formatCurrency(v.minOrderValue)}</div>`,
      },
      { label: 'Phạm vi', render: scopeText },
      { label: 'Đã dùng', render: (v) => `<span class="cell-main">${formatNumber(v.usedCount)}</span><span class="cell-sub"> / ${v.usageLimit ? formatNumber(v.usageLimit) : '∞'}</span>` },
      { label: 'Thời gian', render: periodText },
      { label: 'Trạng thái', render: (v) => stateOf(v).html },
    ],
    fields: [
      { name: 'code', label: 'Mã voucher', required: true, maxlength: 30, placeholder: 'VD: SUMMER26', help: 'Chữ in hoa, số, gạch ngang, gạch dưới.' },
      { name: 'description', label: 'Mô tả', maxlength: 255 },
      ...discountFields(['ALL', 'CATEGORY']),
      { name: 'maxDiscount', label: 'Giảm tối đa (₫)', type: 'number', help: 'Chỉ áp dụng cho giảm %. Để trống = không giới hạn.', showIf: (v) => v.discountType === 'PERCENT' },
      { name: 'minOrderValue', label: 'Giá trị đơn tối thiểu (₫)', type: 'number', default: 0 },
      { name: 'usageLimit', label: 'Tổng lượt sử dụng', type: 'number', min: 1, help: 'Để trống = không giới hạn.' },
      { name: 'perUserLimit', label: 'Lượt / khách hàng', type: 'number', min: 1, help: 'Để trống = không giới hạn.' },
      { name: 'isActive', label: 'Kích hoạt voucher', type: 'switch', default: true, span: true },
    ],
    toPayload: (values) => ({ ...values, minOrderValue: values.minOrderValue ?? 0 }),
  });
}
