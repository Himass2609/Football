import { api } from '../api.js';
import { requireAuth } from '../auth.js';
import { emitCart } from '../cart-store.js';
import { initPage } from '../layout.js';
import { $, debounce, emptyState, formatCurrency, html, icon, raw, toast } from '../ui.js';

initPage();

const root = $('[data-cart]');
let cart = null;
let settings = { freeShipThreshold: 500000 };

const user = await requireAuth();
if (user) load();

async function load() {
  root.innerHTML = '<div class="skeleton" style="height:320px"></div>';
  try {
    const [cartRes, settingRes] = await Promise.all([api.get('/cart'), api.get('/settings').catch(() => null)]);
    if (settingRes) settings = settingRes.data;
    setCart(cartRes.data);
  } catch (err) {
    root.innerHTML = emptyState('alert-circle', 'Không tải được giỏ hàng', err.message);
  }
}

function setCart(data) {
  cart = data;
  emitCart(cart);
  render();
}

const lineMeta = (line) => [line.product.teamName, `Size ${line.size.name}`, line.color.name].filter(Boolean).join(' · ');

function lineHtml(line) {
  const max = Math.min(10, line.stock);
  return html`
    <article class="cart-line ${line.issue ? 'has-issue' : ''}" data-line="${line.id}">
      <a class="cart-thumb" href="/product.html?slug=${line.product.slug}">
        ${line.image ? raw(html`<img src="${line.image}" alt="${line.product.name}" loading="lazy">`) : raw(icon('shirt', 28))}
      </a>
      <div class="cart-line-body">
        <a class="cart-line-name" href="/product.html?slug=${line.product.slug}">${line.product.name}</a>
        <p class="cell-sub">${lineMeta(line)}</p>
        <p class="cart-line-price">${formatCurrency(line.unitPrice)}${line.originalPrice > line.unitPrice ? raw(html` <s>${formatCurrency(line.originalPrice)}</s>`) : ''}</p>
        ${line.issue ? raw(html`<p class="cart-issue">${raw(icon('alert-circle', 16))}${line.issueMessage}${line.issue === 'INSUFFICIENT_STOCK' ? ` — còn ${line.stock}` : ''}</p>`) : ''}
      </div>
      <div class="cart-line-actions">
        ${line.issue === 'UNAVAILABLE' || line.issue === 'OUT_OF_STOCK'
          ? ''
          : raw(html`<div class="qty qty-sm">
              <button type="button" data-step="-1" aria-label="Giảm" ${line.quantity <= 1 ? raw('disabled') : ''}>−</button>
              <input type="number" min="1" max="${max}" value="${line.quantity}" data-qty aria-label="Số lượng">
              <button type="button" data-step="1" aria-label="Tăng" ${line.quantity >= max ? raw('disabled') : ''}>+</button>
            </div>`)}
        <p class="cart-line-total">${formatCurrency(line.lineTotal)}</p>
        <button type="button" class="link-remove" data-remove>${raw(icon('trash', 16))}Xóa</button>
      </div>
    </article>`;
}

function summaryHtml() {
  const remaining = Math.max(0, settings.freeShipThreshold - cart.subtotal);
  const progress = Math.min(100, Math.round((cart.subtotal / settings.freeShipThreshold) * 100));
  return html`
    <aside class="card summary">
      <div class="card-body">
        <h2 class="summary-title">Tóm tắt đơn hàng</h2>
        <div class="freeship">
          <p>${remaining > 0 ? raw(html`Mua thêm <b>${formatCurrency(remaining)}</b> để được miễn phí giao hàng`) : raw('<b>Bạn được miễn phí giao hàng</b>')}</p>
          <div class="freeship-bar"><span style="width:${progress}%"></span></div>
        </div>
        <dl class="summary-rows">
          <div><dt>Tạm tính (${cart.itemCount} sản phẩm)</dt><dd>${formatCurrency(cart.subtotal)}</dd></div>
          <div><dt>Phí giao hàng</dt><dd class="cell-sub">Tính ở bước thanh toán</dd></div>
        </dl>
        <div class="summary-total"><span>Tổng</span><b>${formatCurrency(cart.subtotal)}</b></div>
        ${cart.hasIssues ? raw(html`<p class="cart-issue mt-3">${raw(icon('alert-circle', 16))}Vui lòng xóa hoặc giảm số lượng sản phẩm bị lỗi trước khi thanh toán.</p>`) : ''}
        <a class="btn btn-primary btn-block mt-4 ${cart.hasIssues ? 'is-disabled' : ''}" href="/checkout.html" ${cart.hasIssues ? raw('aria-disabled="true" tabindex="-1"') : ''}>Thanh toán${raw(icon('arrow-right', 18))}</a>
        <a class="link-more mt-3 d-inline-flex" href="/products.html">${raw(icon('arrow-left', 14))}Tiếp tục mua sắm</a>
      </div>
    </aside>`;
}

function render() {
  if (!cart.items.length) {
    root.innerHTML = html`<div class="card"><div class="card-body">${raw(emptyState('bag', 'Giỏ hàng đang trống', 'Khám phá áo đấu mùa giải mới và thêm vào giỏ nhé.'))}
      <div class="text-center pb-4"><a class="btn btn-dark" href="/products.html">Mua sắm ngay${raw(icon('arrow-right', 18))}</a></div></div></div>`;
    return;
  }
  root.innerHTML = html`
    <div class="cart-layout">
      <div class="card"><div class="cart-lines">${cart.items.map((l) => raw(lineHtml(l)))}</div></div>
      ${raw(summaryHtml())}
    </div>`;
}

// ───────── Thao tác ─────────
async function mutate(request) {
  root.setAttribute('aria-busy', 'true');
  try {
    setCart((await request()).data);
  } catch (err) {
    toast(err.message, 'error');
    render();
  } finally {
    root.removeAttribute('aria-busy');
  }
}

const updateQty = (id, quantity) => mutate(() => api.patch(`/cart/items/${id}`, { quantity }));

root.addEventListener('click', (e) => {
  const lineEl = e.target.closest('[data-line]');
  if (!lineEl) return;
  const id = Number(lineEl.dataset.line);
  const line = cart.items.find((l) => l.id === id);
  const step = e.target.closest('[data-step]');
  if (step && !step.disabled) return updateQty(id, line.quantity + Number(step.dataset.step));
  if (e.target.closest('[data-remove]')) mutate(() => api.delete(`/cart/items/${id}`));
});

root.addEventListener(
  'input',
  debounce((e) => {
    if (!e.target.matches('[data-qty]')) return;
    const id = Number(e.target.closest('[data-line]').dataset.line);
    const value = Math.max(1, Math.min(10, Number(e.target.value) || 1));
    updateQty(id, value);
  }, 500),
);
