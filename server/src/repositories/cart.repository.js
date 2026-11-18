import { prisma } from '../lib/prisma.js';
import { variantInclude } from './product.repository.js';

// Đủ dữ liệu để tính giá (pricing.service) và hiển thị dòng giỏ / dòng đơn
export const lineVariantInclude = {
  ...variantInclude,
  product: {
    select: {
      id: true, name: true, slug: true, status: true, deletedAt: true, basePrice: true, salePrice: true,
      categoryId: true, teamId: true,
      category: { select: { parentId: true } },
      team: { select: { name: true } },
      images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 6, select: { url: true, colorId: true } },
    },
  },
};

export const cartRepository = {
  // Mỗi khách một giỏ; tạo khi cần
  ensure: (customerId, tx = prisma) => tx.cart.upsert({ where: { customerId }, update: {}, create: { customerId } }),

  items: (cartId, tx = prisma) =>
    tx.cartItem.findMany({ where: { cartId }, orderBy: { createdAt: 'desc' }, include: { variant: { include: lineVariantInclude } } }),

  findItem: (cartId, variantId) => prisma.cartItem.findUnique({ where: { cartId_variantId: { cartId, variantId } } }),
  findOwnedItem: (cartId, id) => prisma.cartItem.findFirst({ where: { id, cartId }, include: { variant: { include: lineVariantInclude } } }),
  upsertItem: (cartId, variantId, quantity) =>
    prisma.cartItem.upsert({ where: { cartId_variantId: { cartId, variantId } }, update: { quantity }, create: { cartId, variantId, quantity } }),
  updateItem: (id, quantity) => prisma.cartItem.update({ where: { id }, data: { quantity } }),
  removeItem: (id) => prisma.cartItem.delete({ where: { id } }),
  clear: (cartId, tx = prisma) => tx.cartItem.deleteMany({ where: { cartId } }),

  findVariant: (id) => prisma.productVariant.findUnique({ where: { id }, include: lineVariantInclude }),
};
