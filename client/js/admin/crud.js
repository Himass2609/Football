// Trang CRUD dùng chung cho admin: bảng + tìm kiếm + bộ lọc + phân trang + form trong dialog
import { api, request } from '../api.js';
import {
  $,
  $$,
  clearFieldErrors,
  confirmDialog,
  debounce,
  emptyState,
  escapeHtml,
  handleFormError,
  html,
  icon,
  raw,
  renderPagination,
  setLoading,
  toDateTimeLocal,
  toast,
} from '../ui.js';

/**
 * @typedef {object} Field
 * @property {string} name
 * @property {string} label
 * @property {'text'|'email'|'tel'|'password'|'textarea'|'number'|'select'|'color'|'switch'|'datetime'|'date'|'image'|'checkboxes'} [type]
 * @property {boolean} [required]
 * @property {boolean} [span]        chiếm 2 cột
 * @property {boolean} [numeric]     select trả về số
 * @property {Array|Function} [options] [{value,label}] hoặc async () => [...]
 * @property {(values:object)=>boolean} [showIf]
 * @property {'create'|'edit'} [only]
 * @property {*} [default]
 * @property {(row:object)=>*} [get]  lấy giá trị ban đầu khi sửa
 */

const optionCache = new WeakMap();
async function resolveOptions(field) {
  if (Array.isArray(field.options)) return field.options;
  if (typeof field.options !== 'function') return [];
  if (!optionCache.has(field)) optionCache.set(field, field.options());
  return optionCache.get(field);
}

export const invalidateOptions = (field) => optionCache.delete(field);

// Dữ liệu cho select lấy từ API admin (gồm cả mục ngừng hoạt động)
export const optionsFrom = (endpoint, labelKey = 'name') => async () => {
  const { data } = await api.get(endpoint, { limit: 200 });
  return data.map((item) => ({ value: item.id, label: item[labelKey] }));
};

async function fieldHtml(field) {
  const id = `f-${field.name}`;
  const req = field.required ? raw(' <span class="req">*</span>') : '';
  const label = html`<label class="label" for="${id}">${field.label}${req}</label>`;
  const help = field.help ? html`<span class="field-help">${field.help}</span>` : '';
  const attrs = raw(`id="${id}" name="${field.name}" ${field.required ? 'required' : ''} ${field.maxlength ? `maxlength="${field.maxlength}"` : ''}`);
  const ph = field.placeholder ?? '';
  let control;

  switch (field.type) {
    case 'textarea':
      control = html`<textarea class="textarea" ${attrs} rows="${field.rows ?? 4}" placeholder="${ph}"></textarea>`;
      break;
    case 'select': {
      const options = await resolveOptions(field);
      control = html`<select class="select" ${attrs}>
        ${field.required ? '' : raw(`<option value="">${escapeHtml(field.emptyLabel ?? '— Không chọn —')}</option>`)}
        ${options.map((o) => raw(html`<option value="${o.value}">${o.label}</option>`))}
      </select>`;
      break;
    }
    case 'checkboxes': {
      const options = await resolveOptions(field);
      control = html`<div class="check-list" id="${id}">
        ${options.length
          ? options.map((o) => raw(html`<label class="check"><input type="checkbox" name="${field.name}" value="${o.value}">${o.label}</label>`))
          : raw('<span class="text-small text-muted-c">Chưa có lựa chọn</span>')}
      </div>`;
      break;
    }
    case 'switch':
      return html`<div class="field ${field.span ? 'span-2' : ''}" data-field="${field.name}">
        <label class="switch"><input type="checkbox" ${attrs}><span>${field.label}</span></label>${raw(help)}</div>`;
    case 'color':
      control = html`<div class="color-field">
        <input class="input input-color" type="color" data-color-picker="${field.name}" aria-label="Chọn màu">
        <input class="input" ${attrs} placeholder="#RRGGBB" maxlength="7">
      </div>`;
      break;
    case 'image':
      control = html`<div class="image-field">
        <img class="thumb" data-preview="${field.name}" alt="" hidden>
        <input class="input" ${attrs} placeholder="/uploads/... hoặc https://...">
        <label class="btn btn-outline btn-sm">${raw(icon('upload', 14))}Tải ảnh
          <input type="file" accept="image/png,image/jpeg,image/webp,image/avif" data-upload="${field.name}" hidden>
        </label>
      </div>`;
      break;
    case 'datetime':
      control = html`<input class="input" type="datetime-local" ${attrs}>`;
      break;
    default:
      control = html`<input class="input" type="${field.type ?? 'text'}" ${attrs} placeholder="${ph}" ${field.type === 'number' ? raw(`min="${field.min ?? 0}" ${field.step ? `step="${field.step}"` : ''}`) : ''}>`;
  }
  return html`<div class="field ${field.span ? 'span-2' : ''}" data-field="${field.name}">${raw(label)}${raw(control)}${raw(help)}</div>`;
}

