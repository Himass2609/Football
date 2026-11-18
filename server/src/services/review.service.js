import { ORDER_STATUS } from '../config/constants.js';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../utils/api-error.js';
import { buildMeta, getPagination } from '../utils/pagination.js';

// Điểm trung bình chỉ tính đánh giá đang hiển thị
async function refreshProductRating(productId, tx = prisma) {
  const agg = await tx.review.aggregate({ where: { productId, isHidden: false }, _avg: { rating: true }, _count: true });
  await tx.product.update({
    where: { id: productId },
    data: { ratingAvg: Math.round((agg._avg.rating ?? 0) * 10) / 10, ratingCount: agg._count },
  });
}

const reviewer = (fullName) => {
  // Ẩn bớt họ tên khách: "Nguyễn Văn Khách" → "Nguyễn V. K."
  const parts = (fullName ?? 'Khách hàng').trim().split(/\s+/);
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts.slice(1).map((p) => `${p[0]}.`).join(' ')}`;
};

export const reviewService = {
  // CLAUDE.md 5.9: chỉ đánh giá khi đơn chứa sản phẩm ở trạng thái DELIVERED; mỗi sản phẩm/đơn 1 lần
  async create(customerId, { orderId, productId, rating, content }) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, customerId },
      select: { status: true, details: { where: { productId }, select: { id: true } } },
    });
    if (!order) throw ApiError.notFound('Không tìm thấy đơn hàng');
    if (order.status !== ORDER_STATUS.DELIVERED) throw ApiError.unprocessable('Chỉ đánh giá được sau khi đã nhận hàng', 'NOT_DELIVERED');
    if (!order.details.length) throw ApiError.unprocessable('Sản phẩm không thuộc đơn hàng này', 'NOT_IN_ORDER');
    const exists = await prisma.review.findUnique({ where: { customerId_productId_orderId: { customerId, productId, orderId } } });
    if (exists) throw ApiError.conflict('Bạn đã đánh giá sản phẩm này cho đơn hàng này', 'ALREADY_REVIEWED');

    return prisma.$transaction(async (tx) => {
      const review = await tx.review.create({ data: { customerId, productId, orderId, rating, content: content ?? null } });
      await refreshProductRating(productId, tx);
      return review;
    });
  },

  async listForProduct(slug, query) {
    const product = await prisma.product.findFirst({ where: { slug, deletedAt: null }, select: { id: true, ratingAvg: true, ratingCount: true } });
    if (!product) throw ApiError.notFound('Không tìm thấy sản phẩm');
    const paging = getPagination(query, 20);
    const where = { productId: product.id, isHidden: false };
    const [items, total, groups] = await prisma.$transaction([
      prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: paging.skip,
        take: paging.take,
        select: {
          id: true, rating: true, content: true, createdAt: true,
          customer: { select: { fullName: true } },
          order: { select: { details: { where: { productId: product.id }, select: { sizeName: true, colorName: true }, take: 1 } } },
        },
      }),
      prisma.review.count({ where }),
      prisma.review.groupBy({ by: ['rating'], where, _count: true, orderBy: { rating: 'desc' } }),
    ]);
    const distribution = Object.fromEntries([5, 4, 3, 2, 1].map((r) => [r, groups.find((g) => g.rating === r)?._count ?? 0]));
    return {
      items: items.map((r) => ({
        id: r.id,
        rating: r.rating,
        content: r.content,
        createdAt: r.createdAt,
        reviewer: reviewer(r.customer.fullName),
        variant: r.order.details[0] ? `${r.order.details[0].sizeName} / ${r.order.details[0].colorName}` : null,
      })),
      meta: { ...buildMeta(paging, total), ratingAvg: product.ratingAvg, ratingCount: product.ratingCount, distribution },
    };
  },

  // ───────── Admin ─────────
  async listAdmin(query) {
    const paging = getPagination(query, 100);
    const where = {
      ...(query.rating && { rating: query.rating }),
      ...(query.isHidden !== undefined && { isHidden: query.isHidden }),
      ...(query.q && { OR: [{ content: { contains: query.q } }, { product: { name: { contains: query.q } } }, { customer: { fullName: { contains: query.q } } }] }),
    };
    const [items, total] = await prisma.$transaction([
      prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: paging.skip,
        take: paging.take,
        include: {
          customer: { select: { fullName: true, account: { select: { email: true } } } },
          product: { select: { id: true, name: true, slug: true } },
          order: { select: { orderCode: true } },
        },
      }),
      prisma.review.count({ where }),
    ]);
    return { items, meta: buildMeta(paging, total) };
  },

  async setHidden(id, isHidden) {
    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) throw ApiError.notFound('Không tìm thấy đánh giá');
    return prisma.$transaction(async (tx) => {
      const updated = await tx.review.update({ where: { id }, data: { isHidden } });
      await refreshProductRating(review.productId, tx);
      return updated;
    });
  },
};
