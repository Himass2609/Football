import { money, optionalPhone, optionalText, requiredText, z } from './common.js';

export const updateSettingSchema = z.object({
  storeName: requiredText(100).optional(),
  storeEmail: z
    .union([z.string().trim().max(100).email('Email không hợp lệ'), z.literal('').transform(() => null), z.null()])
    .optional(),
  storePhone: optionalPhone,
  storeAddress: optionalText(255),
  shippingFee: money.optional(),
  freeShipThreshold: money.optional(),
});
