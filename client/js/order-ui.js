// Nhãn & màu trạng thái đơn hàng / thanh toán dùng chung cho storefront và admin (CLAUDE.md 7.3)
import { html, icon, raw } from './ui.js';

export const ORDER_STATUS = {
  PENDING: { label: 'Chờ xác nhận', pill: 'pill-gray', icon: 'clock' },
  CONFIRMED: { label: 'Đã xác nhận', pill: 'pill-blue', icon: 'check-circle' },
  PROCESSING: { label: 'Đang chuẩn bị', pill: 'pill-violet', icon: 'package' },
  SHIPPING: { label: 'Đang giao', pill: 'pill-amber', icon: 'truck' },
  DELIVERED: { label: 'Đã giao', pill: 'pill-green', icon: 'badge-check' },
  CANCELLED: { label: 'Đã hủy', pill: 'pill-red', icon: 'x' },
};
export const ORDER_FLOW = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPING', 'DELIVERED'];

export const PAYMENT_METHOD = { COD: 'Thanh toán khi nhận hàng (COD)', ONLINE: 'Thanh toán online' };
export const PAYMENT_STATUS = {
  UNPAID: { label: 'Chưa thanh toán', pill: 'pill-gray' },
  PAID: { label: 'Đã thanh toán', pill: 'pill-green' },
  FAILED: { label: 'Thanh toán lỗi', pill: 'pill-red' },
  REFUNDED: { label: 'Đã hoàn tiền', pill: 'pill-amber' },
};

export const statusPill = (status) => html`<span class="pill ${ORDER_STATUS[status]?.pill ?? 'pill-gray'}">${ORDER_STATUS[status]?.label ?? status}</span>`;
export const paymentPill = (status) => html`<span class="pill ${PAYMENT_STATUS[status]?.pill ?? 'pill-gray'}">${PAYMENT_STATUS[status]?.label ?? status}</span>`;

/** Dòng thời gian trạng thái: các bước đã qua sáng màu, đơn hủy hiện bước hủy */
export function orderTimeline(order) {
  const reached = new Map(order.history.map((h) => [h.toStatus, h.changedAt]));
  const steps = order.status === 'CANCELLED' ? [...ORDER_FLOW.filter((s) => reached.has(s)), 'CANCELLED'] : ORDER_FLOW;
  const fmt = (d) => new Date(d).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
  return html`<ol class="timeline">${steps.map((s) =>
    raw(html`<li class="${reached.has(s) ? 'done' : ''} ${s === order.status ? 'current' : ''} ${s === 'CANCELLED' ? 'cancelled' : ''}">
      <span class="timeline-dot">${raw(icon(ORDER_STATUS[s].icon, 16))}</span>
      <span class="timeline-label">${ORDER_STATUS[s].label}</span>
      <span class="timeline-time">${reached.has(s) ? fmt(reached.get(s)) : ''}</span>
    </li>`),
  )}</ol>`;
}
