import { api } from '../api.js';
import { redirectIfLoggedIn } from '../auth.js';
import { bindPasswordStrength, initAuthPage } from '../auth-page.js';
import { $, $$, clearFieldErrors, handleFormError, setLoading, showFieldErrors, toast } from '../ui.js';

redirectIfLoggedIn();
initAuthPage();

const forms = Object.fromEntries($$('[data-step]').map((f) => [f.dataset.step, f]));
const state = { email: '', otp: '' };
const RESEND_SECONDS = 60;

function goTo(step) {
  Object.entries(forms).forEach(([key, form]) => (form.hidden = key !== String(step)));
  $$('.steps span').forEach((bar, i) => bar.classList.toggle('done', i < step));
  forms[step].querySelector('input')?.focus();
}

async function submitWith(form, task) {
  const button = form.querySelector('[type="submit"]');
  clearFieldErrors(form);
  setLoading(button, true);
  try {
    await task();
  } catch (err) {
    handleFormError(form, err);
  } finally {
    setLoading(button, false);
  }
}

// Đếm ngược nút gửi lại để khớp giới hạn 60 giây của server
function startResendCooldown() {
  const btn = $('[data-resend]');
  let left = RESEND_SECONDS;
  btn.disabled = true;
  const tick = () => {
    btn.textContent = left > 0 ? `Gửi lại sau ${left}s` : 'Gửi lại mã';
    if (left-- <= 0) {
      btn.disabled = false;
      clearInterval(timer);
    }
  };
  const timer = setInterval(tick, 1000);
  tick();
}

forms[1].addEventListener('submit', (e) => {
  e.preventDefault();
  const email = forms[1].elements.email.value.trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) return showFieldErrors(forms[1], [{ field: 'email', message: 'Email không hợp lệ' }]);
  submitWith(forms[1], async () => {
    await api.post('/auth/forgot-password', { email });
    state.email = email;
    $('[data-email-label]').textContent = email;
    startResendCooldown();
    goTo(2);
  });
});

forms[2].elements.otp.addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
});

forms[2].addEventListener('submit', (e) => {
  e.preventDefault();
  const otp = forms[2].elements.otp.value;
  if (!/^\d{6}$/.test(otp)) return showFieldErrors(forms[2], [{ field: 'otp', message: 'Mã OTP gồm 6 chữ số' }]);
  submitWith(forms[2], async () => {
    await api.post('/auth/verify-otp', { email: state.email, otp });
    state.otp = otp;
    goTo(3);
  });
});

$('[data-back]').addEventListener('click', () => goTo(1));
$('[data-resend]').addEventListener('click', async () => {
  try {
    await api.post('/auth/forgot-password', { email: state.email });
    toast('Đã gửi lại mã OTP', 'success');
    startResendCooldown();
  } catch (err) {
    toast(err.message, 'error');
  }
});

bindPasswordStrength(forms[3].elements.newPassword, $('[data-strength]', forms[3]));
forms[3].addEventListener('submit', (e) => {
  e.preventDefault();
  const { newPassword, confirm } = Object.fromEntries(new FormData(forms[3]));
  const errors = [];
  if (newPassword.length < 8 || !/[a-z]/i.test(newPassword) || !/\d/.test(newPassword)) {
    errors.push({ field: 'newPassword', message: 'Mật khẩu tối thiểu 8 ký tự, gồm chữ và số' });
  }
  if (confirm !== newPassword) errors.push({ field: 'confirm', message: 'Mật khẩu nhập lại không khớp' });
  if (errors.length) return showFieldErrors(forms[3], errors);

  submitWith(forms[3], async () => {
    await api.post('/auth/reset-password', { email: state.email, otp: state.otp, newPassword });
    toast('Đặt lại mật khẩu thành công, vui lòng đăng nhập', 'success');
    setTimeout(() => (location.href = '/login.html'), 900);
  });
});