function setValue(form, field, value) {
  const el = form.elements.namedItem(field.name);
  if (!el) return;
  switch (field.type) {
    case 'switch':
      el.checked = Boolean(value);
      break;
    case 'checkboxes': {
      const selected = new Set((value ?? []).map(String));
      $$(`input[name="${field.name}"]`, form).forEach((cb) => (cb.checked = selected.has(cb.value)));
      break;
    }
    case 'datetime':
      el.value = toDateTimeLocal(value);
      break;
    case 'color':
      el.value = value ?? '';
      $(`[data-color-picker="${field.name}"]`, form).value = /^#[0-9a-f]{6}$/i.test(value ?? '') ? value : '#000000';
      break;
    case 'image': {
      el.value = value ?? '';
      const preview = $(`[data-preview="${field.name}"]`, form);
      preview.hidden = !value;
      if (value) preview.src = value;
      break;
    }
    default:
      el.value = value ?? '';
  }
}

function readValue(form, field) {
  const el = form.elements.namedItem(field.name);
  switch (field.type) {
    case 'switch':
      return el.checked;
    case 'checkboxes':
      return $$(`input[name="${field.name}"]:checked`, form).map((cb) => Number(cb.value));
    case 'number':
      return el.value === '' ? null : Number(el.value);
    case 'select':
      return el.value === '' ? null : field.numeric ? Number(el.value) : el.value;
    case 'datetime':
      return el.value ? new Date(el.value).toISOString() : null;
    default:
      return el.value.trim() === '' ? (field.keepEmpty ? '' : null) : el.value.trim();
  }
}

function bindFieldBehaviors(form, fields, refreshVisibility) {
  form.addEventListener('input', (e) => {
    const picker = e.target.closest('[data-color-picker]');
    if (picker) form.elements.namedItem(picker.dataset.colorPicker).value = picker.value.toUpperCase();
    const hex = fields.find((f) => f.type === 'color' && f.name === e.target.name);
    if (hex && /^#[0-9a-f]{6}$/i.test(e.target.value)) $(`[data-color-picker="${hex.name}"]`, form).value = e.target.value;
    const image = fields.find((f) => f.type === 'image' && f.name === e.target.name);
    if (image) setValue(form, image, e.target.value);
    refreshVisibility();
  });
  form.addEventListener('change', async (e) => {
    refreshVisibility();
    const upload = e.target.closest('[data-upload]');
    if (!upload?.files.length) return;
    const body = new FormData();
    body.append('files', upload.files[0]);
    try {
      const { data } = await request('/admin/uploads', { method: 'POST', body });
      setValue(form, fields.find((f) => f.name === upload.dataset.upload), data[0].url);
      toast('Đã tải ảnh lên', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      upload.value = '';
    }
  });
}

/** Mở dialog form; resolve với dữ liệu trả về khi lưu thành công, null nếu hủy */
export async function openFormDialog({ title, fields, initial = {}, mode = 'create', submit, size = '', submitLabel = 'Lưu' }) {
  const visible = fields.filter((f) => !f.only || f.only === mode);
  const dialog = document.createElement('dialog');
  dialog.className = `dialog ${size}`;
  dialog.innerHTML = html`
    <form class="d-flex flex-column" style="min-height:0;flex:1" novalidate method="dialog">
      <div class="dialog-head">
        <h2 class="dialog-title">${title}</h2>
        <button class="icon-btn" type="button" data-close aria-label="Đóng">${raw(icon('x'))}</button>
      </div>
      <div class="dialog-body"><div class="form-grid">${raw((await Promise.all(visible.map(fieldHtml))).join(''))}</div></div>
      <div class="dialog-foot">
        <button class="btn btn-ghost btn-sm" type="button" data-close>Hủy</button>
        <button class="btn btn-dark btn-sm" type="submit" data-loading-text="Đang lưu...">${submitLabel}</button>
      </div>
    </form>`;
  document.body.append(dialog);
  const form = $('form', dialog);

  for (const field of visible) setValue(form, field, field.get ? field.get(initial) : (initial[field.name] ?? field.default));

  const values = () => Object.fromEntries(visible.map((f) => [f.name, readValue(form, f)]));
  const refreshVisibility = () => {
    const current = values();
    for (const field of visible) {
      if (!field.showIf) continue;
      $(`[data-field="${field.name}"]`, form).hidden = !field.showIf(current);
    }
  };
  bindFieldBehaviors(form, visible, refreshVisibility);
  refreshVisibility();

  return new Promise((resolve) => {
    const close = (result) => {
      dialog.close();
      dialog.remove();
      resolve(result);
    };
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      close(null);
    });
    dialog.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) close(null);
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearFieldErrors(form);
      const current = values();
      // Bỏ các trường đang ẩn theo điều kiện
      const payload = Object.fromEntries(
        Object.entries(current).filter(([name]) => !$(`[data-field="${name}"]`, form)?.hidden),
      );
      const button = $('[type="submit"]', form);
      setLoading(button, true);
      try {
        close(await submit(payload));
      } catch (err) {
        handleFormError(form, err);
        setLoading(button, false);
      }
    });
    dialog.showModal();
    form.querySelector('.input, .select, .textarea')?.focus();
  });
}

