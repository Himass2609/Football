// Phần dùng chung cho các trang đăng nhập / đăng ký / quên mật khẩu
import { hydrateIcons } from './icons-auto.js';
import { jerseySvg } from './jersey.js';
import { $, togglePasswordButtons } from './ui.js';

export function initAuthPage() {
  const art = $('[data-auth-jersey]');
  if (art) art.innerHTML = jerseySvg({ primary: '#FFFFFF', secondary: '#FFB709', view: 'back', name: 'JERSEY', number: 26, label: '' });
  hydrateIcons();
  togglePasswordButtons();
}

// Đánh giá độ mạnh mật khẩu 0–4 để hiển thị thanh gợi ý
export function bindPasswordStrength(input, meter) {
  input.addEventListener('input', () => {
    const v = input.value;
    const level = v ? [v.length >= 8, /[a-z]/i.test(v) && /\d/.test(v), /[^a-z0-9]/i.test(v), v.length >= 12].filter(Boolean).length : 0;
    meter.dataset.level = String(level);
  });
}

export const formData = (form) => Object.fromEntries(new FormData(form).entries());
