import { api } from '../api.js';
import { initPage } from '../layout.js';
import { productCard, productSkeleton } from '../product-card.js';
import { $, $$, debounce, emptyState, formatCurrency, html, icon, raw, renderPagination } from '../ui.js';

initPage();

const PAGE_SIZE = 12;
const SINGLE = ['category', 'team', 'brand', 'league', 'type'];
const MULTI = ['sizes', 'colors'];
const PRICE_PRESETS = [
  [0, 500000, 'Dưới 500K'],
  [500000, 800000, '500K – 800K'],
  [800000, 1200000, '800K – 1,2 triệu'],
  [1200000, null, 'Trên 1,2 triệu'],
];

// ───────── Trạng thái lấy từ URL để chia sẻ / quay lại được ─────────
function readState() {
  const p = new URLSearchParams(location.search);
  const ids = (key) => (p.get(key) ?? '').split(',').filter((v) => /^\d+$/.test(v)).map(Number);
  return {
    q: p.get('q') ?? '',
    ...Object.fromEntries(SINGLE.map((k) => [k, p.get(k) ?? ''])),
    sizes: ids('sizes'),
    colors: ids('colors'),
    minPrice: p.get('minPrice') ?? '',
    maxPrice: p.get('maxPrice') ?? '',
    inStock: p.get('inStock') === 'true',
    onSale: p.get('onSale') === 'true',
    sort: p.get('sort') ?? 'newest',
    page: Number(p.get('page')) || 1,
  };
}

let state = readState();
let lookups = { categories: [], teams: [], brands: [], sizes: [], colors: [], leagues: [] };

function toQuery(s = state) {
  return {
    q: s.q,
    ...Object.fromEntries(SINGLE.map((k) => [k, s[k]])),
    sizes: s.sizes.join(','),
    colors: s.colors.join(','),
    minPrice: s.minPrice,
    maxPrice: s.maxPrice,
    inStock: s.inStock ? 'true' : '',
    onSale: s.onSale ? 'true' : '',
    sort: s.sort === 'newest' ? '' : s.sort,
    page: s.page > 1 ? s.page : '',
  };
}

function update(patch, { resetPage = true } = {}) {
  state = { ...state, ...patch, ...(resetPage && { page: 1 }) };
  const url = new URL(location.pathname, location.origin);
  for (const [k, v] of Object.entries(toQuery())) if (v) url.searchParams.set(k, v);
  history.pushState(null, '', url);
  render();
}

window.addEventListener('popstate', () => {
  state = readState();
  render();
});

// ───────── Bộ lọc ─────────
const option = (key, item, label = item.name, extra = '') =>
  html`<button type="button" class="filter-option" data-single="${key}" data-value="${item.slug}" aria-pressed="${String(state[key] === item.slug)}">${raw(extra)}${label}</button>`;

function group(title, key, body, active) {
  return html`<div class="filter-group">
    <p class="filter-title">${title}${active ? raw(html`<button type="button" data-clear="${key}">Bỏ chọn</button>`) : ''}</p>
    ${raw(body)}
  </div>`;
}

