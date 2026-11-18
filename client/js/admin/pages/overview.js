import { api } from '../../api.js';
import { ORDER_STATUS } from '../../order-ui.js';
import { $, $$, emptyState, formatCurrency, formatDateTime, formatNumber, html, icon, raw } from '../../ui.js';
import { mountAdmin } from '../shell.js';

const RANGES = [7, 30, 90];
let days = 30;

const user = await mountAdmin({ active: 'overview', title: 'Bảng điều khiển' });
if (user) render(user);

// 1.250.000 → "1,3tr" cho nhãn trục gọn
const compactVnd = (v) => (v >= 1e6 ? `${formatNumber(Math.round(v / 1e5) / 10)}tr` : v >= 1e3 ? `${formatNumber(Math.round(v / 1e3))}k` : String(v));
// KPI doanh thu: 68.400.000 → "68,4 triệu₫" cho vừa thẻ (số đầy đủ ở tooltip)
const millions = (v) => (v >= 1e6 ? `${formatNumber(Math.round(v / 1e5) / 10)} triệu₫` : formatCurrency(v));
const shortDate = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

async function render(user) {
  $('[data-admin-name]').textContent = user.fullName;
  const root = $('[data-overview]');
  try {
    const { data } = await api.get('/admin/overview');
    const c = data.counts;
    const quick = [
      ['/admin/orders.html?status=PENDING', 'receipt', 'Đơn chờ xác nhận'],
      ['/admin/products.html', 'shirt', `Sản phẩm (${c.products})`],
      ['/admin/inventory.html', 'layers', `Tồn kho (${c.lowStock} sắp hết)`],
      ['/admin/reviews.html', 'star', 'Đánh giá của khách'],
      ['/admin/vouchers.html', 'ticket', 'Tạo voucher mới'],
      ['/admin/settings.html', 'sliders', 'Cấu hình cửa hàng'],
    ];

    root.innerHTML = html`
      <div class="range-row" role="group" aria-label="Khoảng thời gian">
        ${RANGES.map((d) => raw(html`<button type="button" class="chip" data-days="${d}" aria-pressed="${String(d === days)}">${d} ngày</button>`))}
      </div>
      <div data-stats><div class="skeleton" style="height:420px"></div></div>

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
                <li><span class="pill pill-green">Xong</span><span><b>Phase 2</b> — Sản phẩm, biến thể, tồn kho, tìm kiếm & lọc</span></li>
                <li><span class="pill pill-green">Xong</span><span><b>Phase 3</b> — Giỏ hàng, đặt hàng, thanh toán, đánh giá, thống kê</span></li>
              </ul>
            </div>
          </div>
        </div>
      </div>`;

    $$('[data-days]', root).forEach((btn) =>
      btn.addEventListener('click', () => {
        days = Number(btn.dataset.days);
        $$('[data-days]', root).forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        loadStats();
      }),
    );
    loadStats();
  } catch (err) {
    root.innerHTML = `<div class="card">${emptyState('alert-circle', 'Không tải được số liệu', err.message)}</div>`;
  }
}

