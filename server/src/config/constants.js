export const ROLES = Object.freeze({ ADMIN: 'ADMIN', CUSTOMER: 'CUSTOMER' });

// Mã quyền: [code, tên hiển thị, module]. ADMIN có toàn bộ; CUSTOMER có nhóm "customer"
export const PERMISSIONS = Object.freeze({
  DASHBOARD_VIEW: ['dashboard.view', 'Xem tổng quan & thống kê', 'admin'],
  USER_MANAGE: ['user.manage', 'Quản lý tài khoản', 'admin'],
  ROLE_MANAGE: ['role.manage', 'Quản lý vai trò & phân quyền', 'admin'],
  CATALOG_MANAGE: ['catalog.manage', 'Quản lý dữ liệu nền (danh mục, đội bóng, size, màu...)', 'admin'],
  PRODUCT_MANAGE: ['product.manage', 'Quản lý sản phẩm & biến thể', 'admin'],
  INVENTORY_MANAGE: ['inventory.manage', 'Quản lý tồn kho', 'admin'],
  ORDER_MANAGE: ['order.manage', 'Quản lý đơn hàng', 'admin'],
  MARKETING_MANAGE: ['marketing.manage', 'Quản lý khuyến mãi & voucher', 'admin'],
  REVIEW_MANAGE: ['review.manage', 'Quản lý đánh giá', 'admin'],
  NEWS_MANAGE: ['news.manage', 'Quản lý tin tức', 'admin'],
  SETTING_MANAGE: ['setting.manage', 'Cấu hình cửa hàng', 'admin'],
  PROFILE_MANAGE: ['profile.manage', 'Quản lý hồ sơ & địa chỉ', 'customer'],
  CART_USE: ['cart.use', 'Sử dụng giỏ hàng', 'customer'],
  ORDER_PLACE: ['order.place', 'Đặt hàng & thanh toán', 'customer'],
  REVIEW_WRITE: ['review.write', 'Viết đánh giá sản phẩm', 'customer'],
});
export const P = Object.freeze(Object.fromEntries(Object.entries(PERMISSIONS).map(([key, [code]]) => [key, code])));

export const ACCOUNT_STATUS =Object.freeze({ ACTIVE: 'ACTIVE', LOCKED: 'LOCKED' });

export const DISCOUNT_TYPES = Object.freeze({ PERCENT: 'PERCENT', FIXED: 'FIXED' });

export const PROMOTION_SCOPES = Object.freeze(['ALL', 'CATEGORY', 'TEAM', 'PRODUCT']);
export const VOUCHER_SCOPES = Object.freeze(['ALL', 'CATEGORY', 'PRODUCT']);

export const NEWS_STATUS = Object.freeze({ DRAFT: 'DRAFT', PUBLISHED: 'PUBLISHED', ARCHIVED: 'ARCHIVED' });
export const NEWS_TRANSITIONS = Object.freeze({
  DRAFT: ['PUBLISHED'],
  PUBLISHED: ['DRAFT', 'ARCHIVED'],
  ARCHIVED: ['PUBLISHED'],
});

export const TEAM_TYPES = Object.freeze(['CLUB', 'NATIONAL']);
export const KIT_PATTERNS = Object.freeze(['PLAIN', 'STRIPES', 'HOOPS', 'HALVES', 'SASH']);
export const SIZE_TYPES = Object.freeze(['ADULT', 'KID', 'SHOE', 'GLOVE', 'ONE']);
export const GENDERS = Object.freeze(['MALE', 'FEMALE', 'OTHER']);

export const PRODUCT_STATUS = Object.freeze({ DRAFT: 'DRAFT', ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' });
export const PRODUCT_GENDERS = Object.freeze(['MEN', 'WOMEN', 'KIDS', 'UNISEX']);
export const PRODUCT_SORTS = Object.freeze(['newest', 'price_asc', 'price_desc', 'best_selling', 'name_asc']);
export const LOW_STOCK_THRESHOLD = 5;
// Lý do thay đổi tồn kho (InventoryLog.reason) — ORDER/CANCEL dùng ở Phase 3
export const INVENTORY_REASONS = Object.freeze({ IMPORT: 'IMPORT', ADJUST: 'ADJUST', ORDER: 'ORDER', CANCEL: 'CANCEL' });

export const OTP =Object.freeze({ LENGTH: 6, TTL_MINUTES: 10, MAX_ATTEMPTS: 5, RESEND_SECONDS: 60 });

// ───────── Đơn hàng & thanh toán (Phase 3) ─────────
export const ORDER_STATUS = Object.freeze({
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  PROCESSING: 'PROCESSING',
  SHIPPING: 'SHIPPING',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
});
// Chuyển trạng thái hợp lệ (CLAUDE.md mục 5.6); khách chỉ hủy được khi PENDING
export const ORDER_TRANSITIONS = Object.freeze({
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPING'],
  SHIPPING: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
});
export const PAYMENT_METHODS = Object.freeze({ COD: 'COD', ONLINE: 'ONLINE' });
// Order.paymentStatus: UNPAID → PAID (COD khi giao xong, ONLINE khi cổng báo thành công) · FAILED cho phép trả lại · REFUNDED khi hủy đơn đã trả
export const ORDER_PAYMENT_STATUS = Object.freeze({ UNPAID: 'UNPAID', PAID: 'PAID', FAILED: 'FAILED', REFUNDED: 'REFUNDED' });
// Payment.status theo từng lần thanh toán
export const PAYMENT_STATUS = Object.freeze({ PENDING: 'PENDING', SUCCESS: 'SUCCESS', FAILED: 'FAILED', CANCELLED: 'CANCELLED' });
export const MAX_CART_QTY = 10;
export const MAX_ADDRESSES = 10;
