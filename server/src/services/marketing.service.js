import { prisma } from '../lib/prisma.js';
import { createCrudRepository } from '../repositories/crud.repository.js';
import { ApiError } from '../utils/api-error.js';
import { buildMeta, getPagination } from '../utils/pagination.js';
import { slugify } from '../utils/slugify.js';
import { discountRules } from '../validators/marketing.validator.js';
import { invalidatePromotionCache } from './pricing.service.js';

const TARGETS = {
  categoryId: { model: 'category', label: 'Danh mục', scope: 'CATEGORY' },
  teamId: { model: 'team', label: 'Đội bóng', scope: 'TEAM' },
  productId: { model: 'product', label: 'Sản phẩm', scope: 'PRODUCT' },
};

const targetInclude = {
  category: { select: { id: true, name: true, slug: true } },
  product: { select: { id: true, name: true, slug: true } },
};

const stateWhere = (state, now = new Date()) =>
  ({
    running: { isActive: true, startAt: { lte: now }, endAt: { gte: now } },
    upcoming: { startAt: { gt: now } },
    expired: { endAt: { lt: now } },
  })[state] ?? {};

// Kiểm tra lại quy tắc trên bản ghi đã gộp (khi cập nhật từng phần) và dọn các khóa không thuộc scope
async function normalizeTargets(data, allowedTargets) {
  const issues = [];
  discountRules(data, { addIssue: (issue) => issues.push({ field: issue.path[0], message: issue.message }) });
  if (issues.length) throw ApiError.badRequest(issues[0].message, 'VALIDATION_ERROR', issues);

  const result = { ...data };
  for (const field of allowedTargets) {
    const target = TARGETS[field];
    if (data.scope !== target.scope) {
      result[field] = null;
      continue;
    }
    if (!(await prisma[target.model].count({ where: { id: data[field] } }))) {
      throw ApiError.badRequest(`${target.label} không tồn tại`, 'INVALID_REFERENCE', [{ field, message: `${target.label} không tồn tại` }]);
    }
  }
  return result;
}

function createMarketingService({ model, label, targets, include, searchField, beforeSave = (d) => d, assertDeletable, afterChange = () => {} }) {
  const repo = createCrudRepository(model);

  const getOrThrow = async (id) => {
    const item = await repo.findById(id, { include });
    if (!item) throw ApiError.notFound(`Không tìm thấy ${label}`);
    return item;
  };

  const pick = (record) => Object.fromEntries(Object.entries(record).filter(([key]) => !(key in include) && !['id', 'createdAt', 'updatedAt'].includes(key)));

  return {
    async list(query) {
      const pagination = getPagination(query);
      const where = {
        ...stateWhere(query.state),
        ...(query.isActive !== undefined && { isActive: query.isActive }),
        ...(query.q && { [searchField]: { contains: query.q } }),
      };
      const { items, total } = await repo.list({ where, include, skip: pagination.skip, take: pagination.take, orderBy: { createdAt: 'desc' } });
      return { items, meta: buildMeta(pagination, total) };
    },

    getById: getOrThrow,

    async create(data) {
      const normalized = await normalizeTargets(data, targets);
      const created = await repo.create(await beforeSave(normalized));
      afterChange();
      return getOrThrow(created.id);
    },

    async update(id, data) {
      const current = await getOrThrow(id);
      const normalized = await normalizeTargets({ ...pick(current), ...data }, targets);
      // Chỉ ghi các trường được gửi lên + khóa đối tượng đã chuẩn hóa (không ghi đè usedCount...)
      const changes = { ...data, ...Object.fromEntries(targets.map((field) => [field, normalized[field]])) };
      await repo.update(id, await beforeSave(changes, current));
      afterChange();
      return getOrThrow(id);
    },

    async remove(id) {
      const item = await getOrThrow(id);
      await assertDeletable?.(item);
      await repo.remove(id);
      afterChange();
    },

    listRunning: (extraWhere = {}) =>
      repo.findMany({ where: { ...stateWhere('running'), ...extraWhere }, include, orderBy: { endAt: 'asc' } }),
  };
}

async function uniquePromotionSlug(name, excludeId) {
  const base = slugify(name) || 'khuyen-mai';
  let slug = base;
  for (let i = 2; await prisma.promotion.count({ where: { slug, ...(excludeId && { id: { not: excludeId } }) } }); i += 1) {
    slug = `${base}-${i}`;
  }
  return slug;
}

export const promotionService = createMarketingService({
  model: 'promotion',
  label: 'chương trình khuyến mãi',
  targets: ['categoryId', 'teamId', 'productId'],
  include: { ...targetInclude, team: { select: { id: true, name: true, slug: true } } },
  searchField: 'name',
  afterChange: invalidatePromotionCache,
  beforeSave: async (data, current) =>
    data.name && data.name !== current?.name ? { ...data, slug: await uniquePromotionSlug(data.name, current?.id) } : data,
});

export const voucherService = createMarketingService({
  model: 'voucher',
  label: 'voucher',
  targets: ['categoryId', 'productId'],
  include: targetInclude,
  searchField: 'code',
  beforeSave: async (data, current) => {
    if (data.code && data.code !== current?.code && (await prisma.voucher.count({ where: { code: data.code } }))) {
      throw ApiError.conflict('Mã voucher đã tồn tại', 'DUPLICATE', [{ field: 'code', message: 'Mã voucher đã tồn tại' }]);
    }
    return data;
  },
  assertDeletable: async (voucher) => {
    const orderCount = await prisma.order.count({ where: { voucherId: voucher.id } });
    if (voucher.usedCount > 0 || orderCount > 0) {
      throw ApiError.conflict('Voucher đã được sử dụng, không thể xóa. Hãy tắt kích hoạt thay vì xóa.', 'IN_USE');
    }
  },
});

// Voucher công khai: đang chạy và còn lượt
export async function listPublicVouchers() {
  const vouchers = await voucherService.listRunning();
  return vouchers
    .filter((v) => v.usageLimit == null || v.usedCount < v.usageLimit)
    .map(({ usedCount, usageLimit, perUserLimit, isActive, createdAt, updatedAt, ...v }) => ({
      ...v,
      remaining: usageLimit == null ? null : usageLimit - usedCount,
    }));
}
