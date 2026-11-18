import { api } from '../../api.js';
import { ORDER_STATUS, PAYMENT_METHOD, orderTimeline, paymentPill, statusPill } from '../../order-ui.js';
import { $, emptyState, formatCurrency, formatDateTime, getParam, html, icon, raw, setLoading, toast } from '../../ui.js';
import { mountAdmin } from '../shell.js';

// Nhãn nút cho từng bước chuyển trạng thái
const ACTIONS = {
  CONFIRMED: { label: 'Xác nhận đơn', icon: 'check-circle', className: 'btn-dark' },
  PROCESSING: { label: 'Chuẩn bị hàng', icon: 'package', className: 'btn-dark' },
  SHIPPING: { label: 'Giao cho vận chuyển', icon: 'truck', className: 'btn-dark' },
  DELIVERED: { label: 'Đã giao thành công', icon: 'badge-check', className: 'btn-primary' },
  CANCELLED: { label: 'Hủy đơn', icon: 'x', className: 'btn-danger' },
};
const PAYMENT_ROW = { PENDING: 'pill-gray', SUCCESS: 'pill-green', FAILED: 'pill-red', CANCELLED: 'pill-amber' };
const PAYMENT_ROW_LABEL = { PENDING: 'Chờ thanh toán', SUCCESS: 'Thành công', FAILED: 'Thất bại', CANCELLED: 'Đã hủy' };

const root = $('[data-order]');
let order;

if (await mountAdmin({ active: 'orders', title: 'Chi tiết đơn hàng' })) {
  $('[data-page-heading]').textContent = 'Chi tiết đơn hàng';
  load();
}

async function load() {
  root.innerHTML = '<div class="skeleton" style="height:420px"></div>';
  try {
    order = (await api.get(`/admin/orders/${Number(getParam('id'))}`)).data;
    render();
  } catch (err) {
    root.innerHTML = `<div class="card">${emptyState('receipt', 'Không tải được đơn hàng', err.message)}</div>`;
  }
}

function actionsHtml() {
  if (!order.nextStatuses.length) return '';
  const blocked = order.paymentMethod === 'ONLINE' && order.paymentStatus !== 'PAID';
  return html`<div class="d-flex flex-wrap gap-2">${order.nextStatuses.map((s) => {
    const a = ACTIONS[s];
    const disabled = s === 'CONFIRMED' && blocked;
    return raw(html`<button type="button" class="btn btn-sm ${a.className}" data-next="${s}" ${disabled ? raw('disabled title="Khách chưa thanh toán online"') : ''}>${raw(icon(a.icon, 16))}${a.label}</button>`);
  })}</div>`;
}

