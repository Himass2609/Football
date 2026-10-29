import { listPublicVouchers, promotionService } from '../services/marketing.service.js';
import { masterDataService } from '../services/master-data.service.js';
import { settingService } from '../services/setting.service.js';
import { ok } from '../utils/response.js';

export const catalogController = {
  masterData: (entity) => async (req, res) => ok(res, await masterDataService.listPublic(entity, req.valid.query)),
  promotions: async (_req, res) => ok(res, await promotionService.listRunning()),
  vouchers: async (_req, res) => ok(res, await listPublicVouchers()),
  settings: async (_req, res) => ok(res, await settingService.get()),
};
