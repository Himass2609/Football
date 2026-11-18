import { addressText, openAddressDialog } from '../address-form.js';
import { api } from '../api.js';
import { logout, requireAuth, updateUser } from '../auth.js';
import { initPage } from '../layout.js';
import { ORDER_STATUS, PAYMENT_METHOD, statusPill } from '../order-ui.js';
import {
  $,
  $$,
  clearFieldErrors,
  confirmDialog,
  emptyState,
  formatCurrency,
  formatDateTime,
  handleFormError,
  html,
  icon,
  raw,
  renderPagination,
  setLoading,
  showFieldErrors,
  toDateInput,
  toast,
} from '../ui.js';

initPage();

// Khai báo trước top-level await bên dưới để init() dùng được (tránh lỗi TDZ)
const orderState = { status: '', page: 1 };
let addresses = [];

const user = await requireAuth();
if (user) init(user);

function init({ profile }) {
  renderUser(profile);
  fillProfile(profile);

  const showTab = (name) => {
    if (!$(`[data-panel="${name}"]`)) name = 'profile';
    $$('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== name));
    $$('[data-tab]').forEach((t) => t.setAttribute('aria-current', String(t.dataset.tab === name)));
    if (name === 'orders') loadOrders();
    if (name === 'addresses') loadAddresses();
  };
  $$('[data-tab]').forEach((tab) =>
    tab.addEventListener('click', () => {
      history.replaceState(null, '', `#${tab.dataset.tab}`);
      showTab(tab.dataset.tab);
    }),
  );
  $('.account-nav [data-logout]').addEventListener('click', () => logout());
  showTab(location.hash.slice(1) || 'profile');

  bindProfileForm();
  bindPasswordForm();
  bindOrders();
  bindAddresses();
}

function renderUser(profile) {
  $('[data-user-name]').textContent = profile.fullName;
  $('[data-user-email]').textContent = profile.email;
  $('[data-avatar]').textContent = (profile.fullName.trim().split(/\s+/).pop() ?? 'J')[0].toUpperCase();
}

function fillProfile(profile) {
  const form = $('[data-profile-form]');
  form.elements.fullName.value = profile.fullName ?? '';
  form.elements.email.value = profile.email;
  form.elements.phone.value = profile.phone ?? '';
  form.elements.gender.value = profile.gender ?? '';
  form.elements.birthday.value = toDateInput(profile.birthday);
}

function bindProfileForm() {
  const form = $('[data-profile-form]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFieldErrors(form);
    const body = {
      fullName: form.elements.fullName.value.trim(),
      phone: form.elements.phone.value.trim() || null,
      gender: form.elements.gender.value || null,
      birthday: form.elements.birthday.value || null,
    };
    if (body.fullName.length < 2) return showFieldErrors(form, [{ field: 'fullName', message: 'Vui lòng nhập họ tên' }]);

    const button = form.querySelector('[type="submit"]');
    setLoading(button, true);
    try {
      const { data } = await api.put('/account/profile', body);
      updateUser({ fullName: data.fullName });
      renderUser(data);
      toast('Đã cập nhật hồ sơ', 'success');
    } catch (err) {
      handleFormError(form, err);
    } finally {
      setLoading(button, false);
    }
  });
}

function bindPasswordForm() {
  const form = $('[data-password-form]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFieldErrors(form);
    const { currentPassword, newPassword, confirm } = Object.fromEntries(new FormData(form));
    const errors = [];
    if (!currentPassword) errors.push({ field: 'currentPassword', message: 'Vui lòng nhập mật khẩu hiện tại' });
    if (newPassword.length < 8 || !/[a-z]/i.test(newPassword) || !/\d/.test(newPassword)) {
      errors.push({ field: 'newPassword', message: 'Mật khẩu tối thiểu 8 ký tự, gồm chữ và số' });
    }
    if (confirm !== newPassword) errors.push({ field: 'confirm', message: 'Mật khẩu nhập lại không khớp' });
    if (errors.length) return showFieldErrors(form, errors);

    const button = form.querySelector('[type="submit"]');
    setLoading(button, true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      form.reset();
      toast('Đổi mật khẩu thành công', 'success');
    } catch (err) {
      handleFormError(form, err);
    } finally {
      setLoading(button, false);
    }
  });
}

// ───────── Đơn hàng ─────────
function bindOrders() {
  const filter = $('[data-order-filter]');
  const options = [['', 'Tất cả'], ...Object.entries(ORDER_STATUS).map(([value, s]) => [value, s.label])];
  filter.innerHTML = options
    .map(([value, label]) => html`<button type="button" class="chip" data-status="${value}" aria-pressed="${String(value === orderState.status)}">${label}</button>`)
    .join('');
  filter.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-status]');
    if (!chip) return;
    orderState.status = chip.dataset.status;
    orderState.page = 1;
    $$('[data-status]', filter).forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
    loadOrders();
  });
}

