import { z } from 'zod';

z.config({
  customError: (issue) => {
    if (issue.code === 'invalid_type') return issue.input === undefined || issue.input === null ? 'Trường này là bắt buộc' : 'Sai kiểu dữ liệu';
    if (issue.code === 'too_small') {
      if (issue.origin === 'string') return Number(issue.minimum) === 1 ? 'Trường này là bắt buộc' : `Tối thiểu ${issue.minimum} ký tự`;
      if (issue.origin === 'array') return `Chọn ít nhất ${issue.minimum} mục`;
      return `Giá trị tối thiểu là ${issue.minimum}`;
    }
    if (issue.code === 'too_big') return issue.origin === 'string' ? `Tối đa ${issue.maximum} ký tự` : `Giá trị tối đa là ${issue.maximum}`;
    if (issue.code === 'invalid_format') return 'Sai định dạng';
    if (issue.code === 'invalid_value') return 'Giá trị không hợp lệ';
    return undefined;
  },
});

export { z };

export const id = z.coerce.number().int().positive();
export const idParam = z.object({ id });
export const nullableId = z.union([id, z.null()]).optional();

export const requiredText = (max, min = 1) => z.string().trim().min(min).max(max);

// '' → null; undefined giữ nguyên để update từng phần không xóa mất dữ liệu
export const optionalText = (max) =>
  z.string().trim().max(max).nullish().transform((value) => (value === undefined ? undefined : value || null));

export const optionalUrl = optionalText(500).refine(
  (value) => value == null || /^(\/|https?:\/\/)/.test(value),
  'Đường dẫn phải bắt đầu bằng / hoặc http(s)://',
);

export const email = z.string().trim().toLowerCase().max(100).email('Email không hợp lệ');
export const phone = z.string().trim().regex(/^(0|\+84)(3|5|7|8|9)\d{8}$/, 'Số điện thoại không hợp lệ');
export const optionalPhone = z.union([phone, z.literal('').transform(() => null), z.null()]).optional();
export const password = z
  .string()
  .min(8, 'Mật khẩu tối thiểu 8 ký tự')
  .max(64)
  .regex(/[A-Za-z]/, 'Mật khẩu phải chứa chữ cái')
  .regex(/\d/, 'Mật khẩu phải chứa chữ số');

export const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Mã màu dạng #RRGGBB')
  .transform((v) => v.toUpperCase());
export const money = z.coerce.number().int('Số tiền phải là số nguyên').min(0).max(9_999_999_999);
export const boolean = z.union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')]);
export const queryBool = z.enum(['true', 'false']).transform((v) => v === 'true').optional();
export const date = z.coerce.date({ error: 'Ngày giờ không hợp lệ' });

export const listQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  // Trần cứng; mỗi service tự giới hạn tiếp qua getPagination(maxLimit)
  limit: z.coerce.number().int().min(1).max(200).optional(),
  q: z.string().trim().max(100).optional(),
  isActive: queryBool,
});
