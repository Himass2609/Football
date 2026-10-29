// Khung trang quản trị: kiểm tra quyền ADMIN, sidebar, topbar
import { logout, requireAuth } from '../auth.js';
import { hydrateIcons } from '../icons-auto.js';
import { $, html, icon, raw, togglePasswordButtons } from '../ui.js';

const NAV = [
  { title: 'Tổng quan', items: [{ href: '/admin/', icon: 'dashboard', label: 'Bảng điều khiển', key: 'overview' }] },
  {
    title: 'Người dùng',
    items: [
      { href: '/admin/users.html', icon: 'users', label: 'Tài khoản', key: 'users' },
      { href: '/admin/roles.html', icon: 'key', label: 'Vai trò & quyền', key: 'roles' },
    ],
  },
  {
    title: 'Sản phẩm',
    items: [
      { href: '/admin/products.html', icon: 'shirt', label: 'Sản phẩm', key: 'products' },
      { href: '/admin/inventory.html', icon: 'layers', label: 'Tồn kho', key: 'inventory' },
    ],
  },
  {
    title: 'Dữ liệu nền',
    items: [
      { href: '/admin/master-data.html?entity=categories', icon: 'layers', label: 'Danh mục', key: 'categories' },
      { href: '/admin/master-data.html?entity=brands', icon: 'badge-check', label: 'Thương hiệu', key: 'brands' },
      { href: '/admin/master-data.html?entity=leagues', icon: 'trophy', label: 'Giải đấu', key: 'leagues' },
      { href: '/admin/master-data.html?entity=teams', icon: 'flag', label: 'Đội bóng', key: 'teams' },
      { href: '/admin/master-data.html?entity=product-types', icon: 'shirt', label: 'Loại sản phẩm', key: 'product-types' },
      { href: '/admin/master-data.html?entity=sizes', icon: 'ruler', label: 'Kích thước', key: 'sizes' },
      { href: '/admin/master-data.html?entity=colors', icon: 'palette', label: 'Màu sắc', key: 'colors' },
    ],
  },
  {
    title: 'Marketing',
    items: [
      { href: '/admin/promotions.html', icon: 'percent', label: 'Khuyến mãi', key: 'promotions' },
      { href: '/admin/vouchers.html', icon: 'ticket', label: 'Voucher', key: 'vouchers' },
    ],
  },
  {
    title: 'Nội dung',
    items: [
      { href: '/admin/news.html', icon: 'newspaper', label: 'Tin tức', key: 'news' },
      { href: '/admin/master-data.html?entity=news-categories', icon: 'tag', label: 'Chuyên mục tin', key: 'news-categories' },
    ],
  },
  { title: 'Hệ thống', items: [{ href: '/admin/settings.html', icon: 'sliders', label: 'Cấu hình cửa hàng', key: 'settings' }] },
];

/**
 * Dựng khung admin quanh nội dung có sẵn trong <main data-admin-content>.
 * @returns {Promise<object|null>} user hiện tại (null nếu bị chuyển hướng)
 */
export async function mountAdmin({ active, title }) {
  const user = await requireAuth({ role: 'ADMIN' });
  if (!user) return null;

  document.title = `${title} — Quản trị JERSEY`;
  const content = $('[data-admin-content]');
  const shell = document.createElement('div');
  shell.className = 'admin-shell';
  shell.innerHTML = html`
    <aside class="admin-sidebar" aria-label="Menu quản trị">
      <div class="admin-brand">
        <a class="logo" href="/admin/"><span class="logo-mark">${raw(icon('shirt', 18))}</span>JERSEY</a>
        <span class="badge">Admin</span>
      </div>
      <nav class="admin-nav">
        ${NAV.map((group) =>
          raw(html`<div class="admin-nav-group">
            <p class="admin-nav-title">${group.title}</p>
            ${group.items.map((item) =>
              raw(html`<a href="${item.href}" ${item.key === active ? raw('aria-current="page"') : ''}>${raw(icon(item.icon, 18))}${item.label}</a>`),
            )}
          </div>`),
        )}
      </nav>
      <div class="admin-sidebar-foot">
        <a class="link-more" href="/" style="color:var(--c-on-dark-muted)">${raw(icon('external-link', 14))}Xem cửa hàng</a>
      </div>
    </aside>
    <div class="admin-main">
      <header class="admin-topbar">
        <button class="icon-btn menu-toggle" type="button" aria-label="Mở menu" data-nav-toggle>${raw(icon('menu'))}</button>
        <h1 class="admin-page-title">${title}</h1>
        <div class="admin-topbar-actions">
          <div class="admin-user">
            <span class="avatar">${(user.fullName.trim().split(/\s+/).pop() ?? 'A')[0].toUpperCase()}</span>
            <span class="text-small fw-semibold">${user.fullName}</span>
          </div>
          <button class="icon-btn" type="button" aria-label="Đăng xuất" title="Đăng xuất" data-logout>${raw(icon('log-out'))}</button>
        </div>
      </header>
    </div>`;

  content.classList.add('admin-content');
  content.hidden = false;
  $('.admin-main', shell).append(content);
  document.body.prepend(shell);

  shell.addEventListener('click', (e) => {
    if (e.target.closest('[data-nav-toggle]')) shell.classList.toggle('nav-open');
    else if (!e.target.closest('.admin-sidebar')) shell.classList.remove('nav-open');
    if (e.target.closest('[data-logout]')) logout('/login.html');
  });

  hydrateIcons();
  togglePasswordButtons();
  return user;
}
