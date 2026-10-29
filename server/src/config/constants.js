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
export const SIZE_TYPES = Object.freeze(['ADULT', 'KID', 'ONE']);
export const GENDERS = Object.freeze(['MALE', 'FEMALE', 'OTHER']);

export const OTP = Object.freeze({ LENGTH: 6, TTL_MINUTES: 10, MAX_ATTEMPTS: 5, RESEND_SECONDS: 60 });
