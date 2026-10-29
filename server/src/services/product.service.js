import { PRODUCT_STATUS } from '../config/constants.js';
import { prisma } from '../lib/prisma.js';
import { cardInclude, productRepository } from '../repositories/product.repository.js';
import { ApiError } from '../utils/api-error.js';
import { buildMeta, getPagination } from '../utils/pagination.js';
import { slugify } from '../utils/slugify.js';
import { getRunningPromotions, priceFor } from './pricing.service.js';

const NEW_DAYS = 30;
const REFERENCES = {
  categoryId: { model: 'category', label: 'Danh mục' },
  brandId: { model: 'brand', label: 'Thương hiệu' },
  teamId: { model: 'team', label: 'Đội bóng' },
  productTypeId: { model: 'productType', label: 'Loại sản phẩm' },
};

const uniqueBy = (list, key) => [...new Map(list.map((item) => [item[key], item])).values()];

// ───────── DTO ─────────
function toCard(product, promotions) {
  const pricing = priceFor(product, promotions);
  const variants = product.variants ?? [];
  const sizes = uniqueBy(variants.map((v) => v.size), 'id').sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    season: product.season,
    isFeatured: product.isFeatured,
    isNew: Date.now() - new Date(product.createdAt).getTime() < NEW_DAYS * 864e5,
    category: product.category && { name: product.category.name, slug: product.category.slug },
    brand: product.brand && { name: product.brand.name, slug: product.brand.slug },
    team: product.team,
    image: product.images?.[0]?.url ?? null,
    hoverImage: product.images?.[1]?.url ?? null,
    ...pricing,
    colors: uniqueBy(variants.map((v) => v.color), 'id'),
    sizes: sizes.map((s) => s.name),
    inStock: variants.some((v) => v.stockQuantity > 0),
    ratingAvg: product.ratingAvg,
    ratingCount: product.ratingCount,
  };
}

function toAdminRow(product) {
  const totalStock = product.variants.reduce((sum, v) => sum + v.stockQuantity, 0);
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    status: product.status,
    season: product.season,
    isFeatured: product.isFeatured,
    basePrice: product.basePrice,
    salePrice: product.salePrice,
    category: product.category,
    brand: product.brand,
    team: product.team,
    image: product.images[0]?.url ?? null,
    variantCount: product.variants.length,
    activeVariantCount: product.variants.filter((v) => v.isActive).length,
    totalStock,
    soldCount: product.soldCount,
    updatedAt: product.updatedAt,
  };
}

// ───────── Bộ lọc công khai ─────────
function publicWhere(query) {
  const variantFilter = {
    isActive: true,
    ...(query.sizes?.length && { sizeId: { in: query.sizes } }),
    ...(query.colors?.length && { colorId: { in: query.colors } }),
    ...(query.inStock && { stockQuantity: { gt: 0 } }),
  };
  const needsVariant = query.sizes?.length || query.colors?.length || query.inStock;

  // Gom vào AND để các điều kiện cùng quan hệ (team / league) không ghi đè nhau
  const and = [
    query.category && { OR: [{ category: { slug: query.category } }, { category: { parent: { slug: query.category } } }] },
    query.team && { team: { slug: query.team } },
    query.league && { team: { league: { slug: query.league } } },
    query.brand && { brand: { slug: query.brand } },
    query.type && { productType: { slug: query.type } },
    query.gender && { gender: query.gender },
    query.featured && { isFeatured: true },
    query.q && { OR: [{ name: { contains: query.q } }, { team: { name: { contains: query.q } } }, { playerName: { contains: query.q } }] },
  ].filter(Boolean);

  return {
    deletedAt: null,
    status: PRODUCT_STATUS.ACTIVE,
    // Chỉ hiện sản phẩm có ít nhất một biến thể đang bán
    variants: { some: needsVariant ? variantFilter : { isActive: true } },
    ...(and.length && { AND: and }),
  };
}

const SORTERS = {
  newest: (a, b) => b.createdAt - a.createdAt,
  price_asc: (a, b) => a.price - b.price || b.createdAt - a.createdAt,
  price_desc: (a, b) => b.price - a.price || b.createdAt - a.createdAt,
  best_selling: (a, b) => b.soldCount - a.soldCount || b.createdAt - a.createdAt,
  name_asc: (a, b) => a.name.localeCompare(b.name, 'vi'),
};

async function uniqueSlug(name, season, excludeId) {
  // Thêm mùa giải vào slug nếu tên chưa có (tránh "…-2026-27-2026-27")
  const withSeason = season && !name.includes(season) ? `${name} ${season.replace('/', '-')}` : name;
  const base = slugify(withSeason).slice(0, 170) || 'san-pham';
  let slug = base;
  for (let i = 2; await productRepository.slugExists(slug, excludeId); i += 1) slug = `${base}-${i}`;
  return slug;
}

async function assertReferences(data) {
  for (const [field, ref] of Object.entries(REFERENCES)) {
    if (data[field] == null) continue;
    if (!(await prisma[ref.model].count({ where: { id: data[field] } }))) {
      throw ApiError.badRequest(`${ref.label} không tồn tại`, 'INVALID_REFERENCE', [{ field, message: `${ref.label} không tồn tại` }]);
    }
  }
}

async function getOrThrow(id) {
  const product = await productRepository.findDetail(id);
  if (!product) throw ApiError.notFound('Không tìm thấy sản phẩm');
  return product;
}