function renderFilters() {
  const { categories, teams, brands, sizes, colors, leagues } = lookups;
  const sizeGroups = [
    ['ADULT', 'Người lớn'],
    ['KID', 'Trẻ em'],
    ['SHOE', 'Giày'],
    ['GLOVE', 'Găng tay'],
    ['ONE', 'Phụ kiện'],
  ];

  $('[data-filter-groups]').innerHTML = [
    group('Danh mục', 'category', `<div class="filter-list">${categories.filter((c) => !c.parentId).map((c) => option('category', c)).join('')}</div>`, state.category),
    group(
      'Đội bóng',
      'team',
      html`<input class="input filter-search" type="search" placeholder="Tìm đội..." data-team-search aria-label="Tìm đội bóng">
        <div class="filter-list" data-team-list>${teams.map((t) => raw(option('team', t, t.name, `<span class="team-dot" style="background:${t.primaryColor}"></span>`)))}</div>`,
      state.team,
    ),
    group(
      'Giải đấu',
      'league',
      html`<div class="filter-list">${leagues.map((l) =>
        raw(option('league', l, l.name, l.logoUrl ? html`<img class="league-logo" src="${l.logoUrl}" alt="">` : '')),
      )}</div>`,
      state.league,
    ),
    group('Thương hiệu', 'brand', `<div class="filter-list">${brands.map((b) => option('brand', b)).join('')}</div>`, state.brand),
    group(
      'Kích thước',
      'sizes',
      sizeGroups
        .map(([type, label]) => {
          const list = sizes.filter((s) => s.sizeType === type);
          return list.length
            ? html`<p class="cell-sub mb-2 mt-2">${label}</p><div class="size-chips">${list.map((s) =>
                raw(html`<button type="button" class="size-chip" data-multi="sizes" data-value="${s.id}" aria-pressed="${String(state.sizes.includes(s.id))}">${s.name}</button>`),
              )}</div>`
            : '';
        })
        .join(''),
      state.sizes.length,
    ),
    group(
      'Màu sắc',
      'colors',
      html`<div class="color-swatches">${colors.map((c) =>
        raw(html`<button type="button" class="color-swatch" style="background:${c.hex}" data-multi="colors" data-value="${c.id}" aria-pressed="${String(state.colors.includes(c.id))}" aria-label="${c.name}" title="${c.name}"></button>`),
      )}</div>`,
      state.colors.length,
    ),
    group(
      'Khoảng giá',
      'price',
      html`<form class="price-inputs" data-price-form>
          <input class="input" type="number" min="0" step="10000" name="minPrice" placeholder="Từ" value="${state.minPrice}" aria-label="Giá từ">
          <span class="text-muted-c">–</span>
          <input class="input" type="number" min="0" step="10000" name="maxPrice" placeholder="Đến" value="${state.maxPrice}" aria-label="Giá đến">
          <button class="btn btn-dark btn-sm mt-2" type="submit" style="grid-column:1/-1">Áp dụng</button>
        </form>
        <div class="price-presets">${PRICE_PRESETS.map(([min, max, label]) =>
          raw(html`<button type="button" class="chip" data-price="${min}|${max ?? ''}" aria-pressed="${String(String(min) === String(state.minPrice || 0) && String(max ?? '') === state.maxPrice)}">${label}</button>`),
        )}</div>`,
      state.minPrice || state.maxPrice,
    ),
    group(
      'Tình trạng',
      'status',
      html`<label class="switch mb-3"><input type="checkbox" data-toggle="inStock" ${state.inStock ? raw('checked') : ''}><span>Chỉ hiện hàng còn</span></label>
        <label class="switch"><input type="checkbox" data-toggle="onSale" ${state.onSale ? raw('checked') : ''}><span>Đang giảm giá</span></label>`,
      false,
    ),
  ].join('');
}

const filtersEl = $('[data-filters]');
filtersEl.addEventListener('click', (e) => {
  const single = e.target.closest('[data-single]');
  if (single) {
    const { single: key, value } = single.dataset;
    return update({ [key]: state[key] === value ? '' : value });
  }
  const multi = e.target.closest('[data-multi]');
  if (multi) {
    const key = multi.dataset.multi;
    const value = Number(multi.dataset.value);
    const list = state[key].includes(value) ? state[key].filter((v) => v !== value) : [...state[key], value];
    return update({ [key]: list });
  }
  const preset = e.target.closest('[data-price]');
  if (preset) {
    const [min, max] = preset.dataset.price.split('|');
    return update({ minPrice: min === '0' ? '' : min, maxPrice: max });
  }
  const clear = e.target.closest('[data-clear]');
  if (clear) {
    const key = clear.dataset.clear;
    return update(key === 'price' ? { minPrice: '', maxPrice: '' } : { [key]: MULTI.includes(key) ? [] : '' });
  }
});
filtersEl.addEventListener('change', (e) => {
  const toggle = e.target.closest('[data-toggle]');
  if (toggle) update({ [toggle.dataset.toggle]: toggle.checked });
});
filtersEl.addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;
  update({ minPrice: form.elements.minPrice.value, maxPrice: form.elements.maxPrice.value });
});
filtersEl.addEventListener('input', (e) => {
  if (!e.target.matches('[data-team-search]')) return;
  const term = e.target.value.trim().toLowerCase();
  $$('[data-team-list] .filter-option').forEach((btn) => (btn.hidden = term && !btn.textContent.toLowerCase().includes(term)));
});

// Ngăn kéo bộ lọc trên mobile
const backdrop = $('.filters-backdrop');
const toggleFilters = (open) => {
  filtersEl.classList.toggle('open', open);
  backdrop.hidden = !open;
  document.body.style.overflow = open ? 'hidden' : '';
};
$('[data-filters-open]').addEventListener('click', () => toggleFilters(true));
$$('[data-filters-close]').forEach((el) => el.addEventListener('click', () => toggleFilters(false)));

// ───────── Toolbar ─────────
const searchInput = $('[data-search]');
searchInput.addEventListener('input', debounce((e) => update({ q: e.target.value.trim() }), 400));
$('[data-sort]').addEventListener('change', (e) => update({ sort: e.target.value }));