async function loadOrders() {
  const list = $('[data-orders]');
  list.innerHTML = '<div class="skeleton" style="height:160px"></div>';
  try {
    const { data, meta } = await api.get('/orders', { status: orderState.status, page: orderState.page, limit: 5 });
    list.innerHTML = data.length
      ? data.map(orderCard).join('')
      : html`${raw(emptyState('bag', orderState.status ? 'Không có đơn hàng ở trạng thái này' : 'Bạn chưa có đơn hàng nào'))}
          ${orderState.status ? '' : raw('<div class="text-center"><a class="btn btn-dark btn-sm" href="/products.html">Mua sắm ngay</a></div>')}`;
    renderPagination($('[data-orders-pagination]'), meta, (page) => {
      orderState.page = page;
      loadOrders();
    });
  } catch (err) {
    list.innerHTML = emptyState('alert-circle', 'Không tải được đơn hàng', err.message);
  }
}

function orderCard(o) {
  return html`
  <a class="order-card" href="/order.html?code=${o.orderCode}">
    <div class="order-card-head">
      <span><b>${o.orderCode}</b><span class="cell-sub"> · ${formatDateTime(o.createdAt)}</span></span>
      ${raw(statusPill(o.status))}
    </div>
    <div class="order-card-body">
      <div class="order-thumbs">${o.previews.map((p) =>
        raw(html`<span class="order-thumb">${p.imageUrl ? raw(html`<img src="${p.imageUrl}" alt="${p.productName}">`) : raw(icon('shirt', 18))}</span>`),
      )}${o.lineCount > o.previews.length ? raw(html`<span class="order-thumb more">+${o.lineCount - o.previews.length}</span>`) : ''}</div>
      <div class="text-end">
        <p class="cell-sub">${o.itemCount} sản phẩm · ${o.paymentMethod === 'COD' ? 'COD' : PAYMENT_METHOD.ONLINE}</p>
        <p class="order-card-total">${formatCurrency(o.total)}</p>
      </div>
    </div>
  </a>`;
}

// ───────── Sổ địa chỉ ─────────
function bindAddresses() {
  $('[data-add-address]').addEventListener('click', async () => {
    if (await openAddressDialog()) {
      toast('Đã thêm địa chỉ', 'success');
      loadAddresses();
    }
  });
  $('[data-addresses]').addEventListener('click', async (e) => {
    const card = e.target.closest('[data-address]');
    if (!card) return;
    const address = addresses.find((a) => a.id === Number(card.dataset.address));
    try {
      if (e.target.closest('[data-edit]') && (await openAddressDialog(address))) {
        toast('Đã cập nhật địa chỉ', 'success');
        loadAddresses();
      }
      if (e.target.closest('[data-default]')) {
        await api.put(`/account/addresses/${address.id}`, { isDefault: true });
        loadAddresses();
      }
      if (e.target.closest('[data-delete]')) {
        const ok = await confirmDialog({ title: 'Xóa địa chỉ', message: `Xóa địa chỉ của ${address.receiverName}?`, confirmText: 'Xóa', danger: true });
        if (!ok) return;
        await api.delete(`/account/addresses/${address.id}`);
        toast('Đã xóa địa chỉ', 'success');
        loadAddresses();
      }
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

async function loadAddresses() {
  const list = $('[data-addresses]');
  try {
    addresses = (await api.get('/account/addresses')).data;
    list.innerHTML = addresses.length
      ? html`<div class="row g-3">${addresses.map((a) =>
          raw(html`<div class="col-12 col-lg-6"><article class="address-card ${a.isDefault ? 'is-default' : ''}" data-address="${a.id}">
            <p><b>${a.receiverName}</b> <span class="cell-sub">· ${a.phone}</span>${a.isDefault ? raw(' <span class="pill pill-blue">Mặc định</span>') : ''}</p>
            <p class="cell-sub mt-1">${addressText(a)}</p>
            <div class="address-actions">
              <button type="button" data-edit>${raw(icon('pencil', 14))}Sửa</button>
              ${a.isDefault ? '' : raw(html`<button type="button" data-default>Đặt mặc định</button><button type="button" data-delete>${raw(icon('trash', 14))}Xóa</button>`)}
            </div>
          </article></div>`),
        )}</div>`
      : emptyState('map-pin', 'Chưa có địa chỉ nào', 'Thêm địa chỉ để thanh toán nhanh hơn.');
  } catch (err) {
    list.innerHTML = emptyState('alert-circle', 'Không tải được sổ địa chỉ', err.message);
  }
}
