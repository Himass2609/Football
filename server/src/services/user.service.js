import { ACCOUNT_STATUS, ROLES } from '../config/constants.js';
import { prisma } from '../lib/prisma.js';
import { accountRepository } from '../repositories/account.repository.js';
import { roleRepository } from '../repositories/role.repository.js';
import { ApiError } from '../utils/api-error.js';
import { buildMeta, getPagination } from '../utils/pagination.js';
import { assertEmailAndPhoneAvailable, hashPassword } from './auth.service.js';

const toUser = (account) => ({
  id: account.id,
  email: account.email,
  status: account.status,
  role: account.role,
  fullName: account.customer?.fullName ?? '',
  phone: account.customer?.phone ?? null,
  lastLogin: account.lastLogin,
  createdAt: account.createdAt,
});

async function getOrThrow(id) {
  const account = await accountRepository.findDetailById(id);
  if (!account) throw ApiError.notFound('Không tìm thấy tài khoản');
  return account;
}

function assertNotSelf(actorId, targetId, action) {
  if (actorId === targetId) throw ApiError.unprocessable(`Bạn không thể ${action} chính tài khoản của mình`, 'SELF_ACTION');
}

// Không cho hệ thống rơi vào trạng thái không còn ADMIN nào hoạt động
async function assertNotLastAdmin(account) {
  if (account.role.code !== ROLES.ADMIN || account.status !== ACCOUNT_STATUS.ACTIVE) return;
  if ((await accountRepository.countActiveByRole(ROLES.ADMIN)) <= 1) {
    throw ApiError.unprocessable('Hệ thống phải còn ít nhất một quản trị viên hoạt động', 'LAST_ADMIN');
  }
}

async function getRoleOrThrow(roleId) {
  const role = await roleRepository.findById(roleId);
  if (!role) throw ApiError.badRequest('Vai trò không tồn tại', 'INVALID_ROLE', [{ field: 'roleId', message: 'Vai trò không tồn tại' }]);
  return role;
}

export const userService = {
  async list(query) {
    const pagination = getPagination(query);
    const where = {
      deletedAt: null,
      ...(query.roleId && { roleId: query.roleId }),
      ...(query.status && { status: query.status }),
      ...(query.q && {
        OR: [
          { email: { contains: query.q } },
          { customer: { fullName: { contains: query.q } } },
          { customer: { phone: { contains: query.q } } },
        ],
      }),
    };
    const { items, total } = await accountRepository.list({ where, skip: pagination.skip, take: pagination.take });
    return { items: items.map(toUser), meta: buildMeta(pagination, total) };
  },

  async getById(id) {
    return toUser(await getOrThrow(id));
  },

  async create({ email, password, fullName, phone, roleId }) {
    await assertEmailAndPhoneAvailable({ email, phone });
    const role = await getRoleOrThrow(roleId);
    const account = await accountRepository.createWithProfile({
      email,
      fullName,
      phone,
      roleId,
      passwordHash: await hashPassword(password),
      withCart: role.code === ROLES.CUSTOMER,
    });
    return this.getById(account.id);
  },

  async update(id, { email, fullName, phone }) {
    await getOrThrow(id);
    await assertEmailAndPhoneAvailable({ email, phone }, id);
    await prisma.$transaction([
      prisma.account.update({ where: { id }, data: { ...(email && { email }) } }),
      prisma.customer.update({
        where: { accountId: id },
        data: { ...(fullName && { fullName }), ...(phone !== undefined && { phone }) },
      }),
    ]);
    return this.getById(id);
  },

  async setStatus(actorId, id, status) {
    assertNotSelf(actorId, id, 'khóa');
    const account = await getOrThrow(id);
    if (status === ACCOUNT_STATUS.LOCKED) await assertNotLastAdmin(account);
    return toUser(await accountRepository.update(id, { status }));
  },

  async setRole(actorId, id, roleId) {
    assertNotSelf(actorId, id, 'đổi vai trò');
    const account = await getOrThrow(id);
    const role = await getRoleOrThrow(roleId);
    if (role.code !== ROLES.ADMIN) await assertNotLastAdmin(account);
    if (role.code === ROLES.CUSTOMER) {
      const customer = await prisma.customer.findUnique({ where: { accountId: id }, select: { id: true } });
      await prisma.cart.upsert({ where: { customerId: customer.id }, update: {}, create: { customerId: customer.id } });
    }
    return toUser(await accountRepository.update(id, { roleId }));
  },

  async resetPassword(id, password) {
    await getOrThrow(id);
    await accountRepository.update(id, { passwordHash: await hashPassword(password) });
  },

  // Xóa mềm: giữ lịch sử đơn hàng, giải phóng email để có thể đăng ký lại
  async remove(actorId, id) {
    assertNotSelf(actorId, id, 'xóa');
    const account = await getOrThrow(id);
    await assertNotLastAdmin(account);
    await accountRepository.update(id, {
      deletedAt: new Date(),
      status: ACCOUNT_STATUS.LOCKED,
      email: `deleted_${id}_${Date.now()}@${account.email.split('@')[1] ?? 'deleted'}`.slice(0, 100),
    });
  },
};
