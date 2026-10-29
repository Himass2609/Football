import { Router } from 'express';
import { catalogController } from '../controllers/catalog.controller.js';
import { newsController } from '../controllers/news.controller.js';
import { validate } from '../middlewares/validate.js';
import { MASTER_ENTITIES } from '../services/master-data.service.js';
import { publicNewsQuery, slugParam } from '../validators/news.validator.js';

export const publicRouter = Router();

// Chỉ nhận tham số dạng chuỗi (?a=1&a=2 tạo mảng → bỏ qua)
const stringQuery = (req, _res, next) => {
  req.valid = { query: Object.fromEntries(Object.entries(req.query).filter(([, v]) => typeof v === 'string')) };
  next();
};

for (const entity of Object.keys(MASTER_ENTITIES)) {
  publicRouter.get(`/${entity}`, stringQuery, catalogController.masterData(entity));
}

publicRouter.get('/promotions', catalogController.promotions);
publicRouter.get('/vouchers', catalogController.vouchers);
publicRouter.get('/settings', catalogController.settings);

publicRouter.get('/news', validate({ query: publicNewsQuery }), newsController.listPublic);
publicRouter.get('/news/:slug', validate({ params: slugParam }), newsController.getPublic);
