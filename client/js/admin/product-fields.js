// Trường thông tin sản phẩm — dùng chung cho dialog tạo mới và tab "Thông tin" ở trang sửa
import { optionsFrom } from './crud.js';

export const PRODUCT_STATUS = {
  DRAFT: { label: 'Bản nháp', pill: 'pill-gray' },
  ACTIVE: { label: 'Đang bán', pill: 'pill-green' },
  INACTIVE: { label: 'Ngừng bán', pill: 'pill-red' },
};

export const statusPill = (status) => `<span class="pill ${PRODUCT_STATUS[status].pill}">${PRODUCT_STATUS[status].label}</span>`;

const GENDERS = [
  { value: 'UNISEX', label: 'Unisex' },
  { value: 'MEN', label: 'Nam' },
  { value: 'WOMEN', label: 'Nữ' },
  { value: 'KIDS', label: 'Trẻ em' },
];

export const productFields = [
  { name: 'name', label: 'Tên sản phẩm', required: true, maxlength: 150, span: true, placeholder: 'VD: Áo Real Madrid sân nhà 2026/27' },
  { name: 'categoryId', label: 'Danh mục', type: 'select', numeric: true, required: true, options: optionsFrom('/admin/categories') },
  { name: 'productTypeId', label: 'Loại sản phẩm', type: 'select', numeric: true, options: optionsFrom('/admin/product-types') },
  { name: 'teamId', label: 'Đội bóng', type: 'select', numeric: true, options: optionsFrom('/admin/teams') },
  { name: 'brandId', label: 'Thương hiệu', type: 'select', numeric: true, options: optionsFrom('/admin/brands') },
  { name: 'season', label: 'Mùa giải', placeholder: '2026/27', maxlength: 9 },
  { name: 'gender', label: 'Đối tượng', type: 'select', options: GENDERS, default: 'UNISEX' },
  { name: 'basePrice', label: 'Giá bán (₫)', type: 'number', required: true, step: 1000, min: 1000 },
  { name: 'salePrice', label: 'Giá khuyến mãi riêng (₫)', type: 'number', step: 1000, help: 'Để trống nếu không giảm. Khuyến mãi theo chương trình được tính tự động.' },
  { name: 'playerName', label: 'Tên cầu thủ in sẵn', maxlength: 100 },
  { name: 'playerNumber', label: 'Số áo in sẵn', type: 'number', min: 0 },
  { name: 'material', label: 'Chất liệu', maxlength: 100, span: true },
  { name: 'description', label: 'Mô tả', type: 'textarea', rows: 5, maxlength: 10000, span: true },
  { name: 'isFeatured', label: 'Hiển thị ở mục "New season collection" trên trang chủ', type: 'switch', span: true },
];

// Khi tạo mới chỉ cần thông tin chính; phần còn lại bổ sung ở trang sửa
export const createProductFields = productFields.filter((f) =>
  ['name', 'categoryId', 'productTypeId', 'teamId', 'brandId', 'season', 'basePrice'].includes(f.name),
);
