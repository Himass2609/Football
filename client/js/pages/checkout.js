import { addressText, openAddressDialog } from '../address-form.js';
import { api } from '../api.js';
import { requireAuth } from '../auth.js';
import { emitCart } from '../cart-store.js';
import { initPage } from '../layout.js';
import { PAYMENT_METHOD } from '../order-ui.js';
import { $, emptyState, formatCurrency, html, icon, raw, setLoading, toast } from '../ui.js';

initPage();

const root = $('[data-checkout]');
const state = { addresses: [], addressId: null, paymentMethod: 'COD', voucherCode: '', voucherError: '', preview: null, vouchers: [] };

const user = await requireAuth();
if (user) load();

async function load() {
  root.innerHTML = '<div class="skeleton" style="height:420px"></div>';
  try {
    const [addresses, vouchers] = await Promise.all([api.get('/account/addresses'), api.get('/vouchers').catch(() => ({ data: [] }))]);
    state.addresses = addresses.data;
    state.addressId = state.addresses.find((a) => a.isDefault)?.id ?? state.addresses[0]?.id ?? null;
    state.vouchers = vouchers.data;
    state.preview = (await api.post('/checkout/preview', {})).data;
    render();
  } catch (err) {
    // Giỏ trống hoặc có sản phẩm hết hàng → quay lại giỏ
    if (['CART_EMPTY', 'CART_INVALID'].includes(err.code)) {
      root.innerHTML = html`<div class="card"><div class="card-body">${raw(emptyState('bag', err.code === 'CART_EMPTY' ? 'Giỏ hàng đang trống' : 'Giỏ hàng cần cập nhật', err.message))}
        <div class="text-center pb-4"><a class="btn btn-dark" href="${err.code === 'CART_EMPTY' ? '/products.html' : '/cart.html'}">${err.code === 'CART_EMPTY' ? 'Mua sắm ngay' : 'Về giỏ hàng'}${raw(icon('arrow-right', 18))}</a></div></div></div>`;
      return;
    }
    root.innerHTML = emptyState('alert-circle', 'Không tải được trang thanh toán', err.message);
  }
}

// ───────── Các bước ─────────
function addressStep() {
  return html`
    <section class="card checkout-step"><div class="card-body">
      <h2 class="step-title"><span class="step-num">1</span>Địa chỉ giao hàng</h2>
      ${state.addresses.length
        ? raw(html`<div class="option-list" role="radiogroup" aria-label="Chọn địa chỉ">${state.addresses.map((a) =>
            raw(html`<label class="option-card">
              <input type="radio" name="address" value="${a.id}" ${a.id === state.addressId ? raw('checked') : ''}>
              <span>
                <span class="option-title">${a.receiverName}</span> <span class="cell-sub">· ${a.phone}</span>
                ${a.isDefault ? raw('<span class="pill pill-blue ms-2">Mặc định</span>') : ''}
                <span class="d-block cell-sub mt-1">${addressText(a)}</span>
              </span>
            </label>`),
          )}</div>`)
        : raw(html`<p class="cell-sub mt-3">Bạn chưa có địa chỉ giao hàng. Thêm địa chỉ để tiếp tục.</p>`)}
      <button type="button" class="btn btn-outline btn-sm mt-4" data-add-address>${raw(icon('plus', 16))}Thêm địa chỉ mới</button>
    </div></section>`;
}

function paymentStep() {
  const options = [
    ['COD', 'wallet', 'Thanh toán bằng tiền mặt khi nhận hàng.'],
    ['ONLINE', 'credit-card', 'Thẻ ATM / Visa / Ví điện tử qua cổng thanh toán mô phỏng (sandbox).'],
  ];
  return html`
    <section class="card checkout-step"><div class="card-body">
      <h2 class="step-title"><span class="step-num">2</span>Phương thức thanh toán</h2>
      <div class="option-list" role="radiogroup" aria-label="Phương thức thanh toán">${options.map(([value, ic, desc]) =>
        raw(html`<label class="option-card">
          <input type="radio" name="payment" value="${value}" ${value === state.paymentMethod ? raw('checked') : ''}>
          <span class="option-icon">${raw(icon(ic, 22))}</span>
          <span><span class="option-title">${PAYMENT_METHOD[value]}</span><span class="d-block cell-sub mt-1">${desc}</span></span>
        </label>`),
      )}</div>
    </div></section>
    <section class="card checkout-step"><div class="card-body">
      <h2 class="step-title"><span class="step-num">3</span>Ghi chú</h2>
      <textarea class="textarea mt-4" rows="3" maxlength="500" data-note placeholder="Ví dụ: giao giờ hành chính, gọi trước khi giao..."></textarea>
    </div></section>`;
}

