import { INVENTORY_REASONS } from '../config/constants.js';
import { prisma } from '../lib/prisma.js';
import { variantInclude } from '../repositories/product.repository.js';
import { ApiError } from '../utils/api-error.js';
import { buildMeta, getPagination } from '../utils/pagination.js';

const stockWhere = (stock, threshold) =>
  ({
    out: { stockQuantity: 0 },
    low: { stockQuantity: { gt: 0, lte: threshold } },
    in: { stockQuantity: { gt: threshold } },
  })[stock] ?? {};

const toRow = (v) => ({
  id: v.id,
  sku: v.sku,
  stockQuantity: v.stockQuantity,
  isActive: v.isActive,
  size: v.size,
  color: v.color,
  product: v.product,
  updatedAt: v.updatedAt,
});

export const inventoryService = {
  async list(query) {
    const pagination = getPagination(query, 100);
    const where = {
      product: { deletedAt: null },
      ...stockWhere(query.stock, query.threshold),
      ...(query.productId && { productId: query.productId }),
      ...(query.q && {
        OR: [{ sku: { contains: query.q } }, { product: { name: { contains: query.q } } }],
      }),
    };
    const [items, total, summary] = await prisma.$transaction([
      prisma.productVariant.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ stockQuantity: 'asc' }, { productId: 'asc' }],
        include: {
          ...variantInclude,
          product: { select: { id: true, name: true, slug: true, status: true, images: { where: { isPrimary: true }, take: 1, select: { url: true } } } },
        },
      }),
      prisma.productVariant.count({ where }),
      prisma.productVariant.groupBy({
        by: ['isActive'],
        where: { product: { deletedAt: null } },
        _sum: { stockQuantity: true },
        _count: { _all: true },
        orderBy: { isActive: 'asc' },
      }),
    ]);

    const base = { product: { deletedAt: null }, isActive: true };
    const [outCount, lowCount] = await Promise.all([
      prisma.productVariant.count({ where: { ...base, stockQuantity: 0 } }),
      prisma.productVariant.count({ where: { ...base, stockQuantity: { gt: 0, lte: query.threshold } } }),
    ]);

    return {
      items: items.map(toRow),
      meta: {
        ...buildMeta(pagination, total),
        summary: {
          totalUnits: summary.reduce((sum, g) => sum + (g._sum.stockQuantity ?? 0), 0),
          variantCount: summary.reduce((sum, g) => sum + g._count._all, 0),
          outOfStock: outCount,
          lowStock: lowCount,
          threshold: query.threshold,
        },
      },
    };
  },

  /**
   * Nhập / điều chỉnh tồn kho trong transaction.
   * Giảm kho dùng UPDATE có điều kiện (stock >= số giảm) để không bao giờ âm khi nhiều người thao tác cùng lúc.
   */
  async adjust(variantId, { mode, quantity, note }, actorId) {
    return prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.findUnique({ where: { id: variantId } });
      if (!variant) throw ApiError.notFound('Không tìm thấy biến thể');

      const change = mode === 'set' ? quantity - variant.stockQuantity : quantity;
      if (change === 0) return this.detail(variantId, tx);

      const { count } = await tx.productVariant.updateMany({
        where: { id: variantId, ...(change < 0 && { stockQuantity: { gte: -change } }) },
        data: { stockQuantity: { increment: change } },
      });
      if (!count) throw ApiError.unprocessable('Số lượng giảm vượt quá tồn kho hiện tại', 'INSUFFICIENT_STOCK', [{ field: 'quantity', message: 'Vượt quá tồn kho hiện tại' }]);

      const updated = await tx.productVariant.findUnique({ where: { id: variantId } });
      await tx.inventoryLog.create({
        data: {
          variantId,
          change,
          stockAfter: updated.stockQuantity,
          reason: change > 0 && mode === 'add' ? INVENTORY_REASONS.IMPORT : INVENTORY_REASONS.ADJUST,
          note: note ?? null,
          createdById: actorId,
        },
      });
      return this.detail(variantId, tx);
    });
  },

  async detail(variantId, tx = prisma) {
    const variant = await tx.productVariant.findUnique({
      where: { id: variantId },
      include: { ...variantInclude, product: { select: { id: true, name: true, slug: true, status: true } } },
    });
    if (!variant) throw ApiError.notFound('Không tìm thấy biến thể');
    return toRow(variant);
  },

  async logs(variantId) {
    await this.detail(variantId);
    const logs = await prisma.inventoryLog.findMany({ where: { variantId }, orderBy: { createdAt: 'desc' }, take: 50 });
    const actorIds = [...new Set(logs.map((l) => l.createdById).filter(Boolean))];
    const actors = await prisma.customer.findMany({ where: { accountId: { in: actorIds } }, select: { accountId: true, fullName: true } });
    const names = new Map(actors.map((a) => [a.accountId, a.fullName]));
    return logs.map((l) => ({ ...l, createdBy: names.get(l.createdById) ?? null }));
  },
};
