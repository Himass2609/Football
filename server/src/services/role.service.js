import { ROLES } from '../config/constants.js';
import { roleRepository } from '../repositories/role.repository.js';
import { ApiError } from '../utils/api-error.js';

const toRole = (role) => ({
  id: role.id,
  code: role.code,
  name: role.name,
  description: role.description,
  accountCount: role._count?.accounts ?? 0,
  permissions: role.permissions.map((rp) => rp.permission.code),
});

export const roleService = {
  async list() {
    return (await roleRepository.findAllWithPermissions()).map(toRole);
  },

  listPermissions: () => roleRepository.findAllPermissions(),

  async updatePermissions(roleId, permissionIds) {
    const role = await roleRepository.findById(roleId);
    if (!role) throw ApiError.notFound('Không tìm thấy vai trò');
    // ADMIN luôn giữ toàn quyền để tránh tự khóa hệ thống
    if (role.code === ROLES.ADMIN) throw ApiError.unprocessable('Không thể chỉnh quyền của vai trò ADMIN', 'PROTECTED_ROLE');

    const all = await roleRepository.findAllPermissions();
    const validIds = new Set(all.map((p) => p.id));
    if (permissionIds.some((id) => !validIds.has(id))) throw ApiError.badRequest('Có quyền không tồn tại', 'INVALID_PERMISSION');

    await roleRepository.replacePermissions(roleId, [...new Set(permissionIds)]);
    return (await this.list()).find((r) => r.id === roleId);
  },
};
