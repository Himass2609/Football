import { api } from '../api.js';
import { jerseySvg, teamJersey } from '../jersey.js';
import { initPage } from '../layout.js';
import { newsCard } from '../news-card.js';
import { $, $$, emptyState, formatCurrency, formatDate, html, icon, raw, toast } from '../ui.js';

initPage();

const HERO_KIT = { primary: '#FFFFFF', secondary: '#C9A227', label: 'Áo đấu sân nhà mùa giải 2026/27' };
$('[data-hero-jersey]').innerHTML = jerseySvg(HERO_KIT);

const loadSafely = async (path, query) => {
  try {
    return (await api.get(path, query)).data;
  } catch {
    return null;
  }
};

const [teams, categories, promotions, vouchers, news] = await Promise.all([
  loadSafely('/teams'),
  loadSafely('/categories'),
  loadSafely('/promotions'),
  loadSafely('/vouchers'),
  loadSafely('/news', { limit: 3 }),
]);

const featured = (teams ?? []).filter((t) => t.isFeatured);
const showcase = featured.length ? featured : (teams ?? []).slice(0, 8);

renderTeams(showcase);
renderCategories(categories ?? [], teams ?? []);
renderMatchday(promotions ?? []);
renderCustomizer(showcase);
renderVouchers(vouchers ?? []);
renderNews(news ?? []);

function renderTeams(list) {
  const scroller = $('[data-teams]');
  if (!list.length) {
    scroller.innerHTML = emptyState('shirt', 'Chưa có đội bóng');
    return;
  }
  scroller.innerHTML = list
    .map(
      (team) => html`
        <a class="team-card" href="/products.html?team=${team.slug}">
          <div class="jersey-box">
            ${raw(teamJersey(team))}
            <span class="team-crest" aria-hidden="true">${team.shortName ?? team.name.slice(0, 3)}</span>
          </div>
          <span class="team-name">${team.name}</span>
        </a>`,
    )
    .join('');

  $$('[data-scroll]').forEach((btn) =>
    btn.addEventListener('click', () => {
      scroller.scrollBy({ left: Number(btn.dataset.scroll) * scroller.clientWidth * 0.8, behavior: 'smooth' });
    }),
  );
}

function renderCategories(list, allTeams) {
  const grid = $('[data-categories]');
  const top = list.filter((c) => !c.parentId).slice(0, 5);
  if (!top.length) {
    grid.innerHTML = emptyState('layers', 'Chưa có danh mục');
    return;
  }
  // Mỗi ô danh mục mượn màu áo một đội để minh họa
  const palette = allTeams.length ? allTeams : [{ primaryColor: '#FFFFFF', secondaryColor: '#0B1220', kitPattern: 'PLAIN', name: '' }];
  grid.innerHTML = top
    .map((category, i) => {
      const team = palette[(i * 3 + 1) % palette.length];
      return html`
        <a class="cat-tile" href="/products.html?category=${category.slug}">
          ${raw(teamJersey(team, { label: category.name }))}
          <span class="cat-tile-label">${category.name}${raw(icon('arrow-right', 18))}</span>
        </a>`;
    })
    .join('');
}

function renderMatchday(list) {
  const art = $('[data-matchday-art]');
  art.innerHTML = jerseySvg({ primary: '#111111', secondary: '#FFB709', view: 'back', name: 'JERSEY', number: 26, label: '' });

  const promo = list[0];
  if (!promo) return;
  const value = promo.discountType === 'PERCENT' ? `-${promo.discountValue}%` : `-${formatCurrency(promo.discountValue)}`;
  $('[data-promo-eyebrow]').textContent = `${promo.name} · ${value}`;
  $('[data-promo-desc]').textContent = promo.description ?? `Ưu đãi kết thúc ngày ${formatDate(promo.endAt)}`;

  const box = $('[data-countdown]');
  box.hidden = false;
  const end = new Date(promo.endAt).getTime();
  const units = Object.fromEntries($$('[data-unit]', box).map((el) => [el.dataset.unit, el]));
  const pad = (n) => String(n).padStart(2, '0');
  const tick = () => {
    const left = Math.max(0, end - Date.now());
    units.d.textContent = pad(Math.floor(left / 86400000));
    units.h.textContent = pad(Math.floor((left / 3600000) % 24));
    units.m.textContent = pad(Math.floor((left / 60000) % 60));
    units.s.textContent = pad(Math.floor((left / 1000) % 60));
    if (left === 0) clearInterval(timer);
  };
  const timer = setInterval(tick, 1000);
  tick();
}

function renderCustomizer(list) {
  const form = $('[data-custom-form]');
  const preview = $('[data-custom-preview]');
  const swatches = $('[data-custom-teams]');
  const cta = $('[data-custom-cta]');
  if (!list.length) return;

  let current = list[0];
  swatches.innerHTML = list
    .map(
      (team, i) => html`<button type="button" class="team-swatch" data-team="${i}" aria-pressed="${String(i === 0)}"
        aria-label="${team.name}" title="${team.name}"
        style="background:linear-gradient(135deg, ${raw(team.primaryColor)} 50%, ${raw(team.secondaryColor)} 50%)"></button>`,
    )
    .join('');

  const draw = () => {
    const name = form.elements.name.value.trim();
    const number = form.elements.number.value.replace(/\D/g, '').slice(0, 2);
    form.elements.number.value = number;
    preview.innerHTML = teamJersey(current, { view: 'back', name, number, label: `Áo ${current.name} in tên ${name} số ${number}` });
    cta.href = `/products.html?team=${encodeURIComponent(current.slug)}`;
  };

  swatches.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-team]');
    if (!btn) return;
    current = list[Number(btn.dataset.team)];
    $$('[data-team]', swatches).forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    draw();
  });
  form.addEventListener('input', draw);
  form.addEventListener('submit', (e) => e.preventDefault());
  draw();
}

function renderVouchers(list) {
  if (!list.length) return;
  $('[data-voucher-section]').hidden = false;
  $('[data-vouchers]').innerHTML = list
    .slice(0, 3)
    .map((v) => {
      const value = v.discountType === 'PERCENT' ? `${v.discountValue}%` : `${Math.round(v.discountValue / 1000)}K`;
      return html`
        <div class="col-12 col-md-6 col-lg-4">
          <article class="voucher">
            <div class="voucher-value"><div>${value}<small>GIẢM</small></div></div>
            <div class="voucher-body">
              <p class="voucher-code">${v.code}</p>
              <p class="voucher-desc">${v.description ?? ''}</p>
              <div class="voucher-foot">
                <span>HSD: ${formatDate(v.endAt)}</span>
                <button class="btn btn-outline btn-sm" type="button" data-copy="${v.code}">${raw(icon('copy', 14))}Sao chép</button>
              </div>
            </div>
          </article>
        </div>`;
    })
    .join('');

  $('[data-vouchers]').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      toast(`Đã sao chép mã ${btn.dataset.copy}`, 'success');
    } catch {
      toast(`Mã của bạn: ${btn.dataset.copy}`, 'info');
    }
  });
}

function renderNews(list) {
  const row = $('[data-news]');
  row.innerHTML = list.length
    ? list.map((item, i) => `<div class="col-12 col-md-6 col-lg-4">${newsCard(item, i)}</div>`).join('')
    : `<div class="col-12">${emptyState('newspaper', 'Chưa có bài viết')}</div>`;
}
