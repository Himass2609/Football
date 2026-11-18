import crypto from 'node:crypto';
import {
  INVENTORY_REASONS,
  ORDER_PAYMENT_STATUS,
  ORDER_STATUS,
  ORDER_TRANSITIONS,
  PAYMENT_METHODS,
  PAYMENT_STATUS,
} from '../config/constants.js';
import { prisma } from '../lib/prisma.js';
import { cartRepository } from '../repositories/cart.repository.js';
import { orderRepository } from '../repositories/order.repository.js';
import { settingRepository } from '../repositories/setting.repository.js';
import { ApiError } from '../utils/api-error.js';
import { buildMeta, getPagination } from '../utils/pagination.js';
import { addressService, formatAddress } from './address.service.js';
import { loadCartLines } from './cart.service.js';
import { evaluateVoucher } from './voucher-check.service.js';

const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 };

// ───────── Tính tiền ─────────
async function computeCheckout(customerId, voucherCode, tx = prisma) {
  const { cart, lines } = await loadCartLines(customerId, tx);
  if (!lines.length) throw ApiError.unprocessable('Giỏ hàng đang trống', 'CART_EMPTY');
  const broken = lines.filter((l) => l.issue);
  if (broken.length) {
    throw ApiError.conflict(
      'Một số sản phẩm trong giỏ không còn đủ hàng, vui lòng cập nhật giỏ hàng',
      'CART_INVALID',
      broken.map((l) => ({ field: String(l.id), message: `${l.product.name} (${l.size.name}/${l.color.name}): ${l.issueMessage}` })),
    );
  }

  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const { voucher, discount } = voucherCode ? await evaluateVoucher(voucherCode, { customerId, lines, subtotal }, tx) : { voucher: null, discount: 0 };
  const settings = await settingRepository.get();
  const shippingFee = subtotal - discount >= Number(settings.freeShipThreshold) ? 0 : Number(settings.shippingFee);

  return {
    cart,
    lines,
    voucher,
    totals: { subtotal, discount, shippingFee, total: subtotal - discount + shippingFee },
    freeShipThreshold: Number(settings.freeShipThreshold),
  };
}

// JS + yyMMdd + 4 ký tự (CLAUDE.md 5.11)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
async function generateOrderCode(tx) {
  const d = new Date();
  const date = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const suffix = Array.from(crypto.randomBytes(4), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
    const code = `JS${date}${suffix}`;
    if (!(await orderRepository.codeExists(code, tx))) return code;
  }
  throw new ApiError(500, 'ORDER_CODE', 'Không tạo được mã đơn hàng, vui lòng thử lại');
}

// ───────── Kho & voucher trong transaction ─────────
async function takeStock(tx, line, orderId, actorId) {
  // Trừ kho có điều kiện — chống bán vượt tồn khi nhiều người đặt cùng lúc (CLAUDE.md 5.3)
  const { count } = await tx.productVariant.updateMany({
    where: { id: line.variantId, isActive: true, stockQuantity: { gte: line.quantity } },
    data: { stockQuantity: { decrement: line.quantity } },
  });
  if (count === 0) {
    throw ApiError.conflict(`${line.product.name} (${line.size.name}/${line.color.name}) vừa hết hàng, vui lòng cập nhật giỏ hàng`, 'OUT_OF_STOCK');
  }
  const { stockQuantity } = await tx.productVariant.findUnique({ where: { id: line.variantId }, select: { stockQuantity: true } });
  await tx.inventoryLog.create({
    data: { variantId: line.variantId, change: -line.quantity, stockAfter: stockQuantity, reason: INVENTORY_REASONS.ORDER, orderId, createdById: actorId },
  });
}

async function restoreStock(tx, order, actorId) {
  for (const d of order.details) {
    const { stockQuantity } = await tx.productVariant.update({
      where: { id: d.variantId },
      data: { stockQuantity: { increment: d.quantity } },
      select: { stockQuantity: true },
    });
    await tx.inventoryLog.create({
      data: { variantId: d.variantId, change: d.quantity, stockAfter: stockQuantity, reason: INVENTORY_REASONS.CANCEL, orderId: order.id, note: `Hủy đơn ${order.orderCode}`, createdById: actorId },
    });
    await tx.product.update({ where: { id: d.productId }, data: { soldCount: { decrement: d.quantity } } });
  }
}

