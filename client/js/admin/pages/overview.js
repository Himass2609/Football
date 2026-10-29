import { api } from '../../api.js';
import { $, emptyState, formatDateTime, formatNumber, html, icon, raw } from '../../ui.js';
import { mountAdmin } from '../shell.js';

const user = await mountAdmin({ active: 'overview', title: 'Bảng điều khiển' });
if (user) render(user);

async function render(user) {
  $('[data-admin-name]').textContent = user.fullName;
  const root = $('[data-overview]');
  try {
    const { data } = await api.get('/admin/overview');
    const c = data.counts;
    const kpis = [
      { label: 'Khách hàng', value: c.customers, hint: `${c.admins} quản trị viên`, icon: 'users', accent: true },
      { label: 'Sản phẩm', value: c.products, hint: 'Quản lý ở Phase 2', icon: 'shirt' },
      { label: 'Ưu đãi đang chạy', value: c.runningPromotions + c.runningVouchers, hint: `${c.runningPromotions} khuyến mãi · ${c.runningVouchers} voucher`, icon: 'percent' },
      { label: 'Bài viết đã đăng', value: c.publishedNews, hint: 'Tin tức & cẩm nang', icon: 'newspaper' },
    ];
    const quick = [
      ['/admin/master-data.html?entity=teams', 'flag', `Đội bóng (${c.teams})`],
      ['/admin/master-data.html?entity=categories', 'layers', `Danh mục (${c.categories})`],
      ['/admin/master-data.html?entity=brands', 'badge-check', `Thương hiệu (${c.brands})`],
      ['/admin/vouchers.html', 'ticket', 'Tạo voucher mới'],
      ['/admin/news.html', 'newspaper', 'Viết bài mới'],
      ['/admin/settings.html', 'sliders', 'Cấu hình cửa hàng'],
    ];

    root.innerHTML = html`
      <div class="row g-4">
        ${kpis.map((k) =>
          raw(html`<div class="col-12 col-sm-6 col-xl-3">
            <div class="card kpi ${k.accent ? 'kpi-accent' : ''}">
              <div>
                <p class="kpi-label">${k.label}</p>
                <p class="kpi-value">${formatNumber(k.value)}</p>
                <p class="kpi-hint">${k.hint}</p>
              </div>
              <span class="kpi-icon">${raw(icon(k.icon, 22))}</span>
            </div>
          </div>`),
        )}
      </div>

      <div class="row g-4 mt-1">
        <div class="col-12 col-xl-7">
          <div class="card h-100">
            <div class="card-head"><h2 class="card-title">Tài khoản mới</h2><a class="link-more" href="/admin/users.html">Xem tất cả${raw(icon('arrow-right', 14))}</a></div>
            ${data.recentUsers.length
              ? raw(html`<div class="table-wrap"><table class="table"><tbody>
                ${data.recentUsers.map((u) =>
                  raw(html`<tr>
                    <td><div class="cell-main">${u.fullName ?? '—'}</div><div class="cell-sub">${u.email}</div></td>
                    <td>${raw(u.role === 'ADMIN' ? '<span class="pill pill-violet">Quản trị</span>' : '<span class="pill pill-blue">Khách hàng</span>')}</td>
                    <td class="text-end cell-sub">${formatDateTime(u.createdAt)}</td>
                  </tr>`),
                )}
              </tbody></table></div>`)
              : raw(emptyState('users', 'Chưa có tài khoản'))}
          </div>
        </div>
        <div class="col-12 col-xl-5">
          <div class="card">
            <div class="card-head"><h2 class="card-title">Truy cập nhanh</h2></div>
            <div class="card-body">
              <div class="row g-3">
                ${quick.map(([href, ic, label]) =>
                  raw(html`<div class="col-12 col-sm-6"><a class="quick-link" href="${href}">${raw(icon(ic, 18))}${label}${raw(icon('chevron-right', 16))}</a></div>`),
                )}
              </div>
            </div>
          </div>
          <div class="card mt-4">
            <div class="card-head"><h2 class="card-title">Lộ trình dự án</h2></div>
            <div class="card-body pt-2 pb-2">
              <ul class="roadmap">
                <li><span class="pill pill-green">Xong</span><span><b>Phase 1</b> — Tài khoản, phân quyền, dữ liệu nền, khuyến mãi, tin tức</span></li>
                <li><span class="pill pill-amber">Tiếp theo</span><span><b>Phase 2</b> — Sản phẩm, biến thể, tồn kho, tìm kiếm & lọc</span></li>
                <li><span class="pill pill-gray">Sau</span><span><b>Phase 3</b> — Giỏ hàng, đặt hàng, thanh toán, đánh giá, thống kê</span></li>
              </ul>
            </div>
          </div>
        </div>
      </div>`;
  } catch (err) {
    root.innerHTML = `<div class="card">${emptyState('alert-circle', 'Không tải được số liệu', err.message)}</div>`;
  }
}