async function loadStats() {
  const box = $('[data-stats]');
  try {
    const { data } = await api.get('/admin/stats', { days });
    const k = data.kpis;
    const kpis = [
      { label: 'Doanh thu', value: millions(k.revenue), title: formatCurrency(k.revenue), hint: `${k.deliveredOrders} đơn đã giao · TB ${formatCurrency(k.averageOrderValue)}`, icon: 'wallet', accent: true },
      { label: 'Đơn hàng', value: formatNumber(k.orders), hint: `${k.pendingOrders} đơn chờ xác nhận`, icon: 'receipt', href: '/admin/orders.html?status=PENDING' },
      { label: 'Khách hàng mới', value: formatNumber(k.newCustomers), hint: `Trong ${days} ngày qua`, icon: 'users' },
      { label: 'Sắp hết hàng', value: formatNumber(k.lowStock), hint: 'Biến thể còn ≤ 5 sản phẩm', icon: 'layers', href: '/admin/inventory.html' },
    ];
    const totalStatus = Math.max(1, Object.values(data.statusCounts).reduce((a, b) => a + b, 0));

    box.innerHTML = html`
      <div class="row g-4">
        ${kpis.map((kpi) =>
          raw(html`<div class="col-12 col-sm-6 col-xl-3">
            <div class="card kpi ${kpi.accent ? 'kpi-accent' : ''}">
              <div>
                <p class="kpi-label">${kpi.label}</p>
                <p class="kpi-value" title="${kpi.title ?? ''}">${kpi.value}</p>
                <p class="kpi-hint">${kpi.href ? raw(html`<a href="${kpi.href}">${kpi.hint}</a>`) : kpi.hint}</p>
              </div>
              <span class="kpi-icon">${raw(icon(kpi.icon, 22))}</span>
            </div>
          </div>`),
        )}
      </div>

      <div class="row g-4 mt-1">
        <div class="col-12 col-xl-8">
          <div class="card h-100">
            <div class="card-head"><div><h2 class="card-title">Doanh thu theo ngày</h2><p class="cell-sub">Tổng tiền đơn đã giao, tính theo ngày giao · ${days} ngày gần nhất</p></div></div>
            <div class="card-body">${raw(revenueChart(data.series))}</div>
          </div>
        </div>
        <div class="col-12 col-xl-4">
          <div class="card h-100">
            <div class="card-head"><h2 class="card-title">Trạng thái đơn</h2><span class="cell-sub">${days} ngày</span></div>
            <div class="card-body">
              <ul class="status-list">${Object.entries(ORDER_STATUS).map(([s, meta]) =>
                raw(html`<li>
                  <a href="/admin/orders.html?status=${s}"><span class="pill ${meta.pill}">${meta.label}</span></a>
                  <span class="status-bar"><span style="width:${Math.round((data.statusCounts[s] / totalStatus) * 100)}%"></span></span>
                  <b>${data.statusCounts[s]}</b>
                </li>`),
              )}</ul>
            </div>
          </div>
        </div>
      </div>

      <div class="card mt-4">
        <div class="card-head"><h2 class="card-title">Sản phẩm bán chạy</h2><span class="cell-sub">Theo số lượng · ${days} ngày, không tính đơn hủy</span></div>
        ${data.topProducts.length
          ? raw(html`<div class="table-wrap"><table class="table">
              <thead><tr><th>#</th><th>Sản phẩm</th><th class="text-end">Đã bán</th><th class="text-end">Doanh số</th></tr></thead>
              <tbody>${data.topProducts.map((p, i) =>
                raw(html`<tr>
                  <td class="cell-sub">${i + 1}</td>
                  <td><div class="d-flex align-items-center gap-3">${p.image ? raw(html`<img class="thumb" src="${p.image}" alt="">`) : ''}<a class="cell-main" href="/product.html?slug=${p.slug}" target="_blank" rel="noopener">${p.name}</a></div></td>
                  <td class="text-end cell-main">${p.quantity}</td>
                  <td class="text-end">${formatCurrency(p.revenue)}</td>
                </tr>`),
              )}</tbody></table></div>`)
          : raw(emptyState('shirt', 'Chưa có đơn hàng trong khoảng này'))}
      </div>`;
    bindChartHover(box);
  } catch (err) {
    box.innerHTML = `<div class="card">${emptyState('alert-circle', 'Không tải được thống kê', err.message)}</div>`;
  }
}

