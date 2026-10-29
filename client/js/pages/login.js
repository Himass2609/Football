import { login, redirectIfLoggedIn, safeNext } from '../auth.js';
import { formData, initAuthPage } from '../auth-page.js';
import { $, $$, clearFieldErrors, handleFormError, setLoading, showFieldErrors, toast } from '../ui.js';

redirectIfLoggedIn();
initAuthPage();

const form = $('[data-login-form]');

// Giữ tham số ?next khi chuyển qua trang đăng ký
$$('[data-keep-next]').forEach((a) => (a.href += location.search));

$$('[data-demo]').forEach((btn) =>
  btn.addEventListener('click', () => {
    const [email, password] = btn.dataset.demo.split('|');
    form.elements.email.value = email;
    form.elements.password.value = password;
    form.requestSubmit();
  }),
);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearFieldErrors(form);
  const data = formData(form);
  const errors = [];
  if (!/^\S+@\S+\.\S+$/.test(data.email)) errors.push({ field: 'email', message: 'Email không hợp lệ' });
  if (!data.password) errors.push({ field: 'password', message: 'Vui lòng nhập mật khẩu' });
  if (errors.length) return showFieldErrors(form, errors);

  const button = form.querySelector('[type="submit"]');
  setLoading(button, true);
  try {
    const user = await login(data);
    toast(`Xin chào, ${user.fullName}!`, 'success');
    location.href = safeNext(user.role === 'ADMIN' ? '/admin/' : '/');
  } catch (err) {
    handleFormError(form, err);
    setLoading(button, false);
  }
});
