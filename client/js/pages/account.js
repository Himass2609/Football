import { api } from '../api.js';
import { logout, requireAuth, updateUser } from '../auth.js';
import { initPage } from '../layout.js';
import { $, $$, clearFieldErrors, emptyState, handleFormError, setLoading, showFieldErrors, toDateInput, toast } from '../ui.js';

initPage();

const user = await requireAuth();
if (user) init(user);

function init({ profile }) {
  renderUser(profile);
  fillProfile(profile);

  $$('[data-soon]').forEach((el) => {
    const [iconName, title, desc] = el.dataset.soon.split('|');
    el.innerHTML = emptyState(iconName, title, desc);
  });

  const showTab = (name) => {
    if (!$(`[data-panel="${name}"]`)) name = 'profile';
    $$('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== name));
    $$('[data-tab]').forEach((t) => t.setAttribute('aria-current', String(t.dataset.tab === name)));
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
