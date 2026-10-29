import { LOW_STOCK_THRESHOLD, ROLES } from '../config/constants.js';
import { prisma } from '../lib/prisma.js';

// Số liệu tổng quan cho trang quản trị (dashboard doanh thu làm ở Phase 3)
export async function getOverview() {
  const now = new Date();
  const [customers, admins, categories, brands, teams, products, activeProducts, lowStock, runningVouchers, runningPromotions, publishedNews, recentUsers] =
    await prisma.$transaction([
      prisma.account.count({ where: { deletedAt: null, role: { code: ROLES.CUSTOMER } } }),
      prisma.account.count({ where: { deletedAt: null, role: { code: ROLES.ADMIN } } }),
      prisma.category.count({ where: { isActive: true } }),
      prisma.brand.count({ where: { isActive: true } }),
      prisma.team.count({ where: { isActive: true } }),
      prisma.product.count({ where: { deletedAt: null } }),
      prisma.product.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
      prisma.productVariant.count({ where: { isActive: true, product: { deletedAt: null }, stockQuantity: { lte: LOW_STOCK_THRESHOLD } } }),
      prisma.voucher.count({ where: { isActive: true, startAt: { lte: now }, endAt: { gte: now } } }),
      prisma.promotion.count({ where: { isActive: true, startAt: { lte: now }, endAt: { gte: now } } }),
      prisma.news.count({ where: { deletedAt: null, status: 'PUBLISHED' } }),
      prisma.account.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { id: true, email: true, createdAt: true, role: { select: { code: true } }, customer: { select: { fullName: true } } },
      }),
    ]);

  return {
    counts: { customers, admins, categories, brands, teams, products, activeProducts, lowStock, runningVouchers, runningPromotions, publishedNews },
    recentUsers: recentUsers.map((u) => ({ id: u.id, email: u.email, role: u.role.code, fullName: u.customer?.fullName, createdAt: u.createdAt })),
  };
}
