// Biến thể (size × màu) và hình ảnh của sản phẩm
import { INVENTORY_REASONS, PRODUCT_STATUS } from '../config/constants.js';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../utils/api-error.js';
import { slugify } from '../utils/slugify.js';

async function getProduct(id) {
  const product = await prisma.product.findFirst({ where: { id, deletedAt: null }, select: { id: true, slug: true, status: true } });
  if (!product) throw ApiError.notFound('Không tìm thấy sản phẩm');
  return product;
}

async function getVariant(productId, variantId) {
  const variant = await prisma.productVariant.findFirst({ where: { id: variantId, productId } });
  if (!variant) throw ApiError.notFound('Không tìm thấy biến thể');
  return variant;
}

async function getImage(productId, imageId) {
  const image = await prisma.productImage.findFirst({ where: { id: imageId, productId } });
  if (!image) throw ApiError.notFound('Không tìm thấy ảnh');
  return image;
}

const skuOf = (productId, size, color) =>
  `JS${String(productId).padStart(4, '0')}-${size.name}-${slugify(color.name).toUpperCase().slice(0, 6) || color.id}`.slice(0, 60);

// Sản phẩm đang bán mà không còn biến thể hoạt động → tự chuyển về nháp để không hiện trống trên cửa hàng
async function demoteIfNoActiveVariant(productId, tx = prisma) {
  const active = await tx.productVariant.count({ where: { productId, isActive: true } });
  if (!active) await tx.product.updateMany({ where: { id: productId, status: PRODUCT_STATUS.ACTIVE }, data: { status: PRODUCT_STATUS.DRAFT } });
}

export const variantService = {
  /** Sinh tổ hợp Size × Màu còn thiếu; tổ hợp đã có thì bỏ qua */
  async generate(productId, { sizeIds, colorIds, stockQuantity, price }, actorId) {
    await getProduct(productId);
    const [sizes, colors, existing] = await Promise.all([
      prisma.size.findMany({ where: { id: { in: sizeIds } } }),
      prisma.color.findMany({ where: { id: { in: colorIds } } }),
      prisma.productVariant.findMany({ where: { productId }, select: { sizeId: true, colorId: true } }),
    ]);
    if (sizes.length !== new Set(sizeIds).size) throw ApiError.badRequest('Có size không tồn tại', 'INVALID_REFERENCE', [{ field: 'sizeIds', message: 'Có size không tồn tại' }]);
    if (colors.length !== new Set(colorIds).size) throw ApiError.badRequest('Có màu không tồn tại', 'INVALID_REFERENCE', [{ field: 'colorIds', message: 'Có màu không tồn tại' }]);

    const taken = new Set(existing.map((v) => `${v.sizeId}-${v.colorId}`));
    const combos = sizes.flatMap((size) => colors.map((color) => ({ size, color }))).filter(({ size, color }) => !taken.has(`${size.id}-${color.id}`));

    await prisma.$transaction(async (tx) => {
      for (const { size, color } of combos) {
        const variant = await tx.productVariant.create({
          data: { productId, sizeId: size.id, colorId: color.id, sku: skuOf(productId, size, color), stockQuantity, price: price ?? null },
        });
        if (stockQuantity > 0) {
          await tx.inventoryLog.create({
            data: { variantId: variant.id, change: stockQuantity, stockAfter: stockQuantity, reason: INVENTORY_REASONS.IMPORT, note: 'Tồn kho ban đầu', createdById: actorId },
          });
        }
      }
    });
    return { created: combos.length, skipped: sizes.length * colors.length - combos.length };
  },

  async update(productId, variantId, data) {
    await getProduct(productId);
    await getVariant(productId, variantId);
    const variant = await prisma.productVariant.update({ where: { id: variantId }, data });
    if (data.isActive === false) await demoteIfNoActiveVariant(productId);
    return variant;
  },

  // Biến thể đã nằm trong đơn/giỏ hàng thì không xóa được, chỉ ngừng bán
  async remove(productId, variantId) {
    await getVariant(productId, variantId);
    const [orders, carts] = await Promise.all([
      prisma.orderDetail.count({ where: { variantId } }),
      prisma.cartItem.count({ where: { variantId } }),
    ]);
    if (orders || carts) {
      throw ApiError.conflict('Biến thể đã có trong đơn hàng hoặc giỏ hàng, không thể xóa. Hãy tắt "Đang bán" thay vì xóa.', 'IN_USE');
    }
    await prisma.$transaction(async (tx) => {
      await tx.inventoryLog.deleteMany({ where: { variantId } });
      await tx.productVariant.delete({ where: { id: variantId } });
      await demoteIfNoActiveVariant(productId, tx);
    });
  },
};

export const imageService = {
  async add(productId, images) {
    await getProduct(productId);
    const [last, hasPrimary] = await Promise.all([
      prisma.productImage.findFirst({ where: { productId }, orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } }),
      prisma.productImage.count({ where: { productId, isPrimary: true } }),
    ]);
    const start = (last?.sortOrder ?? -1) + 1;
    await prisma.productImage.createMany({
      data: images.map((img, i) => ({ productId, url: img.url, alt: img.alt ?? null, colorId: img.colorId ?? null, sortOrder: start + i, isPrimary: !hasPrimary && i === 0 })),
    });
    return this.list(productId);
  },

  list: (productId) => prisma.productImage.findMany({ where: { productId }, orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] }),

  async update(productId, imageId, { isPrimary, ...data }) {
    await getImage(productId, imageId);
    await prisma.$transaction([
      ...(isPrimary ? [prisma.productImage.updateMany({ where: { productId }, data: { isPrimary: false } })] : []),
      prisma.productImage.update({ where: { id: imageId }, data: { ...data, ...(isPrimary && { isPrimary: true }) } }),
    ]);
    return this.list(productId);
  },

  async reorder(productId, imageIds) {
    const images = await prisma.productImage.findMany({ where: { productId }, select: { id: true } });
    const own = new Set(images.map((i) => i.id));
    if (imageIds.length !== own.size || imageIds.some((id) => !own.has(id))) {
      throw ApiError.badRequest('Danh sách ảnh không khớp với sản phẩm', 'INVALID_ORDER');
    }
    await prisma.$transaction(imageIds.map((id, sortOrder) => prisma.productImage.update({ where: { id }, data: { sortOrder } })));
    return this.list(productId);
  },

  async remove(productId, imageId) {
    const image = await getImage(productId, imageId);
    await prisma.productImage.delete({ where: { id: imageId } });
    // Xóa ảnh chính → ảnh kế tiếp thành ảnh chính
    if (image.isPrimary) {
      const next = await prisma.productImage.findFirst({ where: { productId }, orderBy: { sortOrder: 'asc' } });
      if (next) await prisma.productImage.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
    return this.list(productId);
  },
};
