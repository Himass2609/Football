import { api } from '../api.js';
import { initPage } from '../layout.js';
import { newsCard } from '../news-card.js';
import { $, debounce, emptyState, getParam, html, renderPagination } from '../ui.js';

initPage();

const state = { category: getParam('category') ?? '', q: '', page: 1 };
const list = $('[data-list]');
const chips = $('[data-categories]');

function syncUrl() {
  const url = new URL(location.href);
  state.category ? url.searchParams.set('category', state.category) : url.searchParams.delete('category');
  history.replaceState(null, '', url);
}

async function loadCategories() {
  try {
    const { data } = await api.get('/news-categories');
    chips.innerHTML = [{ slug: '', name: 'Tất cả' }, ...data]
      .map((c) => html`<button class="chip" type="button" data-slug="${c.slug}" aria-pressed="${String(c.slug === state.category)}">${c.name}</button>`)
      .join('');
  } catch {
    chips.innerHTML = '';
  }
}

async function load() {
  list.innerHTML = Array.from({ length: 3 }, () => '<div class="col-12 col-md-6 col-lg-4"><div class="skeleton" style="aspect-ratio:16/10"></div><div class="skeleton mt-3" style="height:20px;width:70%"></div></div>').join('');
  try {
    const { data, meta } = await api.get('/news', { category: state.category, q: state.q, page: state.page, limit: 9 });
    list.innerHTML = data.length
      ? data.map((item, i) => `<div class="col-12 col-md-6 col-lg-4">${newsCard(item, i)}</div>`).join('')
      : `<div class="col-12">${emptyState('newspaper', 'Không có bài viết phù hợp', 'Thử chọn chuyên mục khác hoặc đổi từ khóa tìm kiếm.')}</div>`;
    renderPagination($('[data-pagination]'), meta, (page) => {
      state.page = page;
      load();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  } catch (err) {
    list.innerHTML = `<div class="col-12">${emptyState('alert-circle', 'Không tải được bài viết', err.message)}</div>`;
  }
}

chips.addEventListener('click', (e) => {
  const chip = e.target.closest('[data-slug]');
  if (!chip) return;
  state.category = chip.dataset.slug;
  state.page = 1;
  chips.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
  syncUrl();
  load();
});

$('[data-search]').addEventListener(
  'input',
  debounce((e) => {
    state.q = e.target.value.trim();
    state.page = 1;
    load();
  }, 350),
);

loadCategories();
load();
