import { api } from '../../api.js';
import { $, clearFieldErrors, emptyState, handleFormError, html, setLoading, toast } from '../../ui.js';
import { mountAdmin } from '../shell.js';

if (await mountAdmin({ active: 'settings', title: 'Cấu hình cửa hàng' })) render();

async function render() {
  const root = $('[data-settings]');
  try {
    const { data: s } = await api.get('/admin/settings');
    root.innerHTML = html`
      <form class="card" novalidate style="max-width:880px">
        <div class="card-head"><h2 class="card-title">Thông tin cửa hàng</h2></div>
        <div class="card-body">
          <div class="form-grid">
            <label class="field"><span class="label">Tên cửa hàng <span class="req">*</span></span><input class="input" name="storeName" maxlength="100" value="${s.storeName}"></label>
            <label class="field"><span class="label">Email liên hệ</span><input class="input" type="email" name="storeEmail" value="${s.storeEmail ?? ''}"></label>
            <label class="field"><span class="label">Số điện thoại</span><input class="input" type="tel" name="storePhone" value="${s.storePhone ?? ''}"></label>
            <label class="field"><span class="label">Đơn vị tiền tệ</span><input class="input" value="${s.currency}" disabled></label>
            <label class="field span-2"><span class="label">Địa chỉ</span><input class="input" name="storeAddress" maxlength="255" value="${s.storeAddress ?? ''}"></label>
          </div>
        </div>
        <div class="card-head" style="border-top:1px solid var(--c-line)"><h2 class="card-title">Vận chuyển</h2></div>
        <div class="card-body">
          <div class="form-grid">
            <label class="field"><span class="label">Phí giao hàng (₫)</span><input class="input" type="number" min="0" step="1000" name="shippingFee" value="${s.shippingFee}"></label>
            <label class="field"><span class="label">Miễn phí giao hàng cho đơn từ (₫)</span><input class="input" type="number" min="0" step="1000" name="freeShipThreshold" value="${s.freeShipThreshold}"></label>
          </div>
        </div>
        <div class="dialog-foot">
          <button class="btn btn-dark btn-sm" type="submit" data-loading-text="Đang lưu...">Lưu cấu hình</button>
        </div>
      </form>`;

    const form = $('form', root);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearFieldErrors(form);
      const v = Object.fromEntries(new FormData(form));
      const button = $('[type="submit"]', form);
      setLoading(button, true);
      try {
        await api.put('/admin/settings', {
          storeName: v.storeName.trim(),
          storeEmail: v.storeEmail.trim() || null,
          storePhone: v.storePhone.trim() || null,
          storeAddress: v.storeAddress.trim() || null,
          shippingFee: Number(v.shippingFee),
          freeShipThreshold: Number(v.freeShipThreshold),
        });
        toast('Đã lưu cấu hình', 'success');
      } catch (err) {
        handleFormError(form, err);
      } finally {
        setLoading(button, false);
      }
    });
  } catch (err) {
    root.innerHTML = `<div class="card">${emptyState('alert-circle', 'Không tải được cấu hình', err.message)}</div>`;
  }
}