async function useVoucher(tx, voucherId) {
  // Prisma không so sánh 2 cột được → câu lệnh có điều kiện để không vượt usageLimit
  const affected = await tx.$executeRaw`UPDATE [Voucher] SET usedCount = usedCount + 1 WHERE id = ${voucherId} AND (usageLimit IS NULL OR usedCount < usageLimit)`;
  if (affected === 0) throw ApiError.unprocessable('Mã giảm giá vừa hết lượt sử dụng', 'VOUCHER_INVALID', [{ field: 'voucherCode', message: 'Mã giảm giá vừa hết lượt sử dụng' }]);
}

const releaseVoucher = (tx, voucherId) => tx.$executeRaw`UPDATE [Voucher] SET usedCount = usedCount - 1 WHERE id = ${voucherId} AND usedCount > 0`;

// ───────── Định dạng trả về ─────────
const toSummary = (o) => ({
  id: o.id,
  orderCode: o.orderCode,
  status: o.status,
  paymentStatus: o.paymentStatus,
  paymentMethod: o.paymentMethod,
  total: o.total,
  createdAt: o.createdAt,
  receiverName: o.receiverName,
  receiverPhone: o.receiverPhone,
  customer: o.customer && { id: o.customer.id, fullName: o.customer.fullName, email: o.customer.account?.email },
  itemCount: o.details.reduce((sum, d) => sum + d.quantity, 0),
  lineCount: o.details.length,
  previews: o.details.slice(0, 3).map((d) => ({ imageUrl: d.imageUrl, productName: d.productName })),
});

const toDetail = (o, reviewed = new Set()) => ({
  ...toSummary(o),
  subtotal: o.subtotal,
  discountAmount: o.discountAmount,
  shippingFee: o.shippingFee,
  voucherCode: o.voucherCode,
  shippingAddress: o.shippingAddress,
  note: o.note,
  cancelReason: o.cancelReason,
  cancelledAt: o.cancelledAt,
  deliveredAt: o.deliveredAt,
  customer: { id: o.customer.id, fullName: o.customer.fullName, phone: o.customer.phone, email: o.customer.account?.email },
  items: o.details.map((d) => ({
    id: d.id,
    productId: d.productId,
    productSlug: d.product?.slug,
    variantId: d.variantId,
    productName: d.productName,
    sizeName: d.sizeName,
    colorName: d.colorName,
    imageUrl: d.imageUrl,
    unitPrice: d.unitPrice,
    quantity: d.quantity,
    lineTotal: d.lineTotal,
    reviewed: reviewed.has(d.productId),
  })),
  history: o.history,
  payments: o.payments,
  canCancel: o.status === ORDER_STATUS.PENDING,
  canPay: o.paymentMethod === PAYMENT_METHODS.ONLINE && o.status === ORDER_STATUS.PENDING && o.paymentStatus !== ORDER_PAYMENT_STATUS.PAID,
  canReview: o.status === ORDER_STATUS.DELIVERED,
});

// ───────── Hủy đơn (dùng chung cho khách & admin) ─────────
async function cancelInTx(tx, order, { reason, actorId, allowed }) {
  // Cập nhật có điều kiện để 2 yêu cầu hủy đồng thời không hoàn kho 2 lần
  const { count } = await tx.order.updateMany({
    where: { id: order.id, status: { in: allowed } },
    data: {
      status: ORDER_STATUS.CANCELLED,
      cancelReason: reason,
      cancelledAt: new Date(),
      paymentStatus: order.paymentStatus === ORDER_PAYMENT_STATUS.PAID ? ORDER_PAYMENT_STATUS.REFUNDED : order.paymentStatus,
    },
  });
  if (count === 0) throw ApiError.unprocessable('Đơn hàng không còn ở trạng thái có thể hủy', 'INVALID_STATUS');

  await restoreStock(tx, order, actorId);
  if (order.voucherId) await releaseVoucher(tx, order.voucherId);
  await tx.payment.updateMany({ where: { orderId: order.id, status: PAYMENT_STATUS.PENDING }, data: { status: PAYMENT_STATUS.CANCELLED } });
  await tx.orderStatusHistory.create({ data: { orderId: order.id, fromStatus: order.status, toStatus: ORDER_STATUS.CANCELLED, note: reason, changedById: actorId } });
}

