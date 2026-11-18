import { MAX_CART_QTY, ORDER_STATUS, PAYMENT_METHODS } from '../config/constants.js';
import { date, id, listQuery, optionalText, phone, queryBool, requiredText, z } from './common.js';

// ───────── Sổ địa chỉ ─────────
export const addressSchema = z.object({
  receiverName: requiredText(100, 2),
  phone,
  line: requiredText(255, 3),
  ward: requiredText(100),
  district: requiredText(100),
  province: requiredText(100),
  isDefault: z.boolean().optional(),
});
export const updateAddressSchema = addressSchema.partial();

// ───────── Giỏ hàng ─────────
const quantity = z.coerce.number().int('Số lượng phải là số nguyên').min(1).max(MAX_CART_QTY);
export const addCartItemSchema = z.object({ variantId: id, quantity: quantity.default(1) });
export const updateCartItemSchema = z.object({ quantity });
export const cartItemParams = z.object({ itemId: id });

// ───────── Checkout & đơn hàng ─────────
const voucherCode = z
  .string()
  .trim()
  .toUpperCase()
  .max(30)
  .optional()
  .transform((v) => v || undefined);

export const checkoutPreviewSchema = z.object({ voucherCode });
export const placeOrderSchema = z.object({
  addressId: id,
  paymentMethod: z.enum(Object.values(PAYMENT_METHODS)),
  voucherCode,
  note: optionalText(500),
});
export const orderCodeParam = z.object({ code: z.string().trim().toUpperCase().regex(/^JS\d{6}[A-Z0-9]{4}$/, 'Mã đơn không hợp lệ') });
export const cancelOrderSchema = z.object({ reason: requiredText(255, 3) });
// Cổng thanh toán mô phỏng: client gửi kết quả giả lập
export const payOrderSchema = z.object({ result: z.enum(['success', 'failed']) });

export const customerOrderQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  status: z.enum(Object.values(ORDER_STATUS)).optional(),
});

export const adminOrderQuery = listQuery.extend({
  status: z.enum(Object.values(ORDER_STATUS)).optional(),
  paymentMethod: z.enum(Object.values(PAYMENT_METHODS)).optional(),
  from: date.optional(),
  to: date.optional(),
});
export const orderStatusSchema = z.object({
  status: z.enum(Object.values(ORDER_STATUS)),
  note: optionalText(255),
});

// ───────── Đánh giá ─────────
export const createReviewSchema = z.object({
  orderId: id,
  productId: id,
  rating: z.coerce.number().int().min(1).max(5),
  content: optionalText(1000),
});
export const productReviewQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(20).optional(),
});
export const adminReviewQuery = listQuery.extend({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  isHidden: queryBool,
});
export const reviewVisibilitySchema = z.object({ isHidden: z.boolean() });

// ───────── Thống kê ─────────
export const statsQuery = z.object({ days: z.coerce.number().int().refine((d) => [7, 30, 90, 365].includes(d), 'Chọn 7, 30, 90 hoặc 365 ngày').default(30) });