function summary() {
  const p = state.preview;
  return html`
    <aside class="card summary"><div class="card-body">
      <h2 class="summary-title">Đơn hàng (${p.items.reduce((s, l) => s + l.quantity, 0)})</h2>
      <div class="summary-items">${p.items.map((l) =>
        raw(html`<div class="summary-item">
          <span class="cart-thumb">${l.image ? raw(html`<img src="${l.image}" alt="">`) : raw(icon('shirt', 20))}<span class="qty-badge">${l.quantity}</span></span>
          <span><span class="d-block fw-semibold text-truncate">${l.product.name}</span><span class="cell-sub">Size ${l.size.name} · ${l.color.name}</span></span>
          <b>${formatCurrency(l.lineTotal)}</b>
        </div>`),
      )}</div>

      <form class="voucher-form" data-voucher-form novalidate>
        <input class="input" name="code" placeholder="Mã giảm giá" maxlength="30" value="${state.voucherCode}" aria-label="Mã giảm giá">
        <button class="btn btn-dark btn-sm" type="submit">Áp dụng</button>
      </form>
      ${state.voucherError ? raw(html`<p class="field-error mt-2">${state.voucherError}</p>`) : ''}
      ${p.voucher
        ? raw(html`<div class="voucher-applied"><span>${raw(icon('ticket', 16))} <b>${p.voucher.code}</b> — giảm ${formatCurrency(p.discount)}</span><button type="button" class="link-remove" data-remove-voucher>Bỏ</button></div>`)
        : state.vouchers.length
          ? raw(html`<div class="chips mt-3">${state.vouchers.slice(0, 3).map((v) => raw(html`<button type="button" class="chip" data-use-voucher="${v.code}" title="${v.description ?? ''}">${v.code}</button>`))}</div>`)
          : ''}

      <dl class="summary-rows mt-4">
        <div><dt>Tạm tính</dt><dd>${formatCurrency(p.subtotal)}</dd></div>
        ${p.discount ? raw(html`<div><dt>Giảm giá</dt><dd class="discount">−${formatCurrency(p.discount)}</dd></div>`) : ''}
        <div><dt>Phí giao hàng</dt><dd>${p.shippingFee ? formatCurrency(p.shippingFee) : 'Miễn phí'}</dd></div>
      </dl>
      <div class="summary-total"><span>Tổng thanh toán</span><b>${formatCurrency(p.total)}</b></div>
      <button type="button" class="btn btn-primary btn-block mt-4" data-place data-loading-text="Đang đặt hàng..." ${state.addressId ? '' : raw('disabled')}>Đặt hàng${raw(icon('arrow-right', 18))}</button>
      <p class="cell-sub mt-3 text-center">Giá và tồn kho được kiểm tra lại khi đặt hàng.</p>
    </div></aside>`;
}

function render() {
  const note = $('[data-note]')?.value ?? '';
  root.innerHTML = html`<div class="checkout-layout"><div>${raw(addressStep())}${raw(paymentStep())}</div>${raw(summary())}</div>`;
  $('[data-note]').value = note;
}

// ───────── Voucher ─────────
async function applyVoucher(code) {
  try {
    state.preview = (await api.post('/checkout/preview', code ? { voucherCode: code } : {})).data;
    state.voucherCode = code;
    state.voucherError = '';
  } catch (err) {
    if (err.code !== 'VOUCHER_INVALID') return toast(err.message, 'error');
    state.voucherError = err.message;
    state.voucherCode = code;
    state.preview = (await api.post('/checkout/preview', {})).data;
  }
  render();
}

// ───────── Sự kiện ─────────
root.addEventListener('change', (e) => {
  if (e.target.name === 'address') state.addressId = Number(e.target.value);
  if (e.target.name === 'payment') state.paymentMethod = e.target.value;
});

root.addEventListener('submit', (e) => {
  if (!e.target.matches('[data-voucher-form]')) return;
  e.preventDefault();
  applyVoucher(e.target.elements.code.value.trim().toUpperCase());
});

root.addEventListener('click', async (e) => {
  if (e.target.closest('[data-add-address]')) {
    const saved = await openAddressDialog();
    if (!saved) return;
    state.addresses = (await api.get('/account/addresses')).data;
    state.addressId = saved.id;
    return render();
  }
  const use = e.target.closest('[data-use-voucher]');
  if (use) return applyVoucher(use.dataset.useVoucher);
  if (e.target.closest('[data-remove-voucher]')) {
    state.voucherCode = '';
    return applyVoucher('');
  }
  const place = e.target.closest('[data-place]');
  if (place) placeOrder(place);
});

async function placeOrder(button) {
  if (!state.addressId) return toast('Vui lòng chọn địa chỉ giao hàng', 'error');
  setLoading(button, true);
  button.disabled = true;
  try {
    const { data } = await api.post('/orders', {
      addressId: state.addressId,
      paymentMethod: state.paymentMethod,
      voucherCode: state.preview.voucher?.code,
      note: $('[data-note]').value.trim() || null,
    });
    emitCart(null);
    location.href = `/order.html?code=${data.orderCode}&${data.paymentMethod === 'ONLINE' ? 'pay=1' : 'placed=1'}`;
  } catch (err) {
    toast(err.message, 'error');
    if (err.code === 'VOUCHER_INVALID') {
      await applyVoucher('');
      state.voucherError = err.message;
      render();
    } else if (['CART_INVALID', 'OUT_OF_STOCK', 'CART_EMPTY'].includes(err.code)) {
      setTimeout(() => (location.href = '/cart.html'), 1500);
    }
    setLoading(button, false);
    button.disabled = false;
  }
}