/**
 * @param {object} config
 * @param {string} config.endpoint          ví dụ '/admin/brands'
 * @param {string} config.label             tên thực thể (thương hiệu...)
 * @param {Array<{label:string, render:(row)=>string, className?:string}>} config.columns
 * @param {Field[]} config.fields
 * @param {Array<{name:string,label:string,options:Array}>} [config.filters]
 */
export function createCrudPage(config) {
  const {
    root = $('[data-crud]'),
    endpoint,
    label,
    columns,
    fields,
    filters = [],
    searchPlaceholder = 'Tìm kiếm...',
    limit = 20,
    canCreate = true,
    canDelete = true,
    rowActions = () => [],
    dialogSize = '',
    toPayload = (values) => values,
    // Ghi đè cách lưu khi một thao tác cần nhiều API (vd: sửa user + đổi vai trò)
    save = async (payload, row) =>
      row ? (await api.put(`${endpoint}/${row.id}`, payload)).data : (await api.post(endpoint, payload)).data,
    emptyIcon = 'layers',
  } = config;

  const state = { page: 1, q: '', filters: {}, rows: [] };

  root.innerHTML = html`
    <div class="card">
      <div class="toolbar">
        <label class="search-box">
          ${raw(icon('search', 18))}
          <span class="visually-hidden">Tìm kiếm</span>
          <input class="input" type="search" placeholder="${searchPlaceholder}" data-search>
        </label>
        ${filters.map((f) =>
          raw(html`<select class="select" data-filter="${f.name}" aria-label="${f.label}">
            <option value="">${f.label}</option>
            ${f.options.map((o) => raw(html`<option value="${o.value}">${o.label}</option>`))}
          </select>`),
        )}
        ${canCreate ? raw(html`<button class="btn btn-dark btn-sm ms-auto" type="button" data-create>${raw(icon('plus', 16))}Thêm ${label}</button>`) : ''}
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr>${columns.map((c) => raw(html`<th class="${c.className ?? ''}">${c.label}</th>`))}<th class="col-actions"><span class="visually-hidden">Thao tác</span></th></tr></thead>
          <tbody data-rows></tbody>
        </table>
      </div>
      <div class="pagination" data-pagination></div>
    </div>`;

  const tbody = $('[data-rows]', root);
  const colspan = columns.length + 1;

  async function load() {
    tbody.innerHTML = Array.from({ length: 4 }, () => `<tr><td colspan="${colspan}"><div class="skeleton" style="height:20px"></div></td></tr>`).join('');
    try {
      const { data, meta } = await api.get(endpoint, { page: state.page, limit, q: state.q, ...state.filters });
      state.rows = data;
      if (!data.length && state.page > 1) {
        state.page -= 1;
        return load();
      }
      tbody.innerHTML = data.length
        ? data
            .map(
              (row) => html`<tr data-id="${row.id}">
                ${columns.map((c) => raw(`<td class="${c.className ?? ''}">${c.render(row)}</td>`))}
                <td class="col-actions"><div class="row-actions">
                  ${rowActions(row).map((a) =>
                    raw(html`<button class="icon-btn ${a.danger ? 'danger' : ''}" type="button" data-action="${a.key}" title="${a.label}" aria-label="${a.label}">${raw(icon(a.icon, 18))}</button>`),
                  )}
                  <button class="icon-btn" type="button" data-action="edit" title="Sửa" aria-label="Sửa">${raw(icon('pencil', 18))}</button>
                  ${canDelete ? raw(html`<button class="icon-btn danger" type="button" data-action="delete" title="Xóa" aria-label="Xóa">${raw(icon('trash', 18))}</button>`) : ''}
                </div></td>
              </tr>`,
            )
            .join('')
        : `<tr><td colspan="${colspan}">${emptyState(emptyIcon, `Chưa có ${label} nào`, state.q || Object.values(state.filters).some(Boolean) ? 'Thử đổi từ khóa hoặc bộ lọc.' : '')}</td></tr>`;
      renderPagination($('[data-pagination]', root), meta, (page) => {
        state.page = page;
        load();
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="${colspan}">${emptyState('alert-circle', 'Không tải được dữ liệu', err.message)}</td></tr>`;
    }
  }

  async function openEditor(row) {
    const saved = await openFormDialog({
      title: row ? `Sửa ${label}` : `Thêm ${label}`,
      fields,
      initial: row ?? {},
      mode: row ? 'edit' : 'create',
      size: dialogSize,
      submit: (values) => save(toPayload(values, row), row),
    });
    if (saved) {
      toast(row ? 'Đã lưu thay đổi' : `Đã thêm ${label}`, 'success');
      load();
    }
  }

  async function remove(row) {
    const name = row.name ?? row.code ?? row.title ?? row.email ?? `#${row.id}`;
    const ok = await confirmDialog({
      title: `Xóa ${label}`,
      message: `Bạn chắc chắn muốn xóa "${name}"? Thao tác này không thể hoàn tác.`,
      confirmText: 'Xóa',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`${endpoint}/${row.id}`);
      toast(`Đã xóa ${label}`, 'success');
      load();
    } catch (err) {
      toast(err.message, 'error', 5000);
    }
  }

  root.addEventListener('click', async (e) => {
    if (e.target.closest('[data-create]')) return openEditor(null);
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const row = state.rows.find((r) => String(r.id) === btn.closest('tr').dataset.id);
    if (btn.dataset.action === 'edit') return openEditor(row);
    if (btn.dataset.action === 'delete') return remove(row);
    const action = rowActions(row).find((a) => a.key === btn.dataset.action);
    if (action) {
      try {
        if ((await action.run(row)) !== false) load();
      } catch (err) {
        toast(err.message, 'error', 5000);
      }
    }
  });

  $('[data-search]', root).addEventListener(
    'input',
    debounce((e) => {
      state.q = e.target.value.trim();
      state.page = 1;
      load();
    }),
  );
  $$('[data-filter]', root).forEach((select) =>
    select.addEventListener('change', () => {
      state.filters[select.dataset.filter] = select.value;
      state.page = 1;
      load();
    }),
  );

  load();
  return { reload: load, openEditor };
}

// ───────── Helpers hiển thị ô ─────────
export const activePill = (active) =>
  active ? '<span class="pill pill-green">Hoạt động</span>' : '<span class="pill pill-gray">Ngừng</span>';

export const mainCell = (main, sub) => html`<div class="cell-main">${main}</div>${sub ? raw(html`<div class="cell-sub">${sub}</div>`) : ''}`;

export const ACTIVE_FILTER = { name: 'isActive', label: 'Tất cả trạng thái', options: [{ value: 'true', label: 'Hoạt động' }, { value: 'false', label: 'Ngừng hoạt động' }] };
