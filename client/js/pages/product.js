import { api } from '../api.js';
import { initPage } from '../layout.js';
import { priceHtml, productArt, productCard } from '../product-card.js';
import { $, emptyState, formatDate, getParam, html, icon, raw, toast } from '../ui.js';

initPage();

const root = $('[data-product]');
const LOW_STOCK = 5;
const GENDER = { MEN: 'Nam', WOMEN: 'Nữ', KIDS: 'Trẻ em', UNISEX: 'Unisex' };
const SHIRT_HEAD = ['Size', 'Ngực (cm)', 'Dài áo (cm)', 'Chiều cao'];
const SIZE_CHART = {
  ADULT: {
    head: SHIRT_HEAD,
    rows: [['S', '88–92', '68', '1m55–1m63'], ['M', '93–97', '70', '1m63–1m70'], ['L', '98–102', '72', '1m70–1m76'], ['XL', '103–107', '74', '1m76–1m82'], ['XXL', '108–114', '76', '1m82–1m88']],
    note: 'Số đo bản Fan. Bản Player ôm hơn — nên chọn lớn hơn 1 size.',
  },
  KID: {
    head: SHIRT_HEAD,
    rows: [['6Y', '60–62', '46', '1m10–1m18'], ['8Y', '63–66', '50', '1m18–1m28'], ['10Y', '67–70', '54', '1m28–1m38'], ['12Y', '71–75', '58', '1m38–1m48'], ['14Y', '76–80', '62', '1m48–1m58']],
    note: 'Số đo tham khảo theo chiều cao của bé.',
  },
  SHOE: {
    head: ['EU', 'US', 'UK', 'Dài chân (cm)'],
    rows: [['39', '6.5', '6', '24.5'], ['40', '7', '6.5', '25'], ['41', '8', '7', '26'], ['42', '8.5', '7.5', '26.5'], ['43', '9.5', '8.5', '27.5'], ['44', '10', '9', '28']],
    note: 'Đo chiều dài bàn chân vào buổi chiều; chân bè nên tăng nửa size.',
  },
  GLOVE: {
    head: ['Size', 'Chu vi bàn tay (cm)', 'Dài bàn tay (cm)'],
    rows: [['7', '17–18', '17'], ['8', '19–20', '18'], ['9', '21–22', '19'], ['10', '23–24', '20']],
    note: 'Đo chu vi lòng bàn tay ở chỗ rộng nhất, không tính ngón cái.',
  },
};

let product;
const selection = { sizeId: null, colorId: null, qty: 1 };

const variantOf = (sizeId, colorId) => product.variants.find((v) => v.size.id === sizeId && v.color.id === colorId);
const available = (sizeId, colorId) => (variantOf(sizeId, colorId)?.stockQuantity ?? 0) > 0;

// ───────── Gallery ─────────
function galleryItems() {
  const colorImages = product.images.filter((img) => !img.colorId || img.colorId === selection.colorId);
  const list = (colorImages.length ? colorImages : product.images).map((img) => ({ type: 'img', url: img.url, alt: img.alt ?? product.name }));
  if (list.length) return list;
  // Chưa có ảnh thật: mặt trước + mặt sau vẽ bằng SVG
  const color = product.colors.find((c) => c.id === selection.colorId) ?? product.colors[0];
  const art = (view) => productArt(product, { view, ...(view === 'back' && { name: product.playerName ?? 'JERSEY', number: product.playerNumber ?? 10 }) }, color);
  return [{ type: 'svg', svg: art('front') }, { type: 'svg', svg: art('back') }];
}

function renderGallery(index = 0) {
  const items = galleryItems();
  const current = items[Math.min(index, items.length - 1)];
  $('[data-gallery-main]').innerHTML =
    (current.type === 'img' ? html`<img src="${current.url}" alt="${current.alt}">` : current.svg) +
    html`<span class="product-badges">${product.discountPercent > 0 ? raw(`<span class="badge badge-sale">-${product.discountPercent}%</span>`) : ''}${product.inStock ? '' : raw('<span class="badge badge-soldout">Hết hàng</span>')}</span>`;
  $('[data-gallery-thumbs]').innerHTML = items
    .map((item, i) =>
      html`<button type="button" class="gallery-thumb" data-thumb="${i}" aria-current="${String(i === index)}" aria-label="Ảnh ${i + 1}">${raw(item.type === 'img' ? html`<img src="${item.url}" alt="">` : item.svg)}</button>`,
    )
    .join('');
}

