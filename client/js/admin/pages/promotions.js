import { $ } from '../../ui.js';
import { ACTIVE_FILTER, createCrudPage, mainCell } from '../crud.js';
import { STATE_FILTER, discountFields, discountText, periodText, scopeText, stateOf } from '../marketing.js';
import { mountAdmin } from '../shell.js';

if (await mountAdmin({ active: 'promotions', title: 'Khuyến mãi' })) {
  $('[data-page-heading]').textContent = 'Chương trình khuyến mãi';
  $('[data-page-desc]').textContent = 'Giảm giá tự động theo thời gian, áp dụng cho toàn shop, danh mục hoặc đội bóng.';

  createCrudPage({
    endpoint: '/admin/promotions',
    label: 'khuyến mãi',
    emptyIcon: 'percent',
    dialogSize: 'dialog-lg',
    searchPlaceholder: 'Tìm theo tên chương trình...',
    filters: [STATE_FILTER, ACTIVE_FILTER],
    columns: [
      { label: 'Chương trình', render: (p) => mainCell(p.name, p.description ?? '') },
      { label: 'Mức giảm', render: (p) => `<span class="cell-main">${discountText(p)}</span>` },
      { label: 'Phạm vi', render: scopeText },
      { label: 'Thời gian', render: periodText },
      { label: 'Trạng thái', render: (p) => stateOf(p).html },
    ],
    fields: [
      { name: 'name', label: 'Tên chương trình', required: true, maxlength: 150, span: true },
      { name: 'description', label: 'Mô tả', type: 'textarea', maxlength: 500, rows: 2, span: true },
      ...discountFields(['ALL', 'CATEGORY', 'TEAM']),
      { name: 'bannerUrl', label: 'Ảnh banner', type: 'image', span: true },
      { name: 'isActive', label: 'Kích hoạt chương trình', type: 'switch', default: true, span: true },
    ],
  });
}
