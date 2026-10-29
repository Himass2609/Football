export function getPagination({ page = 1, limit = 20 } = {}, maxLimit = 100) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(maxLimit, Math.max(1, Number(limit) || 20));
  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit, take: safeLimit };
}

export const buildMeta = ({ page, limit }, total) => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});
