import { NEWS_STATUS, NEWS_TRANSITIONS } from '../config/constants.js';
import { prisma } from '../lib/prisma.js';
import { newsRepository } from '../repositories/news.repository.js';
import { ApiError } from '../utils/api-error.js';
import { buildMeta, getPagination } from '../utils/pagination.js';
import { slugify } from '../utils/slugify.js';

const STATUS_LABEL = { DRAFT: 'Bản nháp', PUBLISHED: 'Đã xuất bản', ARCHIVED: 'Lưu trữ' };

const toNews = ({ categories, author, ...news }) => ({
  ...news,
  categories: categories.map((c) => c.category),
  authorName: author?.customer?.fullName ?? null,
});

const publishedWhere = () => ({ deletedAt: null, status: NEWS_STATUS.PUBLISHED, publishedAt: { lte: new Date() } });

async function uniqueSlug(title, excludeId) {
  const base = slugify(title).slice(0, 200) || 'tin-tuc';
  let slug = base;
  for (let i = 2; await newsRepository.slugExists(slug, excludeId); i += 1) slug = `${base}-${i}`;
  return slug;
}

async function assertCategories(categoryIds) {
  if (!categoryIds?.length) return;
  const found = await prisma.newsCategory.count({ where: { id: { in: categoryIds } } });
  if (found !== new Set(categoryIds).size) {
    throw ApiError.badRequest('Chuyên mục không tồn tại', 'INVALID_REFERENCE', [{ field: 'categoryIds', message: 'Có chuyên mục không tồn tại' }]);
  }
}

async function getOrThrow(id) {
  const news = await newsRepository.findById(id);
  if (!news) throw ApiError.notFound('Không tìm thấy bài viết');
  return news;
}

export const newsService = {
  async listAdmin(query) {
    const pagination = getPagination(query);
    const where = {
      deletedAt: null,
      ...(query.status && { status: query.status }),
      ...(query.categoryId && { categories: { some: { categoryId: query.categoryId } } }),
      ...(query.q && { title: { contains: query.q } }),
    };
    const { items, total } = await newsRepository.list({ where, skip: pagination.skip, take: pagination.take });
    return { items: items.map(toNews), meta: buildMeta(pagination, total) };
  },

  async listPublic(query) {
    const pagination = getPagination(query, 50);
    const where = {
      ...publishedWhere(),
      ...(query.category && { categories: { some: { category: { slug: query.category } } } }),
      ...(query.q && { title: { contains: query.q } }),
    };
    const { items, total } = await newsRepository.list({ where, skip: pagination.skip, take: pagination.take, orderBy: { publishedAt: 'desc' } });
    // Danh sách không cần nội dung đầy đủ
    return { items: items.map(({ content, ...n }) => toNews(n)), meta: buildMeta(pagination, total) };
  },

  async getPublicBySlug(slug) {
    const news = await newsRepository.findBySlug(slug, publishedWhere());
    if (!news) throw ApiError.notFound('Không tìm thấy bài viết');
    const categoryIds = news.categories.map((c) => c.categoryId);
    const { items: related } = await newsRepository.list({
      where: { ...publishedWhere(), id: { not: news.id }, ...(categoryIds.length && { categories: { some: { categoryId: { in: categoryIds } } } }) },
      take: 3,
      orderBy: { publishedAt: 'desc' },
    });
    return { ...toNews(news), related: related.map(({ content, ...n }) => toNews(n)) };
  },

  async getById(id) {
    return toNews(await getOrThrow(id));
  },

  async create(authorId, { categoryIds = [], status = NEWS_STATUS.DRAFT, ...data }) {
    await assertCategories(categoryIds);
    const news = await newsRepository.create(
      {
        ...data,
        status,
        authorId,
        slug: await uniqueSlug(data.title),
        publishedAt: status === NEWS_STATUS.PUBLISHED ? new Date() : null,
      },
      [...new Set(categoryIds)],
    );
    return toNews(news);
  },

  async update(id, { categoryIds, ...data }) {
    const current = await getOrThrow(id);
    await assertCategories(categoryIds);
    const slug = data.title && data.title !== current.title ? await uniqueSlug(data.title, id) : undefined;
    const news = await newsRepository.update(id, { ...data, ...(slug && { slug }) }, categoryIds && [...new Set(categoryIds)]);
    return toNews(news);
  },

  async changeStatus(id, status) {
    const current = await getOrThrow(id);
    if (current.status === status) return toNews(current);
    if (!NEWS_TRANSITIONS[current.status]?.includes(status)) {
      throw ApiError.unprocessable(`Không thể chuyển từ "${STATUS_LABEL[current.status]}" sang "${STATUS_LABEL[status]}"`, 'INVALID_TRANSITION');
    }
    const publishedAt = status === NEWS_STATUS.PUBLISHED ? (current.publishedAt ?? new Date()) : current.publishedAt;
    return toNews(await newsRepository.update(id, { status, publishedAt }));
  },

  async remove(id) {
    await getOrThrow(id);
    await newsRepository.update(id, { deletedAt: new Date() });
  },
};
