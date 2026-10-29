import { DISCOUNT_TYPES, PROMOTION_SCOPES, VOUCHER_SCOPES } from '../config/constants.js';
import { boolean, date, listQuery, money, nullableId, optionalText, optionalUrl, requiredText, z } from './common.js';

const discountFields = {
  discountType: z.enum(Object.values(DISCOUNT_TYPES)),
  discountValue: money.refine((v) => v > 0, 'Giá trị giảm phải lớn hơn 0'),
  startAt: date,
  endAt: date,
  isActive: boolean.optional(),
};

const TARGET_BY_SCOPE = { CATEGORY: 'categoryId', TEAM: 'teamId', PRODUCT: 'productId' };

// Dùng chung cho tạo mới và cập nhật; service kiểm tra lại trên bản ghi đã gộp
export const discountRules = (data, ctx) => {
  if (data.startAt && data.endAt && data.endAt <= data.startAt) {
    ctx.addIssue({ code: 'custom', path: ['endAt'], message: 'Thời gian kết thúc phải sau thời gian bắt đầu' });
  }
  if (data.discountType === DISCOUNT_TYPES.PERCENT && data.discountValue > 100) {
    ctx.addIssue({ code: 'custom', path: ['discountValue'], message: 'Giảm theo phần trăm tối đa 100%' });
  }
  const target = TARGET_BY_SCOPE[data.scope];
  if (target && !data[target]) {
    ctx.addIssue({ code: 'custom', path: [target], message: 'Vui lòng chọn đối tượng áp dụng' });
  }
};

const promotionShape = z.object({
  ...discountFields,
  name: requiredText(150),
  description: optionalText(500),
  bannerUrl: optionalUrl,
  scope: z.enum(PROMOTION_SCOPES),
  categoryId: nullableId,
  teamId: nullableId,
  productId: nullableId,
});

const voucherShape = z.object({
  ...discountFields,
  code: requiredText(30, 3)
    .transform((v) => v.toUpperCase())
    .refine((v) => /^[A-Z0-9_-]+$/.test(v), 'Mã chỉ gồm chữ, số, gạch ngang, gạch dưới'),
  description: optionalText(255),
  maxDiscount: z.union([money, z.null()]).optional(),
  minOrderValue: money.optional(),
  usageLimit: z.union([z.coerce.number().int().min(1), z.null()]).optional(),
  perUserLimit: z.union([z.coerce.number().int().min(1), z.null()]).optional(),
  scope: z.enum(VOUCHER_SCOPES),
  categoryId: nullableId,
  productId: nullableId,
});

export const createPromotionSchema = promotionShape.superRefine(discountRules);
export const updatePromotionSchema = promotionShape.partial();
export const createVoucherSchema = voucherShape.superRefine(discountRules);
export const updateVoucherSchema = voucherShape.partial();

export const marketingListQuery = listQuery.extend({
  state: z.enum(['running', 'upcoming', 'expired']).optional(),
});
