import { masterDataService } from '../services/master-data.service.js';
import { getOverview } from '../services/overview.service.js';
import { roleService } from '../services/role.service.js';
import { settingService } from '../services/setting.service.js';
import { userService } from '../services/user.service.js';
import { ApiError } from '../utils/api-error.js';
import { created, noContent, ok } from '../utils/response.js';

export const overviewController = {
  get: async (_req, res) => ok(res, await getOverview()),
};

export const userController = {
  list: async (req, res) => {
    const { items, meta } = await userService.list(req.valid.query);
    ok(res, items, meta);
  },
  get: async (req, res) => ok(res, await userService.getById(req.valid.params.id)),
  create: async (req, res) => created(res, await userService.create(req.valid.body)),
  update: async (req, res) => ok(res, await userService.update(req.valid.params.id, req.valid.body)),
  setStatus: async (req, res) => ok(res, await userService.setStatus(req.user.id, req.valid.params.id, req.valid.body.status)),
  setRole: async (req, res) => ok(res, await userService.setRole(req.user.id, req.valid.params.id, req.valid.body.roleId)),
  resetPassword: async (req, res) => {
    await userService.resetPassword(req.valid.params.id, req.valid.body.password);
    noContent(res);
  },
  remove: async (req, res) => {
    await userService.remove(req.user.id, req.valid.params.id);
    noContent(res);
  },
};

export const roleController = {
  list: async (_req, res) => ok(res, await roleService.list()),
  permissions: async (_req, res) => ok(res, await roleService.listPermissions()),
  updatePermissions: async (req, res) => ok(res, await roleService.updatePermissions(req.valid.params.id, req.valid.body.permissionIds)),
};

// Controller dùng chung cho mọi bảng master data, entity lấy từ đường dẫn
export const masterDataController = (entity) => ({
  list: async (req, res) => {
    const { items, meta } = await masterDataService.listAdmin(entity, req.valid.query);
    ok(res, items, meta);
  },
  get: async (req, res) => ok(res, await masterDataService.getById(entity, req.valid.params.id)),
  create: async (req, res) => created(res, await masterDataService.create(entity, req.valid.body)),
  update: async (req, res) => ok(res, await masterDataService.update(entity, req.valid.params.id, req.valid.body)),
  remove: async (req, res) => {
    await masterDataService.remove(entity, req.valid.params.id);
    noContent(res);
  },
});

// Controller CRUD cho service có list/getById/create/update/remove
export const crudController = (service) => ({
  list: async (req, res) => {
    const { items, meta } = await service.list(req.valid.query);
    ok(res, items, meta);
  },
  get: async (req, res) => ok(res, await service.getById(req.valid.params.id)),
  create: async (req, res) => created(res, await service.create(req.valid.body)),
  update: async (req, res) => ok(res, await service.update(req.valid.params.id, req.valid.body)),
  remove: async (req, res) => {
    await service.remove(req.valid.params.id);
    noContent(res);
  },
});

export const settingController = {
  get: async (_req, res) => ok(res, await settingService.get()),
  update: async (req, res) => ok(res, await settingService.update(req.valid.body)),
};

export const uploadController = {
  images: (req, res) => {
    if (!req.files?.length) throw ApiError.badRequest('Vui lòng chọn ảnh', 'NO_FILE');
    created(res, req.files.map((file) => ({ url: `/uploads/${file.filename}`, size: file.size, name: file.originalname })));
  },
};
