// Header, footer, menu mobile — gắn vào mọi trang storefront
import { api } from './api.js';
import { getUser, isAdmin, logout } from './auth.js';
import { hydrateIcons } from './icons-auto.js';
import { $, escapeHtml, html, icon, raw, togglePasswordButtons } from './ui.js';

const NAV = [
  { href: '/products.html', label: 'Cửa hàng' },
  { href: '/products.html', label: 'Đội bóng', mega: true },
  { href: '/products.html?sort=newest', label: 'Hàng mới' },
  { href: '/news.html', label: 'Tin tức' },
];

const LOGO = html`<a class="logo" href="/" aria-label="JERSEY — Trang chủ">
  <span class="logo-mark">${raw(icon('shirt', 18))}</span>JERSEY</a>`;

const isCurrent = (href) => {
  const path = href.split('?')[0];
  return path !== '/products.html' && location.pathname === path;
};

function accountMenu() {
  const user = getUser();
  if (!user) {
    return html`<a class="icon-btn" href="/login.html" aria-label="Đăng nhập">${raw(icon('user'))}</a>`;
  }
  return html`
    <div class="dropdown" data-dropdown>
      <button class="icon-btn" type="button" aria-haspopup="true" aria-expanded="false" aria-label="Tài khoản">${raw(icon('user'))}</button>
      <div class="dropdown-menu" hidden>
        <div class="dropdown-header">
          <p class="cell-main">${user.fullName}</p>
          <p class="cell-sub">${user.email}</p>
        </div>
        ${isAdmin() ? raw(`<a class="dropdown-item" href="/admin/">${icon('dashboard', 18)}Trang quản trị</a>`) : ''}
        <a class="dropdown-item" href="/account.html">${raw(icon('user', 18))}Tài khoản của tôi</a>
        <a class="dropdown-item" href="/account.html#orders">${raw(icon('bag', 18))}Đơn hàng</a>
        <button class="dropdown-item" type="button" data-logout>${raw(icon('log-out', 18))}Đăng xuất</button>
      </div>
    </div>`;
}

function headerHtml() {
  return html`
    <div class="topbar" role="note">
      <span>Mùa giải mới 2026/27</span><i class="dot"></i>
      <span>Miễn phí giao hàng từ 500K</span><i class="dot"></i>
      <span>100% hàng chính hãng</span>
    </div>
    <header class="site-header">
      <div class="container header-inner">
        <div class="d-flex align-items-center gap-2">
          <button class="icon-btn menu-toggle" type="button" aria-label="Mở menu" data-drawer-open>${raw(icon('menu'))}</button>
          ${raw(LOGO)}
        </div>
        <nav class="main-nav" aria-label="Điều hướng chính">
          ${NAV.map((item) =>
            raw(
              item.mega
                ? html`<div class="nav-item">
                    <a class="nav-link" href="${item.href}">${item.label}${raw(icon('chevron-down', 14))}</a>
                    <div class="mega" data-mega><p class="text-small text-muted-c">Đang tải đội bóng...</p></div>
                  </div>`
                : html`<a class="nav-link" href="${item.href}" ${isCurrent(item.href) ? raw('aria-current="page"') : ''}>${item.label}</a>`,
            ),
          )}
        </nav>
        <div class="header-actions">
          <a class="icon-btn" href="/products.html" aria-label="Tìm kiếm">${raw(icon('search'))}</a>
          <span data-account>${raw(accountMenu())}</span>
          <a class="icon-btn hide-mobile" href="/account.html#wishlist" aria-label="Yêu thích">${raw(icon('heart'))}</a>
          <a class="icon-btn" href="/cart.html" aria-label="Giỏ hàng">${raw(icon('bag'))}<span class="cart-count" data-cart-count hidden>0</span></a>
        </div>
      </div>
    </header>
    <div class="drawer" data-drawer aria-hidden="true">
      <div class="drawer-backdrop" data-drawer-close></div>
      <aside class="drawer-panel" aria-label="Menu">
        <div class="drawer-head">${raw(LOGO)}<button class="icon-btn" type="button" aria-label="Đóng menu" data-drawer-close>${raw(icon('x'))}</button></div>
        <div class="drawer-body">
          ${NAV.map((item) => raw(html`<a class="drawer-link" href="${item.href}">${item.label}${raw(icon('arrow-right', 18))}</a>`))}
          <a class="drawer-link" href="${getUser() ? '/account.html' : '/login.html'}">${getUser() ? 'Tài khoản' : 'Đăng nhập'}${raw(icon('arrow-right', 18))}</a>
        </div>
      </aside>
    </div>`;
}

