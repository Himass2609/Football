import { inventoryService } from '../services/inventory.service.js';
import { imageService, variantService } from '../services/product-media.service.js';
import { productService } from '../services/product.service.js';
import { created, noContent, ok } from '../utils/response.js';

export const productController = {
  listPublic: async (req, res) => {
    const { items, meta } = await productService.listPublic(req.valid.query);
    ok(res, items, meta);
  },
  getPublic: async (req, res) => ok(res, await productService.getPublicBySlug(req.valid.params.slug)),

  list: async (req, res) => {
    const { items, meta } = await productService.listAdmin(req.valid.query);
    ok(res, items, meta);
  },
  get: async (req, res) => ok(res, await productService.getAdmin(req.valid.params.id)),
  create: async (req, res) => created(res, await productService.create(req.valid.body)),
  update: async (req, res) => ok(res, await productService.update(req.valid.params.id, req.valid.body)),
  setStatus: async (req, res) => ok(res, await productService.setStatus(req.valid.params.id, req.valid.body.status)),
  remove: async (req, res) => {
    await productService.remove(req.valid.params.id);
    noContent(res);
  },
};

export const variantController = {
  generate: async (req, res) => created(res, await variantService.generate(req.valid.params.id, req.valid.body, req.user.id)),
  update: async (req, res) => ok(res, await variantService.update(req.valid.params.id, req.valid.params.variantId, req.valid.body)),
  remove: async (req, res) => {
    await variantService.remove(req.valid.params.id, req.valid.params.variantId);
    noContent(res);
  },
};

export const imageController = {
  add: async (req, res) => created(res, await imageService.add(req.valid.params.id, req.valid.body.images)),
  update: async (req, res) => ok(res, await imageService.update(req.valid.params.id, req.valid.params.imageId, req.valid.body)),
  reorder: async (req, res) => ok(res, await imageService.reorder(req.valid.params.id, req.valid.body.imageIds)),
  remove: async (req, res) => ok(res, await imageService.remove(req.valid.params.id, req.valid.params.imageId)),
};

export const inventoryController = {
  list: async (req, res) => {
    const { items, meta } = await inventoryService.list(req.valid.query);
    ok(res, items, meta);
  },
  adjust: async (req, res) => ok(res, await inventoryService.adjust(req.valid.params.id, req.valid.body, req.user.id)),
  logs: async (req, res) => ok(res, await inventoryService.logs(req.valid.params.id)),
};
