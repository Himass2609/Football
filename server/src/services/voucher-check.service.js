import { DISCOUNT_TYPES } from '../config/constants.js';
import { prisma } from '../lib/prisma.js';
import { orderRepository } from '../repositories/order.repository.js';
import { ApiError } from '../utils/api-error.js';

const invalid = (message) => ApiError.unprocessable(message, 'VOUCHER_INVALID', [{ field: 'voucherCode', message }]);

// Phần tiền trong giỏ thuộc phạm vi voucher
function eligibleAmount(voucher, lines) {
  if (voucher.scope === 'CATEGORY') {
    return lines
      .filter((l) => l.product.categoryId === voucher.categoryId || l.product.parentCategoryId === voucher.categoryId)
      .reduce((sum, l) => sum + l.lineTotal, 0);
  }
  if (voucher.scope === 'PRODUCT') {
    return lines.filter((l) => l.product.id === voucher.productId).reduce((sum, l) => sum + l.lineTotal, 0);
  }
  return lines.reduce((sum, l) => sum + l.lineTotal, 0);
}

/**
 * Kiểm tra voucher theo CLAUDE.md 5.8 và tính số tiền giảm.
 * Ném 422 VOUCHER_INVALID kèm lý do cụ thể để hiện dưới ô nhập mã.
 */
export async function evaluateVoucher(code, { customerId, lines, subtotal }, tx = prisma) {
  const voucher = await tx.voucher.findUnique({ where: { code } });
  const now = new Date();
  if (!voucher || !voucher.isActive) throw invalid('Mã giảm giá không tồn tại hoặc đã ngừng áp dụng');
  if (voucher.startAt > now) throw invalid('Mã giảm giá chưa đến thời gian áp dụng');
  if (voucher.endAt < now) throw invalid('Mã giảm giá đã hết hạn');
  if (voucher.usageLimit != null && voucher.usedCount >= voucher.usageLimit) throw invalid('Mã giảm giá đã hết lượt sử dụng');
  if (voucher.perUserLimit != null && (await orderRepository.countVoucherUses(customerId, voucher.id, tx)) >= voucher.perUserLimit) {
    throw invalid('Bạn đã dùng hết lượt của mã giảm giá này');
  }
  const minOrder = Number(voucher.minOrderValue);
  if (subtotal < minOrder) {
    throw invalid(`Đơn hàng tối thiểu ${minOrder.toLocaleString('vi-VN')}₫ để dùng mã này`);
  }
  const eligible = eligibleAmount(voucher, lines);
  if (eligible <= 0) throw invalid('Mã giảm giá không áp dụng cho sản phẩm trong giỏ');

  const value = Number(voucher.discountValue);
  let discount = voucher.discountType === DISCOUNT_TYPES.PERCENT ? Math.round((eligible * value) / 100) : value;
  if (voucher.maxDiscount != null) discount = Math.min(discount, Number(voucher.maxDiscount));
  discount = Math.min(discount, eligible);

  return { voucher, discount };
}
