import { KIT_PATTERNS, SIZE_TYPES, TEAM_TYPES } from '../config/constants.js';
import { boolean, hexColor, nullableId, optionalText, optionalUrl, requiredText, z } from './common.js';

const base = { isActive: boolean.optional() };
const sortOrder = z.coerce.number().int().min(0).max(9999).optional();

// Schema tạo mới theo từng entity; cập nhật dùng .partial()
export const masterDataSchemas = {
  categories: z.object({
    ...base,
    name: requiredText(100),
    description: optionalText(255),
    imageUrl: optionalUrl,
    parentId: nullableId,
    sortOrder,
  }),
  brands: z.object({ ...base, name: requiredText(100), description: optionalText(255), logoUrl: optionalUrl }),
  leagues: z.object({
    ...base,
    name: requiredText(100),
    country: optionalText(50),
    type: z.enum(TEAM_TYPES).optional(),
    logoUrl: optionalUrl,
  }),
  teams: z.object({
    ...base,
    name: requiredText(100),
    shortName: optionalText(10),
    type: z.enum(TEAM_TYPES).optional(),
    country: optionalText(50),
    leagueId: nullableId,
    logoUrl: optionalUrl,
    primaryColor: hexColor.optional(),
    secondaryColor: hexColor.optional(),
    kitPattern: z.enum(KIT_PATTERNS).optional(),
    isFeatured: boolean.optional(),
  }),
  'product-types': z.object({ ...base, name: requiredText(100), description: optionalText(255) }),
  sizes: z.object({
    ...base,
    name: requiredText(10).transform((v) => v.toUpperCase()),
    sizeType: z.enum(SIZE_TYPES).optional(),
    sortOrder,
  }),
  colors: z.object({ ...base, name: requiredText(50), hex: hexColor }),
  'news-categories': z.object({ ...base, name: requiredText(100) }),
};
