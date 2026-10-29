import { Router } from 'express';
import { P, ROLES } from '../config/constants.js';
import {
  crudController,
  masterDataController,
  overviewController,
  roleController,
  settingController,
  uploadController,
  userController,
} from '../controllers/admin.controller.js';
import { newsController } from '../controllers/news.controller.js';
import { imageController, inventoryController, productController, variantController } from '../controllers/product.controller.js';
import {
  addImagesSchema,
  adjustStockSchema,
  adminProductQuery,
  createProductSchema,
  generateVariantsSchema,
  imageParams,
  inventoryQuery,
  productStatusSchema,
  reorderImagesSchema,
  updateImageSchema,
  updateProductSchema,
  updateVariantSchema,
  variantParams,
} from '../validators/product.validator.js';
import { authenticate, requirePermission, requireRole } from '../middlewares/auth.js';
import { uploadImage } from '../middlewares/upload.js';
import { validate } from '../middlewares/validate.js';
import { promotionService, voucherService } from '../services/marketing.service.js';
import { MASTER_ENTITIES } from '../services/master-data.service.js';
import { id, idParam, listQuery, z } from '../validators/common.js';
import {
  createPromotionSchema,
  createVoucherSchema,
  marketingListQuery,
  updatePromotionSchema,
  updateVoucherSchema,
} from '../validators/marketing.validator.js';
import { masterDataSchemas } from '../validators/master-data.validator.js';
import { adminNewsQuery, createNewsSchema, newsStatusSchema, updateNewsSchema } from '../validators/news.validator.js';
import { updateSettingSchema } from '../validators/setting.validator.js';
import {
  createUserSchema,
  resetUserPasswordSchema,
  updateUserSchema,
  userListQuery,
  userRoleSchema,
  userStatusSchema,
} from '../validators/user.validator.js';

export const adminRouter = Router();

adminRouter.use(authenticate, requireRole(ROLES.ADMIN));

// Gắn bộ route CRUD chuẩn: GET / · GET /:id · POST / · PUT /:id · DELETE /:id
function mountCrud(path, permission, controller, { listSchema = listQuery, createSchema, updateSchema }) {
  const router = Router();
  router.use(requirePermission(permission));
  router.get('/', validate({ query: listSchema }), controller.list);
  router.get('/:id', validate({ params: idParam }), controller.get);
  router.post('/', validate({ body: createSchema }), controller.create);
  router.put('/:id', validate({ params: idParam, body: updateSchema }), controller.update);
  router.delete('/:id', validate({ params: idParam }), controller.remove);
  adminRouter.use(path, router);
  return router;
}

adminRouter.get('/overview', requirePermission(P.DASHBOARD_VIEW), overviewController.get);

// Tài khoản
const users = mountCrud('/users', P.USER_MANAGE, userController, {
  listSchema: userListQuery,
  createSchema: createUserSchema,
  updateSchema: updateUserSchema,
});
users.patch('/:id/status', validate({ params: idParam, body: userStatusSchema }), userController.setStatus);
users.patch('/:id/role', validate({ params: idParam, body: userRoleSchema }), userController.setRole);
users.patch('/:id/password', validate({ params: idParam, body: resetUserPasswordSchema }), userController.resetPassword);

// Vai trò & quyền
adminRouter.get('/roles', requirePermission(P.ROLE_MANAGE), roleController.list);
adminRouter.get('/permissions', requirePermission(P.ROLE_MANAGE), roleController.permissions);
adminRouter.put(
  '/roles/:id/permissions',
  requirePermission(P.ROLE_MANAGE),
  validate({ params: idParam, body: z.object({ permissionIds: z.array(id).max(100) }) }),
  roleController.updatePermissions,
);

// Dữ liệu nền
for (const entity of Object.keys(MASTER_ENTITIES)) {
  const permission = entity === 'news-categories' ? P.NEWS_MANAGE : P.CATALOG_MANAGE;
  mountCrud(`/${entity}`, permission, masterDataController(entity), {
    createSchema: masterDataSchemas[entity],
    updateSchema: masterDataSchemas[entity].partial(),
  });
}

// Khuyến mãi & voucher
mountCrud('/promotions', P.MARKETING_MANAGE, crudController(promotionService), {
  listSchema: marketingListQuery,
  createSchema: createPromotionSchema,
  updateSchema: updatePromotionSchema,
});
mountCrud('/vouchers', P.MARKETING_MANAGE, crudController(voucherService), {
  listSchema: marketingListQuery,
  createSchema: createVoucherSchema,
  updateSchema: updateVoucherSchema,
});

// Tin tức
const news = mountCrud('/news', P.NEWS_MANAGE, { ...newsController, list: newsController.listAdmin }, {
  listSchema: adminNewsQuery,
  createSchema: createNewsSchema,
  updateSchema: updateNewsSchema,
});
news.patch('/:id/status', validate({ params: idParam, body: newsStatusSchema }), newsController.changeStatus);

// Sản phẩm, biến thể, ảnh
const products = mountCrud('/products', P.PRODUCT_MANAGE, productController, {
  listSchema: adminProductQuery,
  createSchema: createProductSchema,
  updateSchema: updateProductSchema,
});
products.patch('/:id/status', validate({ params: idParam, body: productStatusSchema }), productController.setStatus);
products.post('/:id/variants', validate({ params: idParam, body: generateVariantsSchema }), variantController.generate);
products.patch('/:id/variants/:variantId', validate({ params: variantParams, body: updateVariantSchema }), variantController.update);
products.delete('/:id/variants/:variantId', validate({ params: variantParams }), variantController.remove);
products.post('/:id/images', validate({ params: idParam, body: addImagesSchema }), imageController.add);
products.put('/:id/images/order', validate({ params: idParam, body: reorderImagesSchema }), imageController.reorder);
products.patch('/:id/images/:imageId', validate({ params: imageParams, body: updateImageSchema }), imageController.update);
products.delete('/:id/images/:imageId', validate({ params: imageParams }), imageController.remove);

// Tồn kho theo biến thể
const inventory = Router();
inventory.use(requirePermission(P.INVENTORY_MANAGE));
inventory.get('/', validate({ query: inventoryQuery }), inventoryController.list);
inventory.post('/:id/adjust', validate({ params: idParam, body: adjustStockSchema }), inventoryController.adjust);
inventory.get('/:id/logs', validate({ params: idParam }), inventoryController.logs);
adminRouter.use('/inventory', inventory);

// Cấu hình & upload
adminRouter.get('/settings', requirePermission(P.SETTING_MANAGE), settingController.get);
adminRouter.put('/settings', requirePermission(P.SETTING_MANAGE), validate({ body: updateSettingSchema }), settingController.update);
adminRouter.post('/uploads', uploadImage.array('files', 10), uploadController.images);