function activeChips() {
  const find = (list, key, value) => list.find((x) => x[key] === value)?.name ?? value;
  const chips = [
    state.q && ['q', `“${state.q}”`],
    state.category && ['category', find(lookups.categories, 'slug', state.category)],
    state.team && ['team', find(lookups.teams, 'slug', state.team)],
    state.league && ['league', find(lookups.leagues, 'slug', state.league)],
    state.brand && ['brand', find(lookups.brands, 'slug', state.brand)],
    state.type && ['type', state.type],
    ...state.sizes.map((id) => [`sizes:${id}`, `Size ${find(lookups.sizes, 'id', id)}`]),
    ...state.colors.map((id) => [`colors:${id}`, find(lookups.colors, 'id', id)]),
    (state.minPrice || state.maxPrice) && ['price', `${state.minPrice ? formatCurrency(state.minPrice) : '0₫'} – ${state.maxPrice ? formatCurrency(state.maxPrice) : '∞'}`],
    state.inStock && ['inStock', 'Còn hàng'],
    state.onSale && ['onSale', 'Đang giảm giá'],
  ].filter(Boolean);
  return chips;
}

$('[data-result-line]').addEventListener('click', (e) => {
  if (e.target.closest('[data-clear-all]')) {
    searchInput.value = '';
    return update({ q: '', category: '', team: '', brand: '', league: '', type: '', sizes: [], colors: [], minPrice: '', maxPrice: '', inStock: false, onSale: false });
  }
  const chip = e.target.closest('[data-remove]');
  if (!chip) return;
  const [key, id] = chip.dataset.remove.split(':');
  if (key === 'q') searchInput.value = '';
  if (id) return update({ [key]: state[key].filter((v) => v !== Number(id)) });
  if (key === 'price') return update({ minPrice: '', maxPrice: '' });
  update({ [key]: typeof state[key] === 'boolean' ? false : '' });
});

// Tiêu đề trang theo bộ lọc chính
function renderHeading() {
  const team = lookups.teams.find((t) => t.slug === state.team);
  const category = lookups.categories.find((c) => c.slug === state.category);
  const title = team?.name ?? category?.name ?? (state.q ? `Kết quả cho “${state.q}”` : 'Cửa hàng');
  $('[data-title]').textContent = title;
  $('[data-subtitle]').textContent = category?.description ?? (team ? `Áo đấu và phụ kiện chính hãng của ${team.name}.` : 'Áo đấu chính hãng của các câu lạc bộ và đội tuyển hàng đầu.');
  document.title = `${title} — JERSEY`;
}

// ───────── Tải dữ liệu ─────────
let controller;
async function render() {
  searchInput.value = state.q;
  $('[data-sort]').value = state.sort;
  renderFilters();
  renderHeading();

  const grid = $('[data-grid]');
  grid.innerHTML = productSkeleton(PAGE_SIZE / 2);
  controller?.abort();
  controller = new AbortController();

  try {
    const { data, meta } = await api.get('/products', { ...toQuery(), sort: state.sort, page: state.page, limit: PAGE_SIZE }, { signal: controller.signal });
    const chips = activeChips();
    $('[data-result-line]').innerHTML = html`<span><b style="color:var(--c-ink)">${meta.total}</b> sản phẩm</span>
      ${chips.map(([key, label]) => raw(html`<button type="button" class="active-chip" data-remove="${key}">${label}${raw(icon('x', 14))}</button>`))}
      ${chips.length > 1 ? raw('<button type="button" class="clear-all" data-clear-all>Xóa tất cả</button>') : ''}`;

    grid.innerHTML = data.length
      ? data.map(productCard).join('')
      : `<div style="grid-column:1/-1">${emptyState('search', 'Không tìm thấy sản phẩm phù hợp', 'Thử bỏ bớt bộ lọc hoặc đổi từ khóa tìm kiếm.')}</div>`;

    renderPagination($('[data-pagination]'), meta, (page) => {
      update({ page }, { resetPage: false });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  } catch (err) {
    if (err.name === 'AbortError') return;
    grid.innerHTML = `<div style="grid-column:1/-1">${emptyState('alert-circle', 'Không tải được sản phẩm', err.message)}</div>`;
  }
}

const load = async (path, query) => {
  try {
    return (await api.get(path, query)).data;
  } catch {
    return [];
  }
};
const [categories, teams, brands, sizes, colors, leagues] = await Promise.all([
  load('/categories'),
  load('/teams'),
  load('/brands'),
  load('/sizes'),
  load('/colors'),
  load('/leagues'),
]);
lookups = { categories, teams, brands, sizes, colors, leagues };
render();
