import { DISCOUNT_TYPES } from '../config/constants.js';
import { prisma } from '../lib/prisma.js';

// Khuyến mãi đang chạy thay đổi ít → cache ngắn để không truy vấn lại cho mỗi sản phẩm
const CACHE_MS = 30 * 1000;
let cache = { at: 0, promotions: [] };

export async function getRunningPromotions() {
  if (Date.now() - cache.at < CACHE_MS) return cache.promotions;
  const now = new Date();
  const promotions = await prisma.promotion.findMany({
    where: { isActive: true, startAt: { lte: now }, endAt: { gte: now } },
    select: { id: true, name: true, slug: true, discountType: true, discountValue: true, scope: true, categoryId: true, teamId: true, productId: true, endAt: true },
  });
  cache = { at: Date.now(), promotions: promotions.map((p) => ({ ...p, discountValue: Number(p.discountValue) })) };
  return cache.promotions;
}

export const invalidatePromotionCache = () => {
  cache.at = 0;
};

const appliesTo = (promotion, product) =>
  promotion.scope === 'ALL' ||
  (promotion.scope === 'CATEGORY' && (promotion.categoryId === product.categoryId || promotion.categoryId === product.category?.parentId)) ||
  (promotion.scope === 'TEAM' && promotion.teamId === product.teamId) ||
  (promotion.scope === 'PRODUCT' && promotion.productId === product.id);

// Làm tròn đến nghìn đồng cho giá hiển thị gọn (vd 382.500 → 383.000)
const roundVnd = (value) => Math.max(0, Math.round(value / 1000) * 1000);

function applyDiscount(price, promotion) {
  return promotion.discountType === DISCOUNT_TYPES.PERCENT
    ? roundVnd(price * (1 - promotion.discountValue / 100))
    : Math.max(0, price - promotion.discountValue);
}

/**
 * Giá cuối cùng của một sản phẩm (hoặc một biến thể nếu có giá riêng).
 * Thứ tự: giá niêm yết = giá biến thể ?? giá gốc; giá hiện tại = giá biến thể ?? giá sale ?? giá gốc;
 * sau đó áp khuyến mãi có lợi nhất cho khách. Không cộng dồn nhiều khuyến mãi.
 */
export function priceFor(product, promotions, variantPrice = null) {
  const listPrice = Number(variantPrice ?? product.basePrice);
  const current = Number(variantPrice ?? product.salePrice ?? product.basePrice);

  let best = null;
  let price = current;
  for (const promotion of promotions) {
    if (!appliesTo(promotion, product)) continue;
    const discounted = applyDiscount(current, promotion);
    if (discounted < price) {
      price = discounted;
      best = promotion;
    }
  }

  return {
    price,
    originalPrice: listPrice,
    discountPercent: price < listPrice ? Math.round((1 - price / listPrice) * 100) : 0,
    promotion: best && { id: best.id, name: best.name, slug: best.slug, endAt: best.endAt },
  };
}
