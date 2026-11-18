import { prisma } from '../lib/prisma.js';

export const addressRepository = {
  list: (customerId) => prisma.address.findMany({ where: { customerId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] }),
  count: (customerId) => prisma.address.count({ where: { customerId } }),
  findOwned: (customerId, id) => prisma.address.findFirst({ where: { id, customerId } }),
  findLatest: (customerId) => prisma.address.findFirst({ where: { customerId }, orderBy: { createdAt: 'desc' } }),
  create: (data, tx = prisma) => tx.address.create({ data }),
  update: (id, data, tx = prisma) => tx.address.update({ where: { id }, data }),
  remove: (id) => prisma.address.delete({ where: { id } }),
  clearDefault: (customerId, tx = prisma) => tx.address.updateMany({ where: { customerId, isDefault: true }, data: { isDefault: false } }),
};
