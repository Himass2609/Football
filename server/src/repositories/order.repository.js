import { prisma } from '../lib/prisma.js';

const listSelect = {
  id: true, orderCode: true, status: true, paymentStatus: true, paymentMethod: true, total: true, createdAt: true,
  receiverName: true, receiverPhone: true,
  customer: { select: { id: true, fullName: true, account: { select: { email: true } } } },
  details: { select: { quantity: true, imageUrl: true, productName: true }, orderBy: { id: 'asc' } },
};

const detailInclude = {
  customer: { select: { id: true, fullName: true, phone: true, account: { select: { email: true } } } },
  details: { orderBy: { id: 'asc' }, include: { product: { select: { slug: true } } } },
  history: { orderBy: { changedAt: 'asc' } },
  payments: { orderBy: { createdAt: 'asc' } },
};

export const orderRepository = {
  codeExists: async (orderCode, tx = prisma) => Boolean(await tx.order.findUnique({ where: { orderCode }, select: { id: true } })),

  async list(where, { skip, take }) {
    const [items, total] = await prisma.$transaction([
      prisma.order.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take, select: listSelect }),
      prisma.order.count({ where }),
    ]);
    return { items, total };
  },

  findDetail: (where) => prisma.order.findFirst({ where, include: detailInclude }),
  findForUpdate: (id, tx = prisma) => tx.order.findUnique({ where: { id }, include: { details: true, payments: { orderBy: { createdAt: 'desc' } } } }),

  // Đếm số lần khách đã dùng voucher (đơn chưa hủy) — cho perUserLimit
  countVoucherUses: (customerId, voucherId, tx = prisma) =>
    tx.order.count({ where: { customerId, voucherId, status: { not: 'CANCELLED' } } }),

  reviewedKeys: async (orderId) =>
    new Set((await prisma.review.findMany({ where: { orderId }, select: { productId: true } })).map((r) => r.productId)),
};
