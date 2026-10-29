import { redirectIfLoggedIn, register, safeNext } from '../auth.js';
import { bindPasswordStrength, formData, initAuthPage } from '../auth-page.js';
import { $, $$, clearFieldErrors, handleFormError, setLoading, showFieldErrors, toast } from '../ui.js';

redirectIfLoggedIn();
initAuthPage();

const form = $('[data-register-form]');
$$('[data-keep-next]').forEach((a) => (a.href += location.search));
bindPasswordStrength(form.elements.password, $('[data-strength]'));

// Kiểm tra phía client trùng quy tắc với server để phản hồi tức thì
function validate(data) {
  const errors = [];
  if (data.fullName.trim().length < 2) errors.push({ field: 'fullName', message: 'Vui lòng nhập họ tên (tối thiểu 2 ký tự)' });
  if (!/^\S+@\S+\.\S+$/.test(data.email)) errors.push({ field: 'email', message: 'Email không hợp lệ' });
  if (!/^(0|\+84)(3|5|7|8|9)\d{8}$/.test(data.phone.trim())) errors.push({ field: 'phone', message: 'Số điện thoại không hợp lệ' });
  if (data.password.length < 8 || !/[a-z]/i.test(data.password) || !/\d/.test(data.password)) {
    errors.push({ field: 'password', message: 'Mật khẩu tối thiểu 8 ký tự, gồm chữ và số' });
  }
  if (data.confirm !== data.password) errors.push({ field: 'confirm', message: 'Mật khẩu nhập lại không khớp' });
  if (!data.agree) errors.push({ field: 'agree', message: 'Vui lòng đồng ý với điều khoản' });
  return errors;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearFieldErrors(form);
  const data = formData(form);
  const errors = validate(data);
  if (errors.length) return showFieldErrors(form, errors);

  const button = form.querySelector('[type="submit"]');
  setLoading(button, true);
  try {
    const user = await register({ fullName: data.fullName.trim(), email: data.email.trim(), phone: data.phone.trim(), password: data.password });
    toast(`Chào mừng ${user.fullName} đến với JERSEY!`, 'success');
    location.href = safeNext('/');
  } catch (err) {
    handleFormError(form, err);
    setLoading(button, false);
  }
});
