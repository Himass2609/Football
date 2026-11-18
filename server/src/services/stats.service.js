import { LOW_STOCK_THRESHOLD, ORDER_STATUS, ROLES } from '../config/constants.js';
import { prisma } from '../lib/prisma.js';

const dayKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Thống kê dashboard trong N ngày gần nhất.
 * Doanh thu = tổng tiền đơn đã giao (DELIVERED) theo ngày giao; số đơn = đơn tạo trong kỳ (không tính đơn hủy).
 */
export async function getStats(days) {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));

  const [orders, delivered, newCustomers, lowStock, topRows] = await Promise.all([
    prisma.order.findMany({ where: { createdAt: { gte: since } }, select: { status: true, total: true, createdAt: true } }),
    prisma.order.findMany({ where: { status: ORDER_STATUS.DELIVERED, deliveredAt: { gte: since } }, select: { total: true, deliveredAt: true } }),
    prisma.account.count({ where: { deletedAt: null, createdAt: { gte: since }, role: { code: ROLES.CUSTOMER } } }),
    prisma.productVariant.count({ where: { isActive: true, product: { deletedAt: null }, stockQuantity: { lte: LOW_STOCK_THRESHOLD } } }),
    prisma.orderDetail.groupBy({
      by: ['productId'],
      where: { order: { createdAt: { gte: since }, status: { not: ORDER_STATUS.CANCELLED } } },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    }),
  ]);

  // Chuỗi theo ngày, đủ cả ngày không có đơn
  const series = [];
  const byDay = new Map();
  for (let i = 0; i < days; i += 1) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const point = { date: dayKey(d), revenue: 0, orders: 0 };
    series.push(point);
    byDay.set(point.date, point);
  }
  for (const o of delivered) {
    const point = byDay.get(dayKey(o.deliveredAt));
    if (point) point.revenue += Number(o.total);
  }
  const active = orders.filter((o) => o.status !== ORDER_STATUS.CANCELLED);
  for (const o of active) {
    const point = byDay.get(dayKey(o.createdAt));
    if (point) point.orders += 1;
  }

  const revenue = delivered.reduce((sum, o) => sum + Number(o.total), 0);
  const statusCounts = Object.fromEntries(Object.values(ORDER_STATUS).map((s) => [s, orders.filter((o) => o.status === s).length]));

  const products = await prisma.product.findMany({
    where: { id: { in: topRows.map((r) => r.productId) } },
    select: { id: true, name: true, slug: true, images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }], take: 1, select: { url: true } } },
  });
  const topProducts = topRows.map((r) => {
    const p = products.find((x) => x.id === r.productId);
    return { id: r.productId, name: p?.name, slug: p?.slug, image: p?.images[0]?.url ?? null, quantity: r._sum.quantity, revenue: Number(r._sum.lineTotal) };
  });

  return {
    days,
    kpis: {
      revenue,
      orders: active.length,
      deliveredOrders: delivered.length,
      averageOrderValue: delivered.length ? Math.round(revenue / delivered.length) : 0,
      newCustomers,
      lowStock,
      pendingOrders: statusCounts.PENDING,
    },
    statusCounts,
    series,
    topProducts,
  };
}
