import { MAX_CART_QTY, PRODUCT_STATUS } from '../config/constants.js';
import { cartRepository } from '../repositories/cart.repository.js';
import { ApiError } from '../utils/api-error.js';
import { getRunningPromotions, priceFor } from './pricing.service.js';

// Lý do một dòng giỏ không mua được
export const LINE_ISSUES = Object.freeze({
  UNAVAILABLE: 'Sản phẩm đã ngừng bán',
  OUT_OF_STOCK: 'Đã hết hàng',
  INSUFFICIENT_STOCK: 'Không đủ số lượng trong kho',
});

const isSellable = (variant) =>
  variant.isActive && variant.product.status === PRODUCT_STATUS.ACTIVE && !variant.product.deletedAt;

function lineIssue(variant, quantity) {
  if (!isSellable(variant)) return 'UNAVAILABLE';
  if (variant.stockQuantity <= 0) return 'OUT_OF_STOCK';
  if (variant.stockQuantity < quantity) return 'INSUFFICIENT_STOCK';
  return null;
}

/** Dòng giỏ / dòng đặt hàng với giá tính tại server */
export function buildLine(variant, quantity, promotions, id = null) {
  const { product } = variant;
  const pricing = priceFor(product, promotions, variant.price);
  const image = product.images.find((img) => img.colorId === variant.color.id) ?? product.images[0];
  const issue = lineIssue(variant, quantity);
  return {
    id,
    variantId: variant.id,
    sku: variant.sku,
    quantity,
    product: { id: product.id, name: product.name, slug: product.slug, categoryId: product.categoryId, parentCategoryId: product.category?.parentId ?? null, teamName: product.team?.name ?? null },
    size: variant.size,
    color: variant.color,
    image: image?.url ?? null,
    unitPrice: pricing.price,
    originalPrice: pricing.originalPrice,
    lineTotal: pricing.price * quantity,
    stock: variant.stockQuantity,
    issue,
    issueMessage: issue ? LINE_ISSUES[issue] : null,
  };
}

export async function loadCartLines(customerId, tx) {
  const cart = await cartRepository.ensure(customerId, tx);
  const [items, promotions] = await Promise.all([cartRepository.items(cart.id, tx), getRunningPromotions()]);
  return { cart, lines: items.map((item) => buildLine(item.variant, item.quantity, promotions, item.id)) };
}

const summarize = (lines) => {
  const valid = lines.filter((l) => !l.issue);
  return {
    items: lines,
    itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
    subtotal: valid.reduce((sum, l) => sum + l.lineTotal, 0),
    hasIssues: valid.length !== lines.length,
  };
};

function assertCanBuy(variant, quantity) {
  if (!variant || !isSellable(variant)) throw ApiError.unprocessable('Sản phẩm này hiện không còn bán', 'PRODUCT_UNAVAILABLE');
  if (quantity > MAX_CART_QTY) {
    throw ApiError.unprocessable(`Mỗi sản phẩm mua tối đa ${MAX_CART_QTY} chiếc`, 'MAX_QUANTITY');
  }
  if (variant.stockQuantity <= 0) throw ApiError.conflict('Phân loại này đã hết hàng', 'OUT_OF_STOCK');
  if (variant.stockQuantity < quantity) {
    throw ApiError.conflict(`Chỉ còn ${variant.stockQuantity} sản phẩm trong kho`, 'INSUFFICIENT_STOCK', [{ field: 'quantity', message: `Tối đa ${variant.stockQuantity}` }]);
  }
}

export const cartService = {
  async get(customerId) {
    const { lines } = await loadCartLines(customerId);
    return summarize(lines);
  },

  // Thêm vào giỏ: cộng dồn với số lượng đã có, kiểm tra tồn kho (CLAUDE.md 5.2)
  async add(customerId, { variantId, quantity }) {
    const [cart, variant] = await Promise.all([cartRepository.ensure(customerId), cartRepository.findVariant(variantId)]);
    const existing = await cartRepository.findItem(cart.id, variantId);
    assertCanBuy(variant, (existing?.quantity ?? 0) + quantity);
    await cartRepository.upsertItem(cart.id, variantId, (existing?.quantity ?? 0) + quantity);
    return this.get(customerId);
  },

  async update(customerId, itemId, { quantity }) {
    const cart = await cartRepository.ensure(customerId);
    const item = await cartRepository.findOwnedItem(cart.id, itemId);
    if (!item) throw ApiError.notFound('Sản phẩm không có trong giỏ');
    assertCanBuy(item.variant, quantity);
    await cartRepository.updateItem(itemId, quantity);
    return this.get(customerId);
  },

  async remove(customerId, itemId) {
    const cart = await cartRepository.ensure(customerId);
    const item = await cartRepository.findOwnedItem(cart.id, itemId);
    if (!item) throw ApiError.notFound('Sản phẩm không có trong giỏ');
    await cartRepository.removeItem(itemId);
    return this.get(customerId);
  },
};
