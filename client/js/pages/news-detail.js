import { api } from '../api.js';
import { jerseySvg } from '../jersey.js';
import { initPage } from '../layout.js';
import { newsCard } from '../news-card.js';
import { $, emptyState, formatDate, getParam, html, raw } from '../ui.js';

initPage();

const container = $('[data-article]');
const slug = getParam('slug');

// Nội dung lưu dạng văn bản thuần: mỗi đoạn cách nhau một dòng trống (không render HTML từ DB)
const paragraphs = (text) =>
  text
    .split(/\n{2,}|\r\n\r\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => raw(html`<p>${p}</p>`));

async function load() {
  if (!slug) throw new Error('Thiếu đường dẫn bài viết');
  const { data } = await api.get(`/news/${encodeURIComponent(slug)}`);
  document.title = `${data.title} — JERSEY`;

  const cover = data.thumbnailUrl
    ? html`<img src="${data.thumbnailUrl}" alt="${data.title}">`
    : jerseySvg({ primary: '#0B1220', secondary: '#FFB709', label: '' });

  container.innerHTML = html`
    <header class="article-head">
      <nav class="breadcrumb justify-content-center" aria-label="Breadcrumb">
        <a href="/">Trang chủ</a><span>/</span><a href="/news.html">Tin tức</a>
        ${data.categories[0] ? raw(html`<span>/</span><a href="/news.html?category=${data.categories[0].slug}">${data.categories[0].name}</a>`) : ''}
      </nav>
      <h1 class="display">${data.title}</h1>
      <div class="article-meta">
        <span>${formatDate(data.publishedAt)}</span>
        ${data.authorName ? raw(html`<span>·</span><span>${data.authorName}</span>`) : ''}
      </div>
    </header>
    <div class="article-cover">${raw(cover)}</div>
    ${data.summary ? raw(html`<p class="article-summary">${data.summary}</p>`) : ''}
    <div class="article-body">${paragraphs(data.content)}</div>`;

  if (data.related.length) {
    $('[data-related-section]').hidden = false;
    $('[data-related]').innerHTML = data.related.map((n, i) => `<div class="col-12 col-md-6 col-lg-4">${newsCard(n, i + 1)}</div>`).join('');
  }
}

load().catch((err) => {
  container.innerHTML = `<div class="section">${emptyState('newspaper', 'Không tìm thấy bài viết', err.message)}</div>`;
});
