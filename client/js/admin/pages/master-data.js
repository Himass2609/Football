import { jerseySvg } from '../../jersey.js';
import { $, escapeHtml, getParam, html } from '../../ui.js';
import { ACTIVE_FILTER, activePill, createCrudPage, mainCell, optionsFrom } from '../crud.js';
import { mountAdmin } from '../shell.js';

const usage = (row) => `<span class="cell-sub">${row.usageCount} liên kết</span>`;
const isActiveField = { name: 'isActive', label: 'Đang hoạt động', type: 'switch', default: true, span: true };
const sortOrderField = { name: 'sortOrder', label: 'Thứ tự hiển thị', type: 'number', default: 0 };

const TEAM_TYPES = [
  { value: 'CLUB', label: 'Câu lạc bộ' },
  { value: 'NATIONAL', label: 'Đội tuyển quốc gia' },
];

const ENTITIES = {
  categories: {
    title: 'Danh mục sản phẩm',
    desc: 'Nhóm sản phẩm hiển thị trên menu và bộ lọc cửa hàng.',
    label: 'danh mục',
    icon: 'layers',
    columns: [
      { label: 'Tên danh mục', render: (r) => mainCell(r.name, r.parent ? `Thuộc: ${r.parent.name}` : r.slug) },
      { label: 'Mô tả', render: (r) => `<span class="cell-sub">${escapeHtml(r.description ?? '—')}</span>` },
      { label: 'Thứ tự', render: (r) => String(r.sortOrder) },
      { label: 'Sử dụng', render: usage },
      { label: 'Trạng thái', render: (r) => activePill(r.isActive) },
    ],
    fields: [
      { name: 'name', label: 'Tên danh mục', required: true, maxlength: 100 },
      { name: 'parentId', label: 'Danh mục cha', type: 'select', numeric: true, options: optionsFrom('/admin/categories') },
      { name: 'description', label: 'Mô tả', type: 'textarea', span: true, maxlength: 255, rows: 3 },
      { name: 'imageUrl', label: 'Ảnh đại diện', type: 'image', span: true },
      sortOrderField,
      isActiveField,
    ],
  },
  brands: {
    title: 'Thương hiệu',
    desc: 'Nhà sản xuất áo đấu và phụ kiện.',
    label: 'thương hiệu',
    icon: 'badge-check',
    columns: [
      { label: 'Thương hiệu', render: (r) => mainCell(r.name, r.slug) },
      { label: 'Mô tả', render: (r) => `<span class="cell-sub">${escapeHtml(r.description ?? '—')}</span>` },
      { label: 'Sản phẩm', render: usage },
      { label: 'Trạng thái', render: (r) => activePill(r.isActive) },
    ],
    fields: [
      { name: 'name', label: 'Tên thương hiệu', required: true, maxlength: 100 },
      { name: 'logoUrl', label: 'Logo', type: 'image' },
      { name: 'description', label: 'Mô tả', type: 'textarea', span: true, maxlength: 255, rows: 3 },
      isActiveField,
    ],
  },
  leagues: {
    title: 'Giải đấu',
    desc: 'Dùng để nhóm đội bóng trên menu và bộ lọc.',
    label: 'giải đấu',
    icon: 'trophy',
    columns: [
      { label: 'Giải đấu', render: (r) => mainCell(r.name, r.country ?? '—') },
      { label: 'Loại', render: (r) => (r.type === 'NATIONAL' ? 'Đội tuyển' : 'Câu lạc bộ') },
      { label: 'Đội bóng', render: usage },
      { label: 'Trạng thái', render: (r) => activePill(r.isActive) },
    ],
    fields: [
      { name: 'name', label: 'Tên giải đấu', required: true, maxlength: 100 },
      { name: 'country', label: 'Quốc gia', maxlength: 50 },
      { name: 'type', label: 'Loại', type: 'select', required: true, options: TEAM_TYPES },
      { name: 'logoUrl', label: 'Logo', type: 'image' },
      isActiveField,
    ],
  },
  teams: {
    title: 'Đội bóng',
    desc: 'Câu lạc bộ và đội tuyển. Màu áo dùng để vẽ ảnh minh họa khi sản phẩm chưa có ảnh.',
    label: 'đội bóng',
    icon: 'flag',
    columns: [
      {
        label: 'Đội bóng',
        render: (r) =>
          `<div class="d-flex align-items-center gap-3"><span class="mini-jersey">${jerseySvg({ primary: r.primaryColor, secondary: r.secondaryColor, pattern: r.kitPattern, label: '' })}</span><div>${mainCell(r.name, [r.shortName, r.league?.name].filter(Boolean).join(' · '))}</div></div>`,
      },
      { label: 'Loại', render: (r) => (r.type === 'NATIONAL' ? 'Đội tuyển' : 'Câu lạc bộ') },
      { label: 'Nổi bật', render: (r) => (r.isFeatured ? '<span class="badge badge-accent">Nổi bật</span>' : '<span class="cell-sub">—</span>') },
      { label: 'Sử dụng', render: usage },
      { label: 'Trạng thái', render: (r) => activePill(r.isActive) },
    ],
    dialogSize: 'dialog-lg',
    fields: [
      { name: 'name', label: 'Tên đội', required: true, maxlength: 100 },
      { name: 'shortName', label: 'Tên viết tắt', maxlength: 10, placeholder: 'VD: RMA' },
      { name: 'type', label: 'Loại', type: 'select', required: true, options: TEAM_TYPES },
      { name: 'leagueId', label: 'Giải đấu', type: 'select', numeric: true, options: optionsFrom('/admin/leagues') },
      { name: 'country', label: 'Quốc gia', maxlength: 50 },
      {
        name: 'kitPattern',
        label: 'Họa tiết áo',
        type: 'select',
        required: true,
        options: [
          { value: 'PLAIN', label: 'Trơn' },
          { value: 'STRIPES', label: 'Sọc dọc' },
          { value: 'HOOPS', label: 'Sọc ngang' },
          { value: 'HALVES', label: 'Chia đôi' },
          { value: 'SASH', label: 'Sọc chéo' },
        ],
      },
      { name: 'primaryColor', label: 'Màu chính', type: 'color', required: true, default: '#0B1220' },
      { name: 'secondaryColor', label: 'Màu phụ', type: 'color', required: true, default: '#FFFFFF' },
      { name: 'logoUrl', label: 'Logo', type: 'image', span: true },
      { name: 'isFeatured', label: 'Hiển thị ở mục "Đội bóng nổi bật" trên trang chủ', type: 'switch', span: true },
      isActiveField,
    ],
  },
  'product-types': {
    title: 'Loại sản phẩm',
    desc: 'Sân nhà, sân khách, thủ môn, tập luyện...',
    label: 'loại sản phẩm',
    icon: 'shirt',
    columns: [
      { label: 'Loại sản phẩm', render: (r) => mainCell(r.name, r.slug) },
      { label: 'Mô tả', render: (r) => `<span class="cell-sub">${escapeHtml(r.description ?? '—')}</span>` },
      { label: 'Sản phẩm', render: usage },
      { label: 'Trạng thái', render: (r) => activePill(r.isActive) },
    ],
    fields: [
      { name: 'name', label: 'Tên loại', required: true, maxlength: 100, span: true },
      { name: 'description', label: 'Mô tả', type: 'textarea', span: true, maxlength: 255, rows: 3 },
      isActiveField,
    ],
  },
  sizes: {
    title: 'Kích thước',
    desc: 'Size áo người lớn, trẻ em và phụ kiện một cỡ.',
    label: 'kích thước',
    icon: 'ruler',
    limit: 50,
    columns: [
      { label: 'Size', render: (r) => `<span class="cell-main">${escapeHtml(r.name)}</span>` },
      { label: 'Nhóm', render: (r) => ({ ADULT: 'Người lớn', KID: 'Trẻ em', ONE: 'Một cỡ' })[r.sizeType] },
      { label: 'Thứ tự', render: (r) => String(r.sortOrder) },
      { label: 'Biến thể', render: usage },
      { label: 'Trạng thái', render: (r) => activePill(r.isActive) },
    ],
    fields: [
      { name: 'name', label: 'Tên size', required: true, maxlength: 10, placeholder: 'VD: XL, 10Y' },
      {
        name: 'sizeType',
        label: 'Nhóm size',
        type: 'select',
        required: true,
        options: [
          { value: 'ADULT', label: 'Người lớn' },
          { value: 'KID', label: 'Trẻ em' },
          { value: 'ONE', label: 'Một cỡ' },
        ],
      },
      sortOrderField,
      isActiveField,
    ],
  },
  colors: {
    title: 'Màu sắc',
    desc: 'Màu dùng cho biến thể sản phẩm.',
    label: 'màu sắc',
    icon: 'palette',
    limit: 50,
    columns: [
      { label: 'Màu', render: (r) => html`<div class="d-flex align-items-center gap-3"><span class="swatch" style="background:${r.hex}"></span><span class="cell-main">${r.name}</span></div>` },
      { label: 'Mã màu', render: (r) => `<code>${escapeHtml(r.hex)}</code>` },
      { label: 'Sử dụng', render: usage },
      { label: 'Trạng thái', render: (r) => activePill(r.isActive) },
    ],
    fields: [
      { name: 'name', label: 'Tên màu', required: true, maxlength: 50 },
      { name: 'hex', label: 'Mã màu', type: 'color', required: true, default: '#FFFFFF' },
      isActiveField,
    ],
  },
  'news-categories': {
    title: 'Chuyên mục tin',
    desc: 'Phân loại bài viết trên trang Tin tức.',
    label: 'chuyên mục',
    icon: 'tag',
    columns: [
      { label: 'Chuyên mục', render: (r) => mainCell(r.name, r.slug) },
      { label: 'Bài viết', render: usage },
      { label: 'Trạng thái', render: (r) => activePill(r.isActive) },
    ],
    fields: [{ name: 'name', label: 'Tên chuyên mục', required: true, maxlength: 100, span: true }, isActiveField],
  },
};

const entity = ENTITIES[getParam('entity')] ? getParam('entity') : 'categories';
const config = ENTITIES[entity];

if (await mountAdmin({ active: entity, title: config.title })) {
  $('[data-page-heading]').textContent = config.title;
  $('[data-page-desc]').textContent = config.desc;
  createCrudPage({
    endpoint: `/admin/${entity}`,
    label: config.label,
    columns: config.columns,
    fields: config.fields,
    filters: config.filters ?? [{ ...ACTIVE_FILTER }],
    limit: config.limit,
    dialogSize: config.dialogSize,
    emptyIcon: config.icon,
    searchPlaceholder: `Tìm ${config.label}...`,
  });
}
