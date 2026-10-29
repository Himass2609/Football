import { prisma } from '../lib/prisma.js';

const include = {
  categories: { include: { category: { select: { id: true, name: true, slug: true } } } },
  author: { select: { id: true, customer: { select: { fullName: true } } } },
};

export const newsRepository = {
  async list({ where, skip, take, orderBy = { createdAt: 'desc' } }) {
    const [items, total] = await prisma.$transaction([
      prisma.news.findMany({ where, skip, take, orderBy, include }),
      prisma.news.count({ where }),
    ]);
    return { items, total };
  },

  findById: (id) => prisma.news.findFirst({ where: { id, deletedAt: null }, include }),

  findBySlug: (slug, where = {}) => prisma.news.findFirst({ where: { slug, deletedAt: null, ...where }, include }),

  slugExists: async (slug, excludeId) =>
    (await prisma.news.count({ where: { slug, ...(excludeId && { id: { not: excludeId } }) } })) > 0,

  create: (data, categoryIds = []) =>
    prisma.news.create({
      data: { ...data, categories: { create: categoryIds.map((categoryId) => ({ categoryId })) } },
      include,
    }),

  update: (id, data, categoryIds) =>
    prisma.$transaction(async (tx) => {
      if (categoryIds) {
        await tx.newsOnCategory.deleteMany({ where: { newsId: id } });
        if (categoryIds.length) await tx.newsOnCategory.createMany({ data: categoryIds.map((categoryId) => ({ newsId: id, categoryId })) });
      }
      return tx.news.update({ where: { id }, data, include });
    }),
};