export const orderService = {
  // Xem trước tổng tiền ở trang thanh toán (áp thử voucher)
  async preview(customerId, { voucherCode }) {
    const { lines, voucher, totals, freeShipThreshold } = await computeCheckout(customerId, voucherCode);
    return {
      items: lines,
      ...totals,
      freeShipThreshold,
      voucher: voucher && { code: voucher.code, description: voucher.description },
    };
  },

  async place(customer, { addressId, paymentMethod, voucherCode, note }) {
    const address = await addressService.findOwnedOrThrow(customer.customerId, addressId);

    const order = await prisma.$transaction(async (tx) => {
      // Tính lại toàn bộ trong transaction — không tin giá/tổng tiền từ client (CLAUDE.md 5.5)
      const { cart, lines, voucher, totals } = await computeCheckout(customer.customerId, voucherCode, tx);
      const orderCode = await generateOrderCode(tx);

      const created = await tx.order.create({
        data: {
          orderCode,
          customerId: customer.customerId,
          status: ORDER_STATUS.PENDING,
          paymentStatus: ORDER_PAYMENT_STATUS.UNPAID,
          paymentMethod,
          subtotal: totals.subtotal,
          discountAmount: totals.discount,
          shippingFee: totals.shippingFee,
          total: totals.total,
          voucherId: voucher?.id ?? null,
          voucherCode: voucher?.code ?? null,
          receiverName: address.receiverName,
          receiverPhone: address.phone,
          shippingAddress: formatAddress(address),
          note: note ?? null,
          // Snapshot tên, size, màu, giá tại thời điểm đặt (CLAUDE.md 5.4)
          details: {
            create: lines.map((l) => ({
              variantId: l.variantId,
              productId: l.product.id,
              productName: l.product.name,
              sizeName: l.size.name,
              colorName: l.color.name,
              imageUrl: l.image,
              unitPrice: l.unitPrice,
              quantity: l.quantity,
              lineTotal: l.lineTotal,
            })),
          },
          history: { create: { fromStatus: null, toStatus: ORDER_STATUS.PENDING, note: 'Khách đặt hàng', changedById: customer.id } },
          payments: { create: { method: paymentMethod, amount: totals.total, status: PAYMENT_STATUS.PENDING } },
        },
      });

      for (const line of lines) {
        await takeStock(tx, line, created.id, customer.id);
        await tx.product.update({ where: { id: line.product.id }, data: { soldCount: { increment: line.quantity } } });
      }
      if (voucher) await useVoucher(tx, voucher.id);
      await cartRepository.clear(cart.id, tx);
      return created;
    }, TX_OPTIONS);

    return this.getForCustomer(customer.customerId, order.orderCode);
  },

  async listForCustomer(customerId, query) {
    const paging = getPagination(query, 50);
    const { items, total } = await orderRepository.list({ customerId, ...(query.status && { status: query.status }) }, paging);
    return { items: items.map(toSummary), meta: buildMeta(paging, total) };
  },

  async getForCustomer(customerId, orderCode) {
    const order = await orderRepository.findDetail({ orderCode, customerId });
    if (!order) throw ApiError.notFound('Không tìm thấy đơn hàng');
    return toDetail(order, await orderRepository.reviewedKeys(order.id));
  },

  // Khách chỉ hủy được khi PENDING (CLAUDE.md 5.6)
  async cancelByCustomer(customer, orderCode, { reason }) {
    const found = await orderRepository.findDetail({ orderCode, customerId: customer.customerId });
    if (!found) throw ApiError.notFound('Không tìm thấy đơn hàng');
    if (found.status !== ORDER_STATUS.PENDING) {
      throw ApiError.unprocessable('Chỉ hủy được đơn đang chờ xác nhận. Vui lòng liên hệ cửa hàng để được hỗ trợ.', 'INVALID_STATUS');
    }
    await prisma.$transaction(async (tx) => {
      const order = await orderRepository.findForUpdate(found.id, tx);
      await cancelInTx(tx, order, { reason, actorId: customer.id, allowed: [ORDER_STATUS.PENDING] });
    }, TX_OPTIONS);
    return this.getForCustomer(customer.customerId, orderCode);
  },

  // Cổng thanh toán mô phỏng (sandbox): thất bại thì giữ đơn, cho thanh toán lại (CLAUDE.md 5.7)
  async payOnline(customer, orderCode, { result }) {
    const order = await orderRepository.findDetail({ orderCode, customerId: customer.customerId });
    if (!order) throw ApiError.notFound('Không tìm thấy đơn hàng');
    if (order.paymentMethod !== PAYMENT_METHODS.ONLINE) throw ApiError.unprocessable('Đơn hàng thanh toán khi nhận hàng (COD)', 'INVALID_PAYMENT');
    if (order.status !== ORDER_STATUS.PENDING) throw ApiError.unprocessable('Đơn hàng không còn chờ thanh toán', 'INVALID_STATUS');
    if (order.paymentStatus === ORDER_PAYMENT_STATUS.PAID) throw ApiError.conflict('Đơn hàng đã được thanh toán', 'ALREADY_PAID');

    const success = result === 'success';
    await prisma.$transaction(async (tx) => {
      const pending = order.payments.findLast((p) => p.status === PAYMENT_STATUS.PENDING);
      const data = {
        status: success ? PAYMENT_STATUS.SUCCESS : PAYMENT_STATUS.FAILED,
        transactionRef: `SANDBOX-${crypto.randomBytes(5).toString('hex').toUpperCase()}`,
        paidAt: success ? new Date() : null,
      };
      if (pending) await tx.payment.update({ where: { id: pending.id }, data });
      else await tx.payment.create({ data: { ...data, orderId: order.id, method: PAYMENT_METHODS.ONLINE, amount: order.total } });
      await tx.order.update({
        where: { id: order.id },
        data: { paymentStatus: success ? ORDER_PAYMENT_STATUS.PAID : ORDER_PAYMENT_STATUS.FAILED },
      });
    });
    return this.getForCustomer(customer.customerId, orderCode);
  },

  // ───────── Admin ─────────
  async listAdmin(query) {
    const paging = getPagination(query, 100);
    const where = {
      ...(query.status && { status: query.status }),
      ...(query.paymentMethod && { paymentMethod: query.paymentMethod }),
      ...((query.from || query.to) && { createdAt: { ...(query.from && { gte: query.from }), ...(query.to && { lte: query.to }) } }),
      ...(query.q && {
        OR: [
          { orderCode: { contains: query.q } },
          { receiverName: { contains: query.q } },
          { receiverPhone: { contains: query.q } },
          { customer: { account: { email: { contains: query.q } } } },
        ],
      }),
    };
    const { items, total } = await orderRepository.list(where, paging);
    return { items: items.map(toSummary), meta: buildMeta(paging, total) };
  },

  async getAdmin(id) {
    const order = await orderRepository.findDetail({ id });
    if (!order) throw ApiError.notFound('Không tìm thấy đơn hàng');
    const detail = toDetail(order);
    return { ...detail, nextStatuses: ORDER_TRANSITIONS[order.status] };
  },

  async changeStatus(id, { status, note }, actorId) {
    const order = await orderRepository.findDetail({ id });
    if (!order) throw ApiError.notFound('Không tìm thấy đơn hàng');
    if (!ORDER_TRANSITIONS[order.status].includes(status)) {
      throw ApiError.unprocessable(`Không thể chuyển đơn từ ${order.status} sang ${status}`, 'INVALID_TRANSITION');
    }

    if (status === ORDER_STATUS.CANCELLED) {
      await prisma.$transaction(async (tx) => {
        const fresh = await orderRepository.findForUpdate(id, tx);
        await cancelInTx(tx, fresh, { reason: note ?? 'Cửa hàng hủy đơn', actorId, allowed: [ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED] });
      }, TX_OPTIONS);
      return this.getAdmin(id);
    }

    // Đơn thanh toán online phải trả tiền xong mới được xác nhận
    if (status === ORDER_STATUS.CONFIRMED && order.paymentMethod === PAYMENT_METHODS.ONLINE && order.paymentStatus !== ORDER_PAYMENT_STATUS.PAID) {
      throw ApiError.unprocessable('Đơn thanh toán online chưa được thanh toán, chưa thể xác nhận', 'PAYMENT_REQUIRED');
    }

    await prisma.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({
        where: { id, status: order.status },
        data: {
          status,
          ...(status === ORDER_STATUS.DELIVERED && { deliveredAt: new Date(), paymentStatus: ORDER_PAYMENT_STATUS.PAID }),
        },
      });
      if (count === 0) throw ApiError.conflict('Đơn hàng vừa được cập nhật bởi người khác, vui lòng tải lại', 'STALE_ORDER');
      // COD: thu tiền khi giao thành công
      if (status === ORDER_STATUS.DELIVERED && order.paymentMethod === PAYMENT_METHODS.COD) {
        await tx.payment.updateMany({
          where: { orderId: id, status: PAYMENT_STATUS.PENDING },
          data: { status: PAYMENT_STATUS.SUCCESS, paidAt: new Date(), transactionRef: `COD-${order.orderCode}` },
        });
      }
      await tx.orderStatusHistory.create({ data: { orderId: id, fromStatus: order.status, toStatus: status, note: note ?? null, changedById: actorId } });
    });
    return this.getAdmin(id);
  },
};
