import { prisma } from '../lib/prisma.js';

// Repository CRUD dùng chung cho các bảng master data / marketing
export const createCrudRepository = (model) => {
  const delegate = prisma[model];
  return {
    async list({ where, skip, take, orderBy, include, select }) {
      const [items, total] = await prisma.$transaction([
        delegate.findMany({ where, skip, take, orderBy, include, select }),
        delegate.count({ where }),
      ]);
      return { items, total };
    },
    findMany: (args) => delegate.findMany(args),
    findById: (id, args = {}) => delegate.findUnique({ where: { id }, ...args }),
    findFirst: (args) => delegate.findFirst(args),
    exists: async (where) => (await delegate.count({ where })) > 0,
    create: (data, args = {}) => delegate.create({ data, ...args }),
    update: (id, data, args = {}) => delegate.update({ where: { id }, data, ...args }),
    remove: (id) => delegate.delete({ where: { id } }),
  };
};