export const productService = {
  /**
   * Lọc ở DB, còn giá (gồm khuyến mãi) tính ở ứng dụng nên lọc giá + sắp xếp + phân trang làm sau khi tính giá.
   * Phù hợp quy mô catalog vài nghìn sản phẩm; lớn hơn nên lưu sẵn giá hiệu lực vào DB.
   */
  async listPublic(query) {
    const pagination = getPagination(query, 48);
    const promotions = await getRunningPromotions();
    const rows = (await productRepository.findLight(publicWhere(query)))
      .map((p) => {
        const { price, discountPercent } = priceFor(p, promotions);
        return { ...p, price, onSale: discountPercent > 0 };
      })
      .filter((p) => (query.minPrice == null || p.price >= query.minPrice) && (query.maxPrice == null || p.price <= query.maxPrice))
      .filter((p) => !query.onSale || p.onSale)
      .sort(SORTERS[query.sort ?? 'newest']);

    const pageIds = rows.slice(pagination.skip, pagination.skip + pagination.take).map((p) => p.id);
    const products = await productRepository.findByIds(pageIds);
    const byId = new Map(products.map((p) => [p.id, p]));
    const items = pageIds.map((id) => toCard(byId.get(id), promotions));

    const prices = rows.map((p) => p.price);
    return {
      items,
      meta: {
        ...buildMeta(pagination, rows.length),
        priceRange: prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
      },
    };
  },

  async getPublicBySlug(slug) {
    const product = await productRepository.findBySlug(slug, { status: PRODUCT_STATUS.ACTIVE });
    if (!product) throw ApiError.notFound('Sản phẩm không tồn tại hoặc đã ngừng bán');
    const promotions = await getRunningPromotions();

    const variants = product.variants
      .filter((v) => v.isActive)
      .map((v) => ({
        id: v.id,
        sku: v.sku,
        size: v.size,
        color: v.color,
        stockQuantity: v.stockQuantity,
        ...priceFor(product, promotions, v.price),
      }));

    const related = await prisma.product.findMany({
      where: {
        id: { not: product.id },
        deletedAt: null,
        status: PRODUCT_STATUS.ACTIVE,
        variants: { some: { isActive: true } },
        OR: [...(product.teamId ? [{ teamId: product.teamId }] : []), { categoryId: product.categoryId }],
      },
      include: cardInclude,
      orderBy: [{ soldCount: 'desc' }, { createdAt: 'desc' }],
      take: 4,
    });

    const { variants: _all, basePrice, salePrice, status, deletedAt, ...rest } = product;
    return {
      ...rest,
      ...priceFor(product, promotions),
      colors: uniqueBy(variants.map((v) => v.color), 'id'),
      sizes: uniqueBy(variants.map((v) => v.size), 'id').sort((a, b) => a.sortOrder - b.sortOrder),
      variants,
      inStock: variants.some((v) => v.stockQuantity > 0),
      related: related.map((p) => toCard(p, promotions)),
    };
  },

  // ───────── Admin ─────────
  async listAdmin(query) {
    const pagination = getPagination(query);
    const where = {
      deletedAt: null,
      ...(query.status && { status: query.status }),
      ...(query.categoryId && { categoryId: query.categoryId }),
      ...(query.teamId && { teamId: query.teamId }),
      ...(query.brandId && { brandId: query.brandId }),
      ...(query.q && { OR: [{ name: { contains: query.q } }, { slug: { contains: query.q } }] }),
    };
    const { items, total } = await productRepository.listAdmin({ where, skip: pagination.skip, take: pagination.take });
    return { items: items.map(toAdminRow), meta: buildMeta(pagination, total) };
  },

  async getAdmin(id) {
    const product = await getOrThrow(id);
    const promotions = await getRunningPromotions();
    return { ...product, pricing: priceFor(product, promotions) };
  },

  async create(data) {
    await assertReferences(data);
    // Sản phẩm mới luôn là bản nháp cho tới khi có biến thể
    const product = await productRepository.create({
      ...data,
      status: PRODUCT_STATUS.DRAFT,
      slug: await uniqueSlug(data.name, data.season),
    });
    return this.getAdmin(product.id);
  },

  async update(id, data) {
    const current = await getOrThrow(id);
    await assertReferences(data);
    const merged = { ...current, ...data };
    if (merged.salePrice != null && Number(merged.salePrice) >= Number(merged.basePrice)) {
      throw ApiError.badRequest('Giá khuyến mãi phải nhỏ hơn giá bán', 'VALIDATION_ERROR', [{ field: 'salePrice', message: 'Giá khuyến mãi phải nhỏ hơn giá bán' }]);
    }
    const { status, ...changes } = data;
    if (status) await this.assertCanChangeStatus(current, status);
    const renamed = (data.name && data.name !== current.name) || (data.season !== undefined && data.season !== current.season);
    await productRepository.update(id, {
      ...changes,
      ...(status && { status }),
      ...(renamed && { slug: await uniqueSlug(merged.name, merged.season, id) }),
    });
    return this.getAdmin(id);
  },

  async assertCanChangeStatus(product, status) {
    if (status === PRODUCT_STATUS.ACTIVE && !product.variants.some((v) => v.isActive)) {
      throw ApiError.unprocessable('Cần ít nhất một biến thể đang bán (size + màu) trước khi mở bán sản phẩm', 'NO_ACTIVE_VARIANT');
    }
  },

  async setStatus(id, status) {
    const product = await getOrThrow(id);
    await this.assertCanChangeStatus(product, status);
    await productRepository.update(id, { status });
    return this.getAdmin(id);
  },

  // Xóa mềm: giữ lịch sử đơn hàng, ẩn khỏi cửa hàng
  async remove(id) {
    await getOrThrow(id);
    await productRepository.update(id, { deletedAt: new Date(), status: PRODUCT_STATUS.INACTIVE, isFeatured: false });
  },
};
