// Gắn icon khai báo trong HTML: data-icon="name" (chèn trước), data-icon-after="name" (chèn sau)
import { $$, icon } from './ui.js';

export function hydrateIcons(root = document) {
  $$('[data-icon]', root).forEach((el) => {
    el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon, Number(el.dataset.iconSize) || 18));
    el.removeAttribute('data-icon');
  });
  $$('[data-icon-after]', root).forEach((el) => {
    el.insertAdjacentHTML('beforeend', icon(el.dataset.iconAfter, Number(el.dataset.iconSize) || 16));
    el.removeAttribute('data-icon-after');
  });
}