// ───────── Biểu đồ cột doanh thu (SVG thuần) ─────────
// 1 chuỗi số liệu → không cần chú giải; cột màu ink (vàng accent không đủ tương phản 3:1 trên nền trắng),
// hover tô vàng + tooltip; bảng ẩn cho trình đọc màn hình.
function revenueChart(series) {
  const W = 760;
  const H = 260;
  const pad = { top: 12, right: 8, bottom: 28, left: 48 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const max = Math.max(...series.map((p) => p.revenue));
  if (!max) return emptyState('wallet', 'Chưa có doanh thu trong khoảng này', 'Doanh thu tính khi đơn chuyển sang “Đã giao”.');

  // Trục y tròn số: 4 vạch đều, bước 1/2/5 × 10^n
  const raw4 = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw4));
  const n = raw4 / mag;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
  const top = step * 4;
  const y = (v) => pad.top + innerH - (v / top) * innerH;
  const slot = innerW / series.length;
  const barW = Math.max(2, Math.min(24, slot - 2));
  const labelEvery = series.length <= 7 ? 1 : series.length <= 31 ? 5 : 15;
  const r = Math.min(4, barW / 2);

  const bars = series
    .map((p, i) => {
      const x = pad.left + i * slot + (slot - barW) / 2;
      const h = (p.revenue / top) * innerH;
      const yTop = pad.top + innerH - h;
      // Đầu cột bo 4px, chân cột vuông
      const path = h > 0
        ? `M${x},${pad.top + innerH}V${yTop + Math.min(r, h)}Q${x},${yTop} ${x + Math.min(r, h)},${yTop}H${x + barW - Math.min(r, h)}Q${x + barW},${yTop} ${x + barW},${yTop + Math.min(r, h)}V${pad.top + innerH}Z`
        : '';
      return `<g class="bar" data-i="${i}">
        <rect class="hit" x="${pad.left + i * slot}" y="${pad.top}" width="${slot}" height="${innerH}" />
        ${path ? `<path d="${path}" />` : ''}
      </g>`;
    })
    .join('');

  const grid = [0, 1, 2, 3, 4]
    .map((t) => `<line x1="${pad.left}" x2="${W - pad.right}" y1="${y(step * t)}" y2="${y(step * t)}" /><text x="${pad.left - 8}" y="${y(step * t) + 4}" text-anchor="end">${compactVnd(step * t)}</text>`)
    .join('');
  const xLabels = series
    .map((p, i) => (i % labelEvery === 0 || i === series.length - 1 ? `<text x="${pad.left + i * slot + slot / 2}" y="${H - 8}" text-anchor="middle">${shortDate(p.date)}</text>` : ''))
    .join('');

  return `<div class="chart" data-chart='${JSON.stringify(series.map((p) => [shortDate(p.date), p.revenue, p.orders]))}'>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Doanh thu ${series.length} ngày, cao nhất ${formatCurrency(max)}">
      <g class="grid">${grid}</g>
      <g class="bars">${bars}</g>
      <g class="x-labels">${xLabels}</g>
    </svg>
    <div class="chart-tooltip" hidden></div>
    <table class="visually-hidden"><caption>Doanh thu theo ngày</caption><thead><tr><th>Ngày</th><th>Doanh thu</th><th>Đơn mới</th></tr></thead>
      <tbody>${series.map((p) => `<tr><td>${shortDate(p.date)}</td><td>${formatCurrency(p.revenue)}</td><td>${p.orders}</td></tr>`).join('')}</tbody></table>
  </div>`;
}

function bindChartHover(scope) {
  const chart = $('.chart', scope);
  if (!chart) return;
  const data = JSON.parse(chart.dataset.chart);
  const tip = $('.chart-tooltip', chart);
  chart.addEventListener('pointerover', (e) => {
    const bar = e.target.closest('.bar');
    if (!bar) return;
    $$('.bar.active', chart).forEach((b) => b.classList.remove('active'));
    bar.classList.add('active');
    const [date, revenue, orders] = data[Number(bar.dataset.i)];
    tip.innerHTML = html`<b>${date}</b><span>Doanh thu: ${formatCurrency(revenue)}</span><span>Đơn mới: ${orders}</span>`;
    tip.hidden = false;
    const box = chart.getBoundingClientRect();
    const rect = bar.getBoundingClientRect();
    const left = Math.min(box.width - tip.offsetWidth, Math.max(0, rect.left - box.left + rect.width / 2 - tip.offsetWidth / 2));
    tip.style.left = `${left}px`;
  });
  chart.addEventListener('pointerleave', () => {
    tip.hidden = true;
    $$('.bar.active', chart).forEach((b) => b.classList.remove('active'));
  });
}
