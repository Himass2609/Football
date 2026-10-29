import { prisma } from '../lib/prisma.js';

const authInclude = {
  role: { include: { permissions: { include: { permission: true } } } },
  customer: true,
};

const adminInclude = {
  role: { select: { id: true, code: true, name: true } },
  customer: { select: { fullName: true, phone: true } },
};

export const accountRepository = {
  findAuthById: (id) => prisma.account.findUnique({ where: { id }, include: authInclude }),

  findAuthByEmail: (email) => prisma.account.findUnique({ where: { email }, include: authInclude }),

  findByEmail: (email) => prisma.account.findUnique({ where: { email } }),

  findDetailById: (id) =>
    prisma.account.findFirst({ where: { id, deletedAt: null }, include: adminInclude }),

  // SQL Server không cho UNIQUE trên cột nullable có nhiều NULL → kiểm tra trùng SĐT ở tầng ứng dụng
  findActiveByPhone: (phone, excludeAccountId) =>
    prisma.customer.findFirst({
      where: {
        phone,
        account: { deletedAt: null },
        ...(excludeAccountId && { accountId: { not: excludeAccountId } }),
      },
    }),

  createWithProfile: ({ email, passwordHash, roleId, fullName, phone, withCart }) =>
    prisma.account.create({
      data: {
        email,
        passwordHash,
        roleId,
        customer: { create: { fullName, phone, ...(withCart && { cart: { create: {} } }) } },
      },
      include: authInclude,
    }),

  update: (id, data) => prisma.account.update({ where: { id }, data, include: adminInclude }),

  updateProfile: (accountId, data) => prisma.customer.update({ where: { accountId }, data }),

  async list({ where, skip, take }) {
    const [items, total] = await prisma.$transaction([
      prisma.account.findMany({ where, skip, take, include: adminInclude, orderBy: { createdAt: 'desc' } }),
      prisma.account.count({ where }),
    ]);
    return { items, total };
  },

  countActiveByRole: (roleCode) =>
    prisma.account.count({ where: { deletedAt: null, status: 'ACTIVE', role: { code: roleCode } } }),
};
