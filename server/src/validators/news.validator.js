import { NEWS_STATUS } from '../config/constants.js';
import { id, listQuery, optionalText, optionalUrl, requiredText, z } from './common.js';

const newsShape = z.object({
  title: requiredText(200, 5),
  summary: optionalText(500),
  content: requiredText(50000, 20),
  thumbnailUrl: optionalUrl,
  categoryIds: z.array(id).max(10).optional(),
});

export const createNewsSchema = newsShape.extend({
  status: z.enum([NEWS_STATUS.DRAFT, NEWS_STATUS.PUBLISHED]).optional(),
});
export const updateNewsSchema = newsShape.partial();
export const newsStatusSchema = z.object({ status: z.enum(Object.values(NEWS_STATUS)) });

export const adminNewsQuery = listQuery.extend({
  status: z.enum(Object.values(NEWS_STATUS)).optional(),
  categoryId: id.optional(),
});

export const publicNewsQuery = listQuery.extend({
  category: z.string().trim().max(120).optional(),
});

export const slugParam = z.object({ slug: z.string().trim().min(1).max(220) });
