import { addressService } from '../services/address.service.js';
import { cartService } from '../services/cart.service.js';
import { orderService } from '../services/order.service.js';
import { reviewService } from '../services/review.service.js';
import { getStats } from '../services/stats.service.js';
import { created, noContent, ok } from '../utils/response.js';

const customerId = (req) => req.user.customerId;

export const addressController = {
  list: async (req, res) => ok(res, await addressService.list(customerId(req))),
  create: async (req, res) => created(res, await addressService.create(customerId(req), req.valid.body)),
  update: async (req, res) => ok(res, await addressService.update(customerId(req), req.valid.params.id, req.valid.body)),
  remove: async (req, res) => {
    await addressService.remove(customerId(req), req.valid.params.id);
    noContent(res);
  },
};

export const cartController = {
  get: async (req, res) => ok(res, await cartService.get(customerId(req))),
  add: async (req, res) => ok(res, await cartService.add(customerId(req), req.valid.body)),
  update: async (req, res) => ok(res, await cartService.update(customerId(req), req.valid.params.itemId, req.valid.body)),
  remove: async (req, res) => ok(res, await cartService.remove(customerId(req), req.valid.params.itemId)),
};

export const orderController = {
  preview: async (req, res) => ok(res, await orderService.preview(customerId(req), req.valid.body)),
  place: async (req, res) => created(res, await orderService.place(req.user, req.valid.body)),
  list: async (req, res) => {
    const { items, meta } = await orderService.listForCustomer(customerId(req), req.valid.query);
    ok(res, items, meta);
  },
  get: async (req, res) => ok(res, await orderService.getForCustomer(customerId(req), req.valid.params.code)),
  cancel: async (req, res) => ok(res, await orderService.cancelByCustomer(req.user, req.valid.params.code, req.valid.body)),
  pay: async (req, res) => ok(res, await orderService.payOnline(req.user, req.valid.params.code, req.valid.body)),

  listAdmin: async (req, res) => {
    const { items, meta } = await orderService.listAdmin(req.valid.query);
    ok(res, items, meta);
  },
  getAdmin: async (req, res) => ok(res, await orderService.getAdmin(req.valid.params.id)),
  changeStatus: async (req, res) => ok(res, await orderService.changeStatus(req.valid.params.id, req.valid.body, req.user.id)),
};

export const reviewController = {
  create: async (req, res) => created(res, await reviewService.create(customerId(req), req.valid.body)),
  listForProduct: async (req, res) => {
    const { items, meta } = await reviewService.listForProduct(req.valid.params.slug, req.valid.query);
    ok(res, items, meta);
  },
  listAdmin: async (req, res) => {
    const { items, meta } = await reviewService.listAdmin(req.valid.query);
    ok(res, items, meta);
  },
  setHidden: async (req, res) => ok(res, await reviewService.setHidden(req.valid.params.id, req.valid.body.isHidden)),
};

export const statsController = {
  get: async (req, res) => ok(res, await getStats(req.valid.query.days)),
};
