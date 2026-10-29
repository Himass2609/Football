import { LOW_STOCK_THRESHOLD, PRODUCT_GENDERS, PRODUCT_SORTS, PRODUCT_STATUS } from '../config/constants.js';
import { boolean, id, listQuery, money, nullableId, optionalText, optionalUrl, requiredText, z } from './common.js';

const season = z
  .string()
  .trim()
  .regex(/^\d{4}(\/\d{2,4})?$/, 'Mùa giải dạng 2026/27 hoặc 2026')
  .nullish()
  .or(z.literal('').transform(() => null));

const productShape = z.object({
  name: requiredText(150, 3),
  categoryId: id,
  brandId: nullableId,
  teamId: nullableId,
  productTypeId: nullableId,
  season,
  playerName: optionalText(100),
  playerNumber: z.union([z.coerce.number().int().min(0).max(99), z.null()]).optional(),
  gender: z.enum(PRODUCT_GENDERS).nullish(),
  material: optionalText(100),
  description: optionalText(10000),
  basePrice: money.refine((v) => v > 0, 'Giá bán phải lớn hơn 0'),
  salePrice: z.union([money, z.null()]).optional(),
  status: z.enum(Object.values(PRODUCT_STATUS)).optional(),
  isFeatured: boolean.optional(),
});

const priceRule = (data, ctx) => {
  if (data.salePrice != null && data.basePrice != null && data.salePrice >= data.basePrice) {
    ctx.addIssue({ code: 'custom', path: ['salePrice'], message: 'Giá khuyến mãi phải nhỏ hơn giá bán' });
  }
};

export const createProductSchema = productShape.superRefine(priceRule);
export const updateProductSchema = productShape.partial().superRefine(priceRule);
export const productStatusSchema = z.object({ status: z.enum(Object.values(PRODUCT_STATUS)) });

export const adminProductQuery = listQuery.extend({
  status: z.enum(Object.values(PRODUCT_STATUS)).optional(),
  categoryId: id.optional(),
  teamId: id.optional(),
  brandId: id.optional(),
});

// Danh sách công khai: nhận slug cho dễ chia sẻ URL; size/color nhận nhiều giá trị "1,2,3"
const idList = z
  .string()
  .trim()
  .regex(/^\d+(,\d+)*$/, 'Danh sách id không hợp lệ')
  .transform((v) => [...new Set(v.split(',').map(Number))].slice(0, 20))
  .optional();

export const publicProductQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(48).optional(),
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(120).optional(),
  team: z.string().trim().max(120).optional(),
  brand: z.string().trim().max(120).optional(),
  type: z.string().trim().max(120).optional(),
  league: z.string().trim().max(120).optional(),
  gender: z.enum(PRODUCT_GENDERS).optional(),
  sizes: idList,
  colors: idList,
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  inStock: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  onSale: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  featured: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  sort: z.enum(PRODUCT_SORTS).optional(),
});

// ───────── Biến thể ─────────
export const generateVariantsSchema = z.object({
  sizeIds: z.array(id).min(1).max(20),
  colorIds: z.array(id).min(1).max(12),
  stockQuantity: z.coerce.number().int().min(0).max(100000).default(0),
  price: z.union([money, z.null()]).optional(),
});

export const updateVariantSchema = z.object({
  price: z.union([money, z.null()]).optional(),
  isActive: boolean.optional(),
});

// ───────── Ảnh ─────────
export const addImagesSchema = z.object({
  images: z
    .array(z.object({ url: optionalUrl.refine((v) => v != null, 'Thiếu đường dẫn ảnh'), alt: optionalText(150), colorId: nullableId }))
    .min(1)
    .max(10),
});

export const updateImageSchema = z.object({
  alt: optionalText(150),
  colorId: nullableId,
  isPrimary: z.literal(true).optional(),
});

export const reorderImagesSchema = z.object({ imageIds: z.array(id).min(1).max(50) });

// ───────── Tồn kho ─────────
export const inventoryQuery = listQuery.extend({
  stock: z.enum(['out', 'low', 'in']).optional(),
  productId: id.optional(),
  threshold: z.coerce.number().int().min(1).max(1000).default(LOW_STOCK_THRESHOLD),
});

export const adjustStockSchema = z
  .object({
    mode: z.enum(['set', 'add']),
    quantity: z.coerce.number().int().min(-100000).max(100000),
    note: optionalText(255),
  })
  .refine((d) => d.mode === 'add' || d.quantity >= 0, { path: ['quantity'], message: 'Số lượng tồn kho không được âm' })
  .refine((d) => d.mode === 'set' || d.quantity !== 0, { path: ['quantity'], message: 'Nhập số lượng khác 0' });

export const variantParams = z.object({ id, variantId: id });
export const imageParams = z.object({ id, imageId: id });
export const slugParam = z.object({ slug: z.string().trim().min(1).max(180) });
