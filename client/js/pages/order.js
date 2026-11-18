import { api } from '../api.js';
import { requireAuth } from '../auth.js';
import { initPage } from '../layout.js';
import { PAYMENT_METHOD, orderTimeline, paymentPill, statusPill } from '../order-ui.js';
import { $, emptyState, formatCurrency, formatDateTime, getParam, html, icon, raw, setLoading, toast } from '../ui.js';

initPage();

const root = $('[data-order]');
const code = (getParam('code') ?? '').toUpperCase();
let order = null;

const user = await requireAuth();
if (user) load();

async function load() {
  root.innerHTML = '<div class="skeleton" style="height:480px"></div>';
  try {
    order = (await api.get(`/orders/${encodeURIComponent(code)}`)).data;
    render();
    if (getParam('pay') && order.canPay) $('[data-sandbox]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (err) {
    root.innerHTML = html`<div class="card"><div class="card-body">${raw(emptyState('receipt', 'Không tìm thấy đơn hàng', err.message))}</div></div>`;
  }
}

function sandboxCard() {
  return html`
    <div class="sandbox mb-4" data-sandbox>
      <p class="eyebrow" style="color:var(--c-on-dark-muted)">Cổng thanh toán mô phỏng · Sandbox</p>
      <p class="mt-2">${order.paymentStatus === 'FAILED' ? 'Lần thanh toán trước không thành công. Bạn có thể thanh toán lại.' : 'Đơn hàng đang chờ thanh toán online.'}</p>
      <p class="sandbox-amount">${formatCurrency(order.total)}</p>
      <div class="d-flex flex-wrap gap-2 mt-3">
        <button type="button" class="btn btn-primary btn-sm" data-pay="success" data-loading-text="Đang xử lý...">${raw(icon('credit-card', 16))}Thanh toán thành công</button>
        <button type="button" class="btn btn-outline btn-sm" style="color:var(--c-on-dark);border-color:var(--c-on-dark)" data-pay="failed">Mô phỏng thất bại</button>
      </div>
    </div>`;
}

function render() {
  $('[data-crumb]').textContent = order.orderCode;
  document.title = `Đơn ${order.orderCode} — JERSEY`;
  const placed = getParam('placed') || getParam('pay');

  root.innerHTML = html`
    ${placed && order.status === 'PENDING' ? raw(html`<div class="alert alert-success mb-4">${raw(icon('check-circle', 18))}<span>Đặt hàng thành công! Mã đơn <b>${order.orderCode}</b>. Cửa hàng sẽ xác nhận trong thời gian sớm nhất.</span></div>`) : ''}
    ${order.canPay ? raw(sandboxCard()) : ''}

    <div class="card mb-4"><div class="card-body">
      <div class="order-head">
        <div>
          <p class="eyebrow">Mã đơn hàng</p>
          <p class="order-code">${order.orderCode}</p>
          <p class="cell-sub">Đặt lúc ${formatDateTime(order.createdAt)}</p>
        </div>
        <div class="d-flex gap-2 align-items-center">
          ${raw(statusPill(order.status))}
          ${order.canCancel ? raw('<button type="button" class="btn btn-ghost btn-sm" data-cancel>Hủy đơn</button>') : ''}
        </div>
      </div>
      <div class="mt-5">${raw(orderTimeline(order))}</div>
      ${order.status === 'CANCELLED' ? raw(html`<p class="cart-issue mt-4">${raw(icon('info', 16))}Lý do hủy: ${order.cancelReason ?? '—'}</p>`) : ''}
    </div></div>

    <div class="checkout-layout">
      <div class="card"><div class="card-body">
        <h2 class="summary-title">Sản phẩm</h2>
        <div class="mt-2">${order.items.map((item) =>
          raw(html`<div class="order-line">
            <a class="cart-thumb" href="/product.html?slug=${item.productSlug}">${item.imageUrl ? raw(html`<img src="${item.imageUrl}" alt="${item.productName}">`) : raw(icon('shirt', 24))}</a>
            <div>
              <a class="cart-line-name" href="/product.html?slug=${item.productSlug}">${item.productName}</a>
              <p class="cell-sub">Size ${item.sizeName} · ${item.colorName} · SL ${item.quantity}</p>
              <p class="cell-sub">${formatCurrency(item.unitPrice)} / sản phẩm</p>
            </div>
            <div class="order-line-end">
              <b>${formatCurrency(item.lineTotal)}</b>
              ${order.canReview
                ? item.reviewed
                  ? raw(`<span class="pill pill-green">Đã đánh giá</span>`)
                  : raw(html`<button type="button" class="btn btn-outline btn-sm" data-review="${item.productId}">${raw(icon('star', 14))}Đánh giá</button>`)
                : ''}
            </div>
          </div>`),
        )}</div>
        <div class="info-grid mt-5">
          <div class="info-block">
            <h3>${raw(icon('map-pin', 14))}Giao đến</h3>
            <p><b>${order.receiverName}</b> · ${order.receiverPhone}</p>
            <p class="cell-sub">${order.shippingAddress}</p>
          </div>
          <div class="info-block">
            <h3>${raw(icon('credit-card', 14))}Thanh toán</h3>
            <p>${PAYMENT_METHOD[order.paymentMethod]}</p>
            <p class="mt-1">${raw(paymentPill(order.paymentStatus))}</p>
          </div>
          ${order.note ? raw(html`<div class="info-block"><h3>${raw(icon('pencil', 14))}Ghi chú</h3><p class="cell-sub">${order.note}</p></div>`) : ''}
        </div>
      </div></div>

      <aside class="card summary"><div class="card-body">
        <h2 class="summary-title">Thanh toán</h2>
        <dl class="summary-rows">
          <div><dt>Tạm tính</dt><dd>${formatCurrency(order.subtotal)}</dd></div>
          ${Number(order.discountAmount) ? raw(html`<div><dt>Giảm giá${order.voucherCode ? ` (${order.voucherCode})` : ''}</dt><dd class="discount">−${formatCurrency(order.discountAmount)}</dd></div>`) : ''}
          <div><dt>Phí giao hàng</dt><dd>${Number(order.shippingFee) ? formatCurrency(order.shippingFee) : 'Miễn phí'}</dd></div>
        </dl>
        <div class="summary-total"><span>Tổng cộng</span><b>${formatCurrency(order.total)}</b></div>
        <a class="link-more mt-4 d-inline-flex" href="/account.html#orders">${raw(icon('arrow-left', 14))}Tất cả đơn hàng</a>
      </div></aside>
    </div>`;
}

// ───────── Dialog nhập liệu ─────────
function formDialog({ title, body, submitText, danger = false, onSubmit }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'dialog';
  dialog.innerHTML = html`<form novalidate>
    <div class="dialog-head"><h2 class="dialog-title">${title}</h2></div>
    <div class="dialog-body">${raw(body)}</div>
    <div class="dialog-foot">
      <button type="button" class="btn btn-ghost btn-sm" data-close>Đóng</button>
      <button type="submit" class="btn ${danger ? 'btn-danger' : 'btn-dark'} btn-sm" data-loading-text="Đang gửi...">${submitText}</button>
    </div></form>`;
  document.body.append(dialog);
  const close = () => {
    dialog.close();
    dialog.remove();
  };
  dialog.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]') || e.target === dialog) close();
  });
  const form = $('form', dialog);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const button = $('[type="submit"]', form);
    setLoading(button, true);
    try {
      if ((await onSubmit(form)) !== false) close();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(button, false);
    }
  });
  dialog.showModal();
}