// ───────── Chọn biến thể ─────────
function renderOptions() {
  const selectedVariant = selection.sizeId && selection.colorId ? variantOf(selection.sizeId, selection.colorId) : null;
  const color = product.colors.find((c) => c.id === selection.colorId);
  const size = product.sizes.find((s) => s.id === selection.sizeId);

  $('[data-price]').innerHTML = priceHtml(selectedVariant ?? product);

  $('[data-colors]').innerHTML = html`
    <div class="pdp-block-head"><span>Màu: <b>${color?.name ?? 'Chọn màu'}</b></span></div>
    <div class="color-swatches" role="radiogroup" aria-label="Màu sắc">${product.colors.map((c) =>
      raw(html`<button type="button" class="color-swatch" role="radio" style="background:${c.hex}" data-color="${c.id}" aria-checked="${String(c.id === selection.colorId)}" aria-label="${c.name}" title="${c.name}" ${product.sizes.some((s) => available(s.id, c.id)) ? '' : raw('disabled')}></button>`),
    )}</div>`;

  $('[data-sizes]').innerHTML = html`
    <div class="pdp-block-head"><span>Size: <b>${size?.name ?? 'Chọn size'}</b></span>${SIZE_CHART[product.sizes[0]?.sizeType] ? raw('<button type="button" data-open-size-guide>Bảng size</button>') : ''}</div>
    <div class="size-chips" role="radiogroup" aria-label="Kích thước">${product.sizes.map((s) =>
      raw(html`<button type="button" class="size-chip" role="radio" data-size="${s.id}" aria-pressed="${String(s.id === selection.sizeId)}" ${selection.colorId && !available(s.id, selection.colorId) ? raw('disabled title="Hết hàng"') : ''}>${s.name}</button>`),
    )}</div>`;

  const stock = selectedVariant?.stockQuantity;
  const line = $('[data-stock]');
  if (!product.inStock) {
    line.className = 'stock-line out';
    line.innerHTML = `${icon('alert-circle', 16)}Sản phẩm tạm hết hàng`;
  } else if (stock == null) {
    line.className = 'stock-line';
    line.innerHTML = `${icon('info', 16)}Chọn màu và size để xem tình trạng hàng`;
  } else if (stock === 0) {
    line.className = 'stock-line out';
    line.innerHTML = `${icon('alert-circle', 16)}Hết hàng với lựa chọn này`;
  } else if (stock <= LOW_STOCK) {
    line.className = 'stock-line low';
    line.innerHTML = `${icon('clock', 16)}Chỉ còn ${stock} sản phẩm`;
  } else {
    line.className = 'stock-line ok';
    line.innerHTML = `${icon('check-circle', 16)}Còn hàng`;
  }

  // Số lượng không vượt quá tồn kho của biến thể đang chọn
  const max = stock ?? 1;
  selection.qty = Math.max(1, Math.min(selection.qty, max || 1));
  $('[data-qty]').value = selection.qty;
  $('[data-qty-dec]').disabled = selection.qty <= 1;
  $('[data-qty-inc]').disabled = !stock || selection.qty >= stock;
  $('[data-add]').disabled = !stock;
}

