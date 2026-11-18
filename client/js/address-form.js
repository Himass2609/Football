// Dialog thêm / sửa địa chỉ giao hàng — dùng ở trang thanh toán và tab Sổ địa chỉ
import { api } from './api.js';
import { $, clearFieldErrors, handleFormError, html, raw, setLoading, showFieldErrors } from './ui.js';

const FIELDS = [
  ['receiverName', 'Họ tên người nhận', 'col-12 col-sm-6', 100],
  ['phone', 'Số điện thoại', 'col-12 col-sm-6', 15],
  ['line', 'Số nhà, tên đường', 'col-12', 255],
  ['ward', 'Phường / Xã', 'col-12 col-sm-4', 100],
  ['district', 'Quận / Huyện', 'col-12 col-sm-4', 100],
  ['province', 'Tỉnh / Thành phố', 'col-12 col-sm-4', 100],
];

export const addressText = (a) => [a.line, a.ward, a.district, a.province].filter(Boolean).join(', ');

/** Mở dialog; trả về địa chỉ đã lưu hoặc null nếu đóng */
export function openAddressDialog(initial = null) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'dialog dialog-lg';
    dialog.innerHTML = html`
      <form novalidate>
        <div class="dialog-head"><h2 class="dialog-title">${initial ? 'Sửa địa chỉ' : 'Thêm địa chỉ mới'}</h2></div>
        <div class="dialog-body">
          <div class="row g-3">
            ${FIELDS.map(([name, label, col, max]) =>
              raw(html`<div class="${col}"><label class="field"><span class="label">${label} <span class="req">*</span></span>
                <input class="input" name="${name}" maxlength="${max}" value="${initial?.[name] ?? ''}" ${name === 'phone' ? raw('type="tel" inputmode="tel"') : ''} required></label></div>`),
            )}
            <div class="col-12"><label class="check"><input type="checkbox" name="isDefault" ${initial?.isDefault ? raw('checked disabled') : ''}>Đặt làm địa chỉ mặc định</label></div>
          </div>
        </div>
        <div class="dialog-foot">
          <button type="button" class="btn btn-ghost btn-sm" data-close>Hủy</button>
          <button type="submit" class="btn btn-dark btn-sm" data-loading-text="Đang lưu...">Lưu địa chỉ</button>
        </div>
      </form>`;
    document.body.append(dialog);

    const close = (result) => {
      dialog.close();
      dialog.remove();
      resolve(result);
    };
    dialog.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]') || e.target === dialog) close(null);
    });
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      close(null);
    });

    const form = $('form', dialog);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearFieldErrors(form);
      const body = Object.fromEntries(FIELDS.map(([name]) => [name, form.elements[name].value.trim()]));
      body.isDefault = form.elements.isDefault.checked;
      const missing = FIELDS.filter(([name]) => !body[name]).map(([name]) => ({ field: name, message: 'Trường này là bắt buộc' }));
      if (missing.length) return showFieldErrors(form, missing);

      const button = $('[type="submit"]', form);
      setLoading(button, true);
      try {
        const { data } = initial ? await api.put(`/account/addresses/${initial.id}`, body) : await api.post('/account/addresses', body);
        close(data);
      } catch (err) {
        handleFormError(form, err);
        setLoading(button, false);
      }
    });

    dialog.showModal();
    form.elements.receiverName.focus();
  });
}
