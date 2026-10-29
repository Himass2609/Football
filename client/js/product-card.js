import { jerseySvg, teamJersey } from './jersey.js';
import { formatCurrency, html, raw } from './ui.js';

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const colorDistance = (a, b) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));

/**
 * Ảnh minh họa khi sản phẩm chưa có ảnh thật.
 * Màu sản phẩm gần màu đội (áo sân nhà) → vẽ đúng mẫu áo đội (sọc, viền);
 * khác hẳn (áo sân khách, đồ tập) → vẽ theo màu sản phẩm, lấy màu đội làm viền.
 */
export function productArt(product, options = {}, color = product.colors?.[0]) {
  const hex = color?.hex ?? '#FFFFFF';
  const team = product.team;
  if (team && (!color || colorDistance(hex, team.primaryColor) < 90)) {
    return teamJersey(team, { label: product.name, ...options });
  }
  const trim = team
    ? [team.primaryColor, team.secondaryColor].sort((a, b) => colorDistance(b, hex) - colorDistance(a, hex))[0]
    : hex.toUpperCase() === '#FFFFFF' ? '#0B1220' : '#FFFFFF';
  return jerseySvg({ primary: hex, secondary: trim, label: product.name, ...options });
}

export const crest = (team) =>
  team.logoUrl ? html`<img src="${team.logoUrl}" alt="">` : html`${team.shortName ?? team.name.slice(0, 3)}`;

export function priceHtml(p, size = '') {
  const sale = p.price < p.originalPrice;
  return html`<div class="price ${size}">
    <span class="price-now ${sale ? 'is-sale' : ''}">${formatCurrency(p.price)}</span>
    ${sale ? raw(html`<span class="price-was">${formatCurrency(p.originalPrice)}</span><span class="price-off">-${p.discountPercent}%</span>`) : ''}
  </div>`;
}

export function productCard(p) {
  const media = p.image
    ? html`<img src="${p.image}" alt="${p.name}" loading="lazy">${p.hoverImage ? raw(html`<img class="img-hover" src="${p.hoverImage}" alt="" loading="lazy">`) : ''}`
    : productArt(p);
  const meta = [p.team?.name ?? p.category?.name, p.season].filter(Boolean).join(' · ');

  return html`
    <article class="product-card ${p.inStock ? '' : 'is-soldout'}">
      <a class="product-media" href="/product.html?slug=${encodeURIComponent(p.slug)}" aria-label="${p.name}">
        ${raw(media)}
        <span class="product-badges">
          ${p.isNew ? raw('<span class="badge badge-accent">New</span>') : ''}
          ${p.discountPercent > 0 ? raw(`<span class="badge badge-sale">-${p.discountPercent}%</span>`) : ''}
          ${p.inStock ? '' : raw('<span class="badge badge-soldout">Hết hàng</span>')}
        </span>
        ${p.team ? raw(html`<span class="product-crest" aria-hidden="true">${raw(crest(p.team))}</span>`) : ''}
      </a>
      <div class="product-info">
        ${meta ? raw(html`<span class="product-meta">${meta}</span>`) : ''}
        <a class="product-name" href="/product.html?slug=${encodeURIComponent(p.slug)}">${p.name}</a>
        ${raw(priceHtml(p))}
        ${p.colors?.length > 1
          ? raw(html`<span class="product-swatches" aria-label="${p.colors.length} màu">${p.colors.slice(0, 4).map((c) => raw(html`<i style="background:${c.hex}" title="${c.name}"></i>`))}${p.colors.length > 4 ? raw(html`<span>+${p.colors.length - 4}</span>`) : ''}</span>`)
          : ''}
      </div>
    </article>`;
}

export const productSkeleton = (count = 4) =>
  Array.from({ length: count }, () => '<div><div class="skeleton" style="aspect-ratio:4/5"></div><div class="skeleton mt-3" style="height:14px;width:60%"></div><div class="skeleton mt-2" style="height:18px;width:80%"></div></div>').join('');
