// Vẽ áo đấu SVG từ màu đội bóng — dùng làm ảnh minh họa khi sản phẩm chưa có ảnh thật
import { escapeHtml } from './ui.js';

let uid = 0;

const OUTLINE =
  'M92 16 C104 34 136 34 148 16 L182 26 Q208 38 228 66 L203 104 L178 90 L178 238 Q178 247 169 247 L71 247 Q62 247 62 238 L62 90 L37 104 L12 66 Q32 38 58 26 Z';

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const contrast = (a, b) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

// Màu chữ (số áo) đọc rõ trên nền áo: ưu tiên màu phụ, không đủ tương phản thì đen/trắng
function inkOn(primary, secondary) {
  if (contrast(primary, secondary) >= 2.2) return secondary;
  return luminance(primary) > 0.4 ? '#0B1220' : '#FFFFFF';
}

function pattern(kind, secondary) {
  switch (kind) {
    case 'STRIPES':
      return Array.from({ length: 6 }, (_, i) => `<rect x="${62 + 9 + i * 20}" y="0" width="10" height="260" fill="${secondary}"/>`).join('');
    case 'HOOPS':
      return Array.from({ length: 5 }, (_, i) => `<rect x="0" y="${70 + i * 36}" width="240" height="18" fill="${secondary}"/>`).join('');
    case 'HALVES':
      return `<rect x="120" y="0" width="120" height="260" fill="${secondary}"/>`;
    case 'SASH':
      return `<polygon points="70,40 100,40 190,250 160,250" fill="${secondary}"/>`;
    default:
      return '';
  }
}

/**
 * @param {object} o
 * @param {string} o.primary   màu chính
 * @param {string} o.secondary màu phụ (viền cổ, tay, họa tiết)
 * @param {string} [o.pattern] PLAIN | STRIPES | HOOPS | HALVES | SASH
 * @param {'front'|'back'} [o.view]
 * @param {string|number} [o.number]
 * @param {string} [o.name]
 * @param {string} [o.label] mô tả cho trình đọc màn hình
 */
export function jerseySvg({ primary = '#FFFFFF', secondary = '#0B1220', pattern: kind = 'PLAIN', view = 'front', number, name, label = 'Áo đấu' } = {}) {
  const id = `jy${(uid += 1)}`;
  const trim = kind === 'PLAIN' ? secondary : inkOn(primary, secondary) === secondary ? secondary : '#0B1220';
  const ink = inkOn(primary, secondary);
  const showNumber = view === 'back' || number !== undefined;
  const safeName = escapeHtml(String(name ?? '').toUpperCase().slice(0, 12));
  const safeNumber = escapeHtml(String(number ?? '').slice(0, 2));

  // Logo hãng (3 sọc chéo) bên phải người xem, huy hiệu khiên bên trái ngực người mặc
  const front = `
    <g fill="${trim}" opacity=".9">
      <path d="M80 70 l4 -8 h3 l-4 8 z M86 70 l4 -8 h3 l-4 8 z M92 70 l4 -8 h3 l-4 8 z"/>
      <path d="M146 58 h16 v8 q0 8 -8 11 q-8 -3 -8 -11 z"/>
    </g>
    <path d="M120 33 v20" stroke="${trim}" stroke-opacity=".35" stroke-width="2"/>`;
  const back = `
    ${safeName ? `<text x="120" y="82" text-anchor="middle" font-family="Archivo, Inter, sans-serif" font-weight="800" font-size="17" letter-spacing="2" fill="${ink}">${safeName}</text>` : ''}
    ${showNumber ? `<text x="120" y="172" text-anchor="middle" font-family="Archivo, Inter, sans-serif" font-weight="900" font-size="78" fill="${ink}">${safeNumber}</text>` : ''}`;

  return `<svg class="jersey-svg" viewBox="0 0 240 260" role="img" aria-label="${escapeHtml(label)}">
  <defs>
    <clipPath id="${id}c"><path d="${OUTLINE}"/></clipPath>
    <linearGradient id="${id}s" x1="0" x2="1">
      <stop offset="0" stop-color="#000" stop-opacity=".16"/>
      <stop offset=".18" stop-color="#000" stop-opacity="0"/>
      <stop offset=".5" stop-color="#fff" stop-opacity=".1"/>
      <stop offset=".82" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity=".18"/>
    </linearGradient>
    <linearGradient id="${id}v" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".12"/>
      <stop offset="1" stop-color="#000" stop-opacity=".1"/>
    </linearGradient>
  </defs>
  <g clip-path="url(#${id}c)">
    <rect width="240" height="260" fill="${primary}"/>
    ${pattern(kind, secondary)}
    <path d="M12 66 L37 104 L43 100 L18 62 Z M228 66 L203 104 L197 100 L222 62 Z" fill="${trim}"/>
    <rect width="240" height="260" fill="url(#${id}s)"/>
    <rect width="240" height="260" fill="url(#${id}v)"/>
    <path d="M96 150 Q110 170 104 210 M150 130 Q140 170 150 220" stroke="#000" stroke-opacity=".05" stroke-width="3" fill="none"/>
  </g>
  <path d="${OUTLINE}" fill="none" stroke="#0B1220" stroke-opacity=".14" stroke-width="1.5"/>
  <path d="M92 16 C104 34 136 34 148 16" fill="none" stroke="${trim}" stroke-width="7" stroke-linecap="round"/>
  ${view === 'back' ? back : front}
  ${view !== 'back' && showNumber ? back : ''}
</svg>`;
}

export const teamJersey = (team, options = {}) =>
  jerseySvg({
    primary: team.primaryColor,
    secondary: team.secondaryColor,
    pattern: team.kitPattern,
    label: `Áo đấu ${team.name}`,
    ...options,
  });
