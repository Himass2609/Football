import { prisma } from '../lib/prisma.js';

const teamSelect = {
  id: true, name: true, slug: true, shortName: true, logoUrl: true, primaryColor: true, secondaryColor: true, kitPattern: true,
};

export const variantInclude = {
  size: { select: { id: true, name: true, sizeType: true, sortOrder: true } },
  color: { select: { id: true, name: true, hex: true } },
};

// Dữ liệu đủ để vẽ thẻ sản phẩm
export const cardInclude = {
  category: { select: { id: true, name: true, slug: true, parentId: true } },
  brand: { select: { id: true, name: true, slug: true } },
  team: { select: teamSelect },
  images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 2, select: { url: true, alt: true } },
  variants: { where: { isActive: true }, select: { stockQuantity: true, price: true, ...variantInclude } },
};

export const detailInclude = {
  category: { select: { id: true, name: true, slug: true, parentId: true } },
  brand: { select: { id: true, name: true, slug: true, logoUrl: true } },
  team: { select: { ...teamSelect, league: { select: { id: true, name: true, slug: true } } } },
  productType: { select: { id: true, name: true, slug: true } },
  images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], include: { color: { select: { id: true, name: true } } } },
  variants: { include: variantInclude, orderBy: [{ size: { sortOrder: 'asc' } }, { colorId: 'asc' }] },
};

export const productRepository = {
  // Bản rút gọn chỉ để tính giá & sắp xếp trước khi phân trang
  findLight: (where) =>
    prisma.product.findMany({
      where,
      select: {
        id: true, name: true, basePrice: true, salePrice: true, categoryId: true, teamId: true, createdAt: true, soldCount: true,
        category: { select: { parentId: true } },
      },
    }),

  findByIds: (ids, include = cardInclude) => prisma.product.findMany({ where: { id: { in: ids } }, include }),

  findBySlug: (slug, where = {}) => prisma.product.findFirst({ where: { slug, deletedAt: null, ...where }, include: detailInclude }),

  findDetail: (id) => prisma.product.findFirst({ where: { id, deletedAt: null }, include: detailInclude }),

  async listAdmin({ where, skip, take }) {
    const [items, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
        include: {
          category: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } },
          team: { select: teamSelect },
          images: { where: { isPrimary: true }, take: 1, select: { url: true } },
          variants: { select: { stockQuantity: true, isActive: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);
    return { items, total };
  },

  slugExists: async (slug, excludeId) =>
    (await prisma.product.count({ where: { slug, ...(excludeId && { id: { not: excludeId } }) } })) > 0,

  create: (data) => prisma.product.create({ data }),
  update: (id, data) => prisma.product.update({ where: { id }, data }),
};
