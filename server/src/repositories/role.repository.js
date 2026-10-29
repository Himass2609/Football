import { prisma } from '../lib/prisma.js';

export const roleRepository = {
  findByCode: (code) => prisma.role.findUnique({ where: { code } }),

  findById: (id) => prisma.role.findUnique({ where: { id } }),

  findAllWithPermissions: () =>
    prisma.role.findMany({
      orderBy: { id: 'asc' },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { accounts: { where: { deletedAt: null } } } },
      },
    }),

  findAllPermissions: () => prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { code: 'asc' }] }),

  replacePermissions: (roleId, permissionIds) =>
    prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId } }),
      prisma.rolePermission.createMany({ data: permissionIds.map((permissionId) => ({ roleId, permissionId })) }),
    ]),
};
