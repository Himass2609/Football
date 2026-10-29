import { prisma } from '../lib/prisma.js';
import { createCrudRepository } from '../repositories/crud.repository.js';
import { ApiError } from '../utils/api-error.js';
import { buildMeta, getPagination } from '../utils/pagination.js';
import { slugify } from '../utils/slugify.js';

/**
 * Cấu hình các bảng dữ liệu nền.
 * relations: các quan hệ dùng để đếm mức độ sử dụng → chặn xóa cứng khi đang được tham chiếu.
 */
export const MASTER_ENTITIES = {
  categories: {
    model: 'category',
    label: 'danh mục',
    slug: true,
    relations: ['products', 'children', 'vouchers', 'promotions'],
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { parent: { select: { id: true, name: true } } },
    references: { parentId: { model: 'category', label: 'Danh mục cha' } },
  },
  brands: { model: 'brand', label: 'thương hiệu', slug: true, relations: ['products'], orderBy: { name: 'asc' } },
  leagues: { model: 'league', label: 'giải đấu', slug: true, relations: ['teams'], orderBy: { name: 'asc' } },
  teams: {
    model: 'team',
    label: 'đội bóng',
    slug: true,
    relations: ['products', 'promotions'],
    orderBy: [{ isFeatured: 'desc' }, { name: 'asc' }],
    include: { league: { select: { id: true, name: true, slug: true } } },
    references: { leagueId: { model: 'league', label: 'Giải đấu' } },
    publicFilters: (query) => ({
      ...(query.type && { type: query.type }),
      ...(query.featured === 'true' && { isFeatured: true }),
      ...(query.league && { league: { slug: query.league } }),
    }),
  },
  'product-types': { model: 'productType', label: 'loại sản phẩm', slug: true, relations: ['products'], orderBy: { name: 'asc' } },
  sizes: {
    model: 'size',
    label: 'kích thước',
    relations: ['variants'],
    orderBy: [{ sizeType: 'asc' }, { sortOrder: 'asc' }],
    publicFilters: (query) => (query.sizeType ? { sizeType: query.sizeType } : {}),
  },
  colors: { model: 'color', label: 'màu sắc', relations: ['variants', 'images'], orderBy: { name: 'asc' } },
  'news-categories': { model: 'newsCategory', label: 'chuyên mục tin', slug: true, relations: ['news'], orderBy: { name: 'asc' } },
};

const countSelect = (relations) => ({ _count: { select: Object.fromEntries(relations.map((r) => [r, true])) } });

const withUsage = ({ _count, ...item }) => ({
  ...item,
  usageCount: Object.values(_count ?? {}).reduce((sum, n) => sum + n, 0),
});

function getConfig(entity) {
  const config = MASTER_ENTITIES[entity];
  if (!config) throw ApiError.notFound('Loại dữ liệu không tồn tại');
  return config;
}

async function assertReferences(config, data, selfId) {
  for (const [field, ref] of Object.entries(config.references ?? {})) {
    const refId = data[field];
    if (refId == null) continue;
    if (field === 'parentId' && refId === selfId) {
      throw ApiError.badRequest('Danh mục cha không hợp lệ', 'INVALID_PARENT', [{ field, message: 'Không thể chọn chính nó' }]);
    }
    const exists = await prisma[ref.model].count({ where: { id: refId } });
    if (!exists) throw ApiError.badRequest(`${ref.label} không tồn tại`, 'INVALID_REFERENCE', [{ field, message: `${ref.label} không tồn tại` }]);
  }
  // Chặn vòng lặp cây danh mục: cha mới không được là con/cháu của chính nó
  if (config.model === 'category' && data.parentId && selfId) {
    let cursor = data.parentId;
    while (cursor) {
      if (cursor === selfId) {
        throw ApiError.badRequest('Danh mục cha không hợp lệ', 'INVALID_PARENT', [{ field: 'parentId', message: 'Không thể chọn danh mục con làm cha' }]);
      }
      cursor = (await prisma.category.findUnique({ where: { id: cursor }, select: { parentId: true } }))?.parentId;
    }
  }
}

// Báo trùng theo trường cụ thể (size duy nhất theo cặp tên + loại size)
async function assertUnique(config, data, current) {
  const merged = { ...current, ...data };
  if (data.name === undefined && data.sizeType === undefined) return;
  const where = config.model === 'size' ? { name: merged.name, sizeType: merged.sizeType ?? 'ADULT' } : { name: merged.name };
  const slugWhere = config.slug ? [{ slug: slugify(merged.name) }] : [];
  const duplicate = await prisma[config.model].findFirst({
    where: { OR: [where, ...slugWhere], ...(current && { id: { not: current.id } }) },
    select: { id: true },
  });
  if (duplicate) {
    throw ApiError.conflict(`Tên ${config.label} đã tồn tại`, 'DUPLICATE', [{ field: 'name', message: `Tên ${config.label} đã tồn tại` }]);
  }
}

const withSlug = (config, data) => (config.slug && data.name ? { ...data, slug: slugify(data.name) } : data);

export const masterDataService = {
  async listAdmin(entity, query) {
    const config = getConfig(entity);
    const repo = createCrudRepository(config.model);
    const pagination = getPagination(query, 200);
    const where = {
      ...(query.q && { name: { contains: query.q } }),
      ...(query.isActive !== undefined && { isActive: query.isActive }),
    };
    const { items, total } = await repo.list({
      where,
      skip: pagination.skip,
      take: pagination.take,
      orderBy: config.orderBy,
      include: { ...config.include, ...countSelect(config.relations) },
    });
    return { items: items.map(withUsage), meta: buildMeta(pagination, total) };
  },

  async listPublic(entity, query = {}) {
    const config = getConfig(entity);
    return createCrudRepository(config.model).findMany({
      where: { isActive: true, ...config.publicFilters?.(query) },
      orderBy: config.orderBy,
      include: config.include,
    });
  },

  async getById(entity, id) {
    const config = getConfig(entity);
    const item = await createCrudRepository(config.model).findById(id, {
      include: { ...config.include, ...countSelect(config.relations) },
    });
    if (!item) throw ApiError.notFound(`Không tìm thấy ${config.label}`);
    return withUsage(item);
  },

  async create(entity, data) {
    const config = getConfig(entity);
    await assertUnique(config, data);
    await assertReferences(config, data);
    const item = await createCrudRepository(config.model).create(withSlug(config, data));
    return this.getById(entity, item.id);
  },

  async update(entity, id, data) {
    const config = getConfig(entity);
    const current = await this.getById(entity, id);
    await assertUnique(config, data, current);
    await assertReferences(config, data, id);
    await createCrudRepository(config.model).update(id, withSlug(config, data));
    return this.getById(entity, id);
  },

  async remove(entity, id) {
    const config = getConfig(entity);
    const item = await this.getById(entity, id);
    if (item.usageCount > 0) {
      throw ApiError.conflict(
        `Không thể xóa ${config.label} đang được sử dụng (${item.usageCount} liên kết). Hãy chuyển sang trạng thái ngừng hoạt động.`,
        'IN_USE',
      );
    }
    await createCrudRepository(config.model).remove(id);
  },
};