const CANCEL_REASONS = ['Muốn đổi size / màu', 'Muốn thay đổi địa chỉ giao hàng', 'Tìm được giá tốt hơn', 'Đặt nhầm sản phẩm', 'Không còn nhu cầu'];

function openCancel() {
  formDialog({
    title: 'Hủy đơn hàng',
    danger: true,
    submitText: 'Xác nhận hủy',
    body: html`<p class="mb-3">Sản phẩm sẽ được hoàn lại kho và mã giảm giá (nếu có) được hoàn lượt.</p>
      <label class="field"><span class="label">Lý do hủy</span>
        <select class="select" name="reason">${CANCEL_REASONS.map((r) => raw(html`<option>${r}</option>`))}</select></label>`,
    onSubmit: async (form) => {
      order = (await api.post(`/orders/${order.orderCode}/cancel`, { reason: form.elements.reason.value })).data;
      toast('Đã hủy đơn hàng', 'success');
      render();
    },
  });
}

function openReview(productId) {
  const item = order.items.find((i) => i.productId === productId);
  formDialog({
    title: 'Đánh giá sản phẩm',
    submitText: 'Gửi đánh giá',
    body: html`<p class="fw-semibold">${item.productName}</p><p class="cell-sub mb-3">Size ${item.sizeName} · ${item.colorName}</p>
      <fieldset class="field"><legend class="label">Chất lượng sản phẩm</legend>
        <div class="star-input">${[5, 4, 3, 2, 1].map((n) =>
          raw(html`<input type="radio" name="rating" id="star-${n}" value="${n}" ${n === 5 ? raw('checked') : ''}><label for="star-${n}" title="${n} sao">${raw(icon('star', 28))}</label>`),
        )}</div>
      </fieldset>
      <label class="field mt-3"><span class="label">Nhận xét</span>
        <textarea class="textarea" name="content" rows="4" maxlength="1000" placeholder="Chất vải, form áo, giao hàng..."></textarea></label>`,
    onSubmit: async (form) => {
      await api.post('/reviews', {
        orderId: order.id,
        productId,
        rating: Number(form.elements.rating.value),
        content: form.elements.content.value.trim() || null,
      });
      toast('Cảm ơn bạn đã đánh giá!', 'success');
      order = (await api.get(`/orders/${order.orderCode}`)).data;
      render();
    },
  });
}

root.addEventListener('click', async (e) => {
  if (e.target.closest('[data-cancel]')) return openCancel();
  const review = e.target.closest('[data-review]');
  if (review) return openReview(Number(review.dataset.review));
  const pay = e.target.closest('[data-pay]');
  if (pay) {
    setLoading(pay, true);
    try {
      order = (await api.post(`/orders/${order.orderCode}/pay`, { result: pay.dataset.pay })).data;
      toast(order.paymentStatus === 'PAID' ? 'Thanh toán thành công' : 'Thanh toán thất bại — bạn có thể thử lại', order.paymentStatus === 'PAID' ? 'success' : 'error');
      render();
    } catch (err) {
      toast(err.message, 'error');
      setLoading(pay, false);
    }
  }
});