function footerHtml() {
  const col = (title, links) => html`
    <div class="col-6 col-md-3 col-lg-2">
      <p class="footer-title">${title}</p>
      <ul class="footer-links">${links.map(([label, href]) => raw(html`<li><a href="${href}">${label}</a></li>`))}</ul>
    </div>`;
  return html`
    <footer class="site-footer on-dark">
      <div class="container">
        <div class="row g-5">
          <div class="col-12 col-lg-4">
            ${raw(LOGO)}
            <p class="mt-3" style="max-width:320px">Áo đấu bóng đá chính hãng cho người hâm mộ thực thụ. Mặc màu áo bạn yêu — mỗi ngày.</p>
            <div class="socials">
              <a href="#" aria-label="Instagram">${raw(icon('instagram', 16))}</a>
              <a href="#" aria-label="Facebook">${raw(icon('facebook', 16))}</a>
              <a href="#" aria-label="YouTube">${raw(icon('youtube', 16))}</a>
            </div>
          </div>
          ${raw(col('Cửa hàng', [['Hàng mới', '/products.html?sort=newest'], ['Áo câu lạc bộ', '/products.html?category=ao-dau-cau-lac-bo'], ['Áo đội tuyển', '/products.html?category=ao-doi-tuyen-quoc-gia'], ['Áo retro', '/products.html?category=ao-retro']]))}
          ${raw(col('Hỗ trợ', [['Hướng dẫn chọn size', '/news.html?category=huong-dan-chon-size'], ['Giao hàng', '#'], ['Đổi trả 30 ngày', '#'], ['Theo dõi đơn hàng', '/account.html#orders']]))}
          ${raw(col('Về JERSEY', [['Tin tức', '/news.html'], ['Câu chuyện áo đấu', '/news.html?category=cau-chuyen-ao-dau'], ['Cam kết chính hãng', '#'], ['Liên hệ', '#']]))}
          <div class="col-12 col-md-3 col-lg-2">
            <p class="footer-title">Liên hệ</p>
            <ul class="footer-links" data-store-contact><li>hello@jersey.vn</li></ul>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© ${new Date().getFullYear()} JERSEY. Đồ án Chuyên đề tổng hợp — Nhóm 26.</span>
          <div class="pay-methods" aria-label="Phương thức thanh toán"><span>COD</span><span>VISA</span><span>MOMO</span><span>VNPAY</span></div>
        </div>
      </div>
    </footer>`;
}

async function loadMegaMenu(root) {
  const mega = $('[data-mega]', root);
  if (!mega) return;
  try {
    const { data: teams } = await api.get('/teams');
    const groups = new Map();
    for (const team of teams) {
      const key = team.league?.name ?? 'Khác';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(team);
    }
    mega.innerHTML = `<div class="mega-grid">${[...groups]
      .map(
        ([league, list]) => html`<div>
          <p class="eyebrow mega-title">${league}</p>
          <ul class="mega-list">${list.map((t) =>
            raw(html`<li><a href="/products.html?team=${t.slug}"><span class="team-dot" style="background:${raw(t.primaryColor)}"></span>${t.name}</a></li>`),
          )}</ul></div>`,
      )
      .join('')}</div>`;
  } catch {
    mega.innerHTML = '<p class="text-small text-muted-c">Không tải được danh sách đội bóng.</p>';
  }
}

async function loadStoreContact(root) {
  try {
    const { data } = await api.get('/settings');
    const list = $('[data-store-contact]', root);
    list.innerHTML = [data.storeEmail, data.storePhone, data.storeAddress]
      .filter(Boolean)
      .map((v) => `<li>${escapeHtml(v)}</li>`)
      .join('');
  } catch {
    /* giữ giá trị mặc định */
  }
}

function bindInteractions(root) {
  const drawer = $('[data-drawer]', root);
  const toggleDrawer = (open) => {
    drawer.classList.toggle('open', open);
    drawer.setAttribute('aria-hidden', String(!open));
    document.body.style.overflow = open ? 'hidden' : '';
  };
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-drawer-open]')) toggleDrawer(true);
    if (e.target.closest('[data-drawer-close]')) toggleDrawer(false);
    if (e.target.closest('[data-logout]')) logout();

    const dropdown = e.target.closest('[data-dropdown]');
    const trigger = e.target.closest('[data-dropdown] > button');
    if (trigger) {
      const menu = dropdown.querySelector('.dropdown-menu');
      menu.hidden = !menu.hidden;
      trigger.setAttribute('aria-expanded', String(!menu.hidden));
    }
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-dropdown]')) {
      root.querySelectorAll('[data-dropdown] .dropdown-menu').forEach((m) => (m.hidden = true));
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') toggleDrawer(false);
  });
}

// Khởi tạo chung cho mọi trang storefront
export function initPage() {
  mountLayout();
  hydrateIcons();
  togglePasswordButtons();
}

export function mountLayout() {
  const header = document.getElementById('site-header');
  const footer = document.getElementById('site-footer');
  if (header) {
    header.innerHTML = headerHtml();
    bindInteractions(header);
    loadMegaMenu(header);
    window.addEventListener('auth:change', () => {
      $('[data-account]', header).innerHTML = accountMenu();
    });
  }
  if (footer) {
    footer.innerHTML = footerHtml();
    loadStoreContact(footer);
  }
}