function bindInteractions() {
  root.addEventListener('click', (e) => {
    const colorBtn = e.target.closest('[data-color]');
    if (colorBtn && !colorBtn.disabled) {
      selection.colorId = Number(colorBtn.dataset.color);
      // Size đang chọn hết hàng ở màu mới → bỏ chọn size
      if (selection.sizeId && !available(selection.sizeId, selection.colorId)) selection.sizeId = null;
      renderGallery(0);
      renderOptions();
    }
    const sizeBtn = e.target.closest('[data-size]');
    if (sizeBtn && !sizeBtn.disabled) {
      selection.sizeId = Number(sizeBtn.dataset.size);
      renderOptions();
    }
    const thumb = e.target.closest('[data-thumb]');
    if (thumb) renderGallery(Number(thumb.dataset.thumb));
    if (e.target.closest('[data-qty-dec]')) {
      selection.qty -= 1;
      renderOptions();
    }
    if (e.target.closest('[data-qty-inc]')) {
      selection.qty += 1;
      renderOptions();
    }
    if (e.target.closest('[data-open-size-guide]')) {
      const guide = $('[data-size-guide]');
      guide.open = true;
      guide.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (e.target.closest('[data-add]')) {
      if (!selection.sizeId || !selection.colorId) return toast('Vui lòng chọn màu và size', 'error');
      // Giỏ hàng làm ở Phase 3 (Sprint 6)
      toast('Giỏ hàng sẽ có ở Phase 3 — bạn đã chọn đúng biến thể còn hàng.', 'info');
    }
  });
  $('[data-qty]').addEventListener('change', (e) => {
    selection.qty = Number(e.target.value) || 1;
    renderOptions();
  });
}

// ───────── Trang ─────────
function sizeGuideHtml() {
  const chart = SIZE_CHART[product.sizes[0]?.sizeType];
  if (!chart) return '';
  return html`<details data-size-guide>
    <summary>Bảng size${raw(icon('chevron-down', 18))}</summary>
    <div class="acc-body">
      <table class="size-table">
        <thead><tr>${chart.head.map((h) => raw(html`<th>${h}</th>`))}</tr></thead>
        <tbody>${chart.rows.map((r) => raw(html`<tr>${r.map((c) => raw(html`<td>${c}</td>`))}</tr>`))}</tbody>
      </table>
      <p class="cell-sub mt-2">${chart.note}</p>
    </div>
  </details>`;
}

function render() {
  document.title = `${product.name} — JERSEY`;
  const specs = [
    ['Đội bóng', product.team?.name],
    ['Giải đấu', product.team?.league?.name],
    ['Thương hiệu', product.brand?.name],
    ['Loại', product.productType?.name],
    ['Mùa giải', product.season],
    ['Chất liệu', product.material],
    ['Đối tượng', GENDER[product.gender]],
  ].filter(([, v]) => v);

  root.innerHTML = html`
    <div class="pdp">
      <div class="gallery">
        <div class="gallery-thumbs" data-gallery-thumbs></div>
        <div class="gallery-main" data-gallery-main></div>
      </div>

      <div class="pdp-info">
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <a href="/">Trang chủ</a><span>/</span><a href="/products.html?category=${product.category.slug}">${product.category.name}</a>
          ${product.team ? raw(html`<span>/</span><a href="/products.html?team=${product.team.slug}">${product.team.name}</a>`) : ''}
        </nav>
        <p class="eyebrow">${[product.team?.name, product.season].filter(Boolean).join(' · ') || product.category.name}</p>
        <h1 class="display pdp-title">${product.name}</h1>
        <div class="pdp-price" data-price></div>
        ${product.promotion ? raw(html`<p class="promo-note">${raw(icon('percent', 14))}${product.promotion.name} — đến ${formatDate(product.promotion.endAt)}</p>`) : ''}

        <div class="pdp-block" data-colors></div>
        <div class="pdp-block" data-sizes></div>
        <p class="stock-line" data-stock></p>

        <div class="buy-row">
          <div class="qty">
            <button type="button" data-qty-dec aria-label="Giảm số lượng">−</button>
            <input type="number" min="1" value="1" data-qty aria-label="Số lượng">
            <button type="button" data-qty-inc aria-label="Tăng số lượng">+</button>
          </div>
          <button class="btn btn-primary" type="button" data-add>${raw(icon('bag', 18))}Thêm vào giỏ hàng</button>
        </div>

        <div class="pdp-perks">
          <span>${raw(icon('badge-check', 18))}Hàng chính hãng 100%, đầy đủ tem mác</span>
          <span>${raw(icon('truck', 18))}Giao nhanh 2–4 ngày, miễn phí cho đơn từ 500K</span>
          <span>${raw(icon('rotate-ccw', 18))}Đổi size miễn phí trong 30 ngày</span>
        </div>

        <div class="accordion pdp-block">
          <details open>
            <summary>Mô tả sản phẩm${raw(icon('chevron-down', 18))}</summary>
            <div class="acc-body">${product.description ?? 'Đang cập nhật mô tả.'}</div>
          </details>
          <details>
            <summary>Thông số${raw(icon('chevron-down', 18))}</summary>
            <div class="acc-body"><dl class="spec-list">${specs.map(([k, v]) => raw(html`<dt>${k}</dt><dd>${v}</dd>`))}</dl></div>
          </details>
          ${raw(sizeGuideHtml())}
        </div>
      </div>
    </div>`;

  // Chọn sẵn màu đầu tiên còn hàng; chỉ có 1 size thì chọn luôn
  selection.colorId = product.colors.find((c) => product.sizes.some((s) => available(s.id, c.id)))?.id ?? product.colors[0]?.id ?? null;
  if (product.sizes.length === 1 && available(product.sizes[0].id, selection.colorId)) selection.sizeId = product.sizes[0].id;

  renderGallery(0);
  renderOptions();
  bindInteractions();

  if (product.related.length) {
    $('[data-related-section]').hidden = false;
    $('[data-related]').innerHTML = product.related.map(productCard).join('');
  }
}

try {
  const slug = getParam('slug');
  if (!slug) throw new Error('Thiếu đường dẫn sản phẩm');
  product = (await api.get(`/products/${encodeURIComponent(slug)}`)).data;
  render();
} catch (err) {
  root.innerHTML = `<div class="section">${emptyState('shirt', 'Không tìm thấy sản phẩm', err.message)}</div>`;
}