function render() {
  $('[data-page-desc]').textContent = `${order.orderCode} · đặt lúc ${formatDateTime(order.createdAt)}`;
  root.innerHTML = html`
    <div class="card mb-4"><div class="card-body">
      <div class="order-head">
        <div class="d-flex align-items-center gap-3"><span class="order-code">${order.orderCode}</span>${raw(statusPill(order.status))}${raw(paymentPill(order.paymentStatus))}</div>
        ${raw(actionsHtml())}
      </div>
      ${order.paymentMethod === 'ONLINE' && order.status === 'PENDING' && order.paymentStatus !== 'PAID'
        ? raw(html`<p class="cart-issue">${raw(icon('info', 16))}Đơn thanh toán online — chờ khách thanh toán thành công mới xác nhận được.</p>`)
        : ''}
      <div class="mt-5">${raw(orderTimeline(order))}</div>
    </div></div>

    <div class="row g-4">
      <div class="col-12 col-xl-8">
        <div class="card"><div class="card-head"><h2 class="card-title">Sản phẩm (${order.itemCount})</h2></div>
          <div class="table-wrap"><table class="table">
            <thead><tr><th>Sản phẩm</th><th>Phân loại</th><th class="text-end">Đơn giá</th><th class="text-end">SL</th><th class="text-end">Thành tiền</th></tr></thead>
            <tbody>${order.items.map((i) =>
              raw(html`<tr>
                <td><div class="d-flex align-items-center gap-3">${i.imageUrl ? raw(html`<img class="thumb" src="${i.imageUrl}" alt="">`) : ''}<span class="cell-main">${i.productName}</span></div></td>
                <td>${i.sizeName} · ${i.colorName}</td>
                <td class="text-end">${formatCurrency(i.unitPrice)}</td>
                <td class="text-end">${i.quantity}</td>
                <td class="text-end cell-main">${formatCurrency(i.lineTotal)}</td>
              </tr>`),
            )}</tbody>
          </table></div>
          <div class="card-body">
            <dl class="summary-rows ms-auto" style="max-width:360px">
              <div><dt>Tạm tính</dt><dd>${formatCurrency(order.subtotal)}</dd></div>
              ${Number(order.discountAmount) ? raw(html`<div><dt>Giảm giá${order.voucherCode ? ` (${order.voucherCode})` : ''}</dt><dd class="discount">−${formatCurrency(order.discountAmount)}</dd></div>`) : ''}
              <div><dt>Phí giao hàng</dt><dd>${Number(order.shippingFee) ? formatCurrency(order.shippingFee) : 'Miễn phí'}</dd></div>
            </dl>
            <div class="summary-total ms-auto" style="max-width:360px"><span>Tổng cộng</span><b>${formatCurrency(order.total)}</b></div>
          </div>
        </div>

        <div class="card mt-4"><div class="card-head"><h2 class="card-title">Lịch sử trạng thái</h2></div>
          <div class="table-wrap"><table class="table"><tbody>${[...order.history].reverse().map((h) =>
            raw(html`<tr>
              <td class="cell-sub" style="width:170px">${formatDateTime(h.changedAt)}</td>
              <td>${h.fromStatus ? raw(html`${ORDER_STATUS[h.fromStatus]?.label ?? h.fromStatus} → `) : ''}<b>${ORDER_STATUS[h.toStatus]?.label ?? h.toStatus}</b></td>
              <td class="cell-sub">${h.note ?? ''}</td>
            </tr>`),
          )}</tbody></table></div>
        </div>
      </div>

      <div class="col-12 col-xl-4">
        <div class="card"><div class="card-body">
          <div class="info-block"><h3>${raw(icon('user', 14))}Khách hàng</h3>
            <p><b>${order.customer.fullName}</b></p><p class="cell-sub">${order.customer.email}${order.customer.phone ? ` · ${order.customer.phone}` : ''}</p></div>
          <div class="info-block mt-4"><h3>${raw(icon('map-pin', 14))}Giao đến</h3>
            <p><b>${order.receiverName}</b> · ${order.receiverPhone}</p><p class="cell-sub">${order.shippingAddress}</p></div>
          ${order.note ? raw(html`<div class="info-block mt-4"><h3>${raw(icon('pencil', 14))}Ghi chú của khách</h3><p class="cell-sub">${order.note}</p></div>`) : ''}
          ${order.cancelReason ? raw(html`<div class="info-block mt-4"><h3>${raw(icon('x', 14))}Lý do hủy</h3><p class="cell-sub">${order.cancelReason}</p></div>`) : ''}
          <div class="info-block mt-4"><h3>${raw(icon('credit-card', 14))}Thanh toán</h3><p>${PAYMENT_METHOD[order.paymentMethod]}</p>
            <ul class="list-unstyled mt-2 mb-0">${order.payments.map((p) =>
              raw(html`<li class="d-flex justify-content-between gap-2 mt-2"><span class="cell-sub">${formatDateTime(p.createdAt)}${p.transactionRef ? ` · ${p.transactionRef}` : ''}</span><span class="pill ${PAYMENT_ROW[p.status]}">${PAYMENT_ROW_LABEL[p.status] ?? p.status}</span></li>`),
            )}</ul></div>
        </div></div>
      </div>
    </div>`;
}

// ───────── Chuyển trạng thái ─────────
function askNote(status) {
  return new Promise((resolve) => {
    const cancel = status === 'CANCELLED';
    const dialog = document.createElement('dialog');
    dialog.className = 'dialog';
    dialog.innerHTML = html`<form novalidate>
      <div class="dialog-head"><h2 class="dialog-title">${ACTIONS[status].label}</h2></div>
      <div class="dialog-body">
        <p class="mb-3">${cancel ? 'Hủy đơn sẽ hoàn lại tồn kho, hoàn lượt voucher; đơn đã thanh toán online chuyển sang “Đã hoàn tiền”.' : `Chuyển đơn ${order.orderCode} sang “${ORDER_STATUS[status].label}”.`}</p>
        <label class="field"><span class="label">${cancel ? 'Lý do hủy' : 'Ghi chú (không bắt buộc)'}</span>
          <input class="input" name="note" maxlength="255" ${cancel ? raw('required value="Hết hàng / không liên hệ được khách"') : ''}></label>
      </div>
      <div class="dialog-foot">
        <button type="button" class="btn btn-ghost btn-sm" data-close>Đóng</button>
        <button type="submit" class="btn btn-sm ${cancel ? 'btn-danger' : 'btn-dark'}">Xác nhận</button>
      </div></form>`;
    document.body.append(dialog);
    const close = (value) => {
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    dialog.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]') || e.target === dialog) close(null);
    });
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      close(null);
    });
    $('form', dialog).addEventListener('submit', (e) => {
      e.preventDefault();
      const note = e.target.elements.note.value.trim();
      if (cancel && note.length < 3) return e.target.elements.note.focus();
      close({ note: note || null });
    });
    dialog.showModal();
  });
}

root.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-next]');
  if (!btn || btn.disabled) return;
  const status = btn.dataset.next;
  const input = await askNote(status);
  if (!input) return;
  setLoading(btn, true);
  try {
    order = (await api.patch(`/admin/orders/${order.id}/status`, { status, note: input.note })).data;
    toast(`Đã chuyển sang “${ORDER_STATUS[status].label}”`, 'success');
    render();
  } catch (err) {
    toast(err.message, 'error', 5000);
    setLoading(btn, false);
  }
});
