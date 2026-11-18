import { Router } from 'express';
import { P } from '../config/constants.js';
import { addressController, cartController, orderController, reviewController } from '../controllers/order.controller.js';
import { authenticate, requirePermission } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { ApiError } from '../utils/api-error.js';
import { idParam } from '../validators/common.js';
import {
  addCartItemSchema,
  addressSchema,
  cancelOrderSchema,
  cartItemParams,
  checkoutPreviewSchema,
  createReviewSchema,
  customerOrderQuery,
  orderCodeParam,
  payOrderSchema,
  placeOrderSchema,
  updateAddressSchema,
  updateCartItemSchema,
} from '../validators/order.validator.js';

// Mọi chức năng mua hàng cần hồ sơ khách hàng (Customer)
const requireCustomer = (req, _res, next) => {
  if (!req.user.customerId) throw ApiError.forbidden('Tài khoản chưa có hồ sơ khách hàng');
  next();
};
const guard = (permission) => [authenticate, requirePermission(permission), requireCustomer];

export const customerRouter = Router();

// Sổ địa chỉ: /api/v1/account/addresses
const addresses = Router();
addresses.use(guard(P.PROFILE_MANAGE));
addresses.get('/', addressController.list);
addresses.post('/', validate({ body: addressSchema }), addressController.create);
addresses.put('/:id', validate({ params: idParam, body: updateAddressSchema }), addressController.update);
addresses.delete('/:id', validate({ params: idParam }), addressController.remove);
customerRouter.use('/account/addresses', addresses);

// Giỏ hàng
const cart = Router();
cart.use(guard(P.CART_USE));
cart.get('/', cartController.get);
cart.post('/items', validate({ body: addCartItemSchema }), cartController.add);
cart.patch('/items/:itemId', validate({ params: cartItemParams, body: updateCartItemSchema }), cartController.update);
cart.delete('/items/:itemId', validate({ params: cartItemParams }), cartController.remove);
customerRouter.use('/cart', cart);

// Thanh toán & đơn hàng
customerRouter.post('/checkout/preview', guard(P.ORDER_PLACE), validate({ body: checkoutPreviewSchema }), orderController.preview);

const orders = Router();
orders.use(guard(P.ORDER_PLACE));
orders.get('/', validate({ query: customerOrderQuery }), orderController.list);
orders.post('/', validate({ body: placeOrderSchema }), orderController.place);
orders.get('/:code', validate({ params: orderCodeParam }), orderController.get);
orders.post('/:code/cancel', validate({ params: orderCodeParam, body: cancelOrderSchema }), orderController.cancel);
orders.post('/:code/pay', validate({ params: orderCodeParam, body: payOrderSchema }), orderController.pay);
customerRouter.use('/orders', orders);

// Đánh giá
customerRouter.post('/reviews', guard(P.REVIEW_WRITE), validate({ body: createReviewSchema }), reviewController.create);
