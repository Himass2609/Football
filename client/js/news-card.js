import { jerseySvg } from './jersey.js';
import { formatDate, html, raw } from './ui.js';

// Màu minh họa luân phiên khi bài viết chưa có ảnh đại diện
const PLACEHOLDER_KITS = [
  { primary: '#0B1220', secondary: '#FFB709' },
  { primary: '#FFFFFF', secondary: '#0B1220' },
  { primary: '#C8102E', secondary: '#FFFFFF' },
];

export function newsCard(item, index = 0) {
  const thumb = item.thumbnailUrl
    ? html`<img src="${item.thumbnailUrl}" alt="" loading="lazy">`
    : jerseySvg({ ...PLACEHOLDER_KITS[index % PLACEHOLDER_KITS.length], label: '' });
  return html`
    <a class="news-card" href="/news-detail.html?slug=${encodeURIComponent(item.slug)}">
      <div class="news-thumb">${raw(thumb)}</div>
      <div class="news-meta">
        ${item.categories?.[0] ? raw(html`<span class="cat">${item.categories[0].name}</span>`) : ''}
        <span>${formatDate(item.publishedAt)}</span>
      </div>
      <h3 class="news-title">${item.title}</h3>
      ${item.summary ? raw(html`<p class="news-summary">${item.summary}</p>`) : ''}
    </a>`;
}
