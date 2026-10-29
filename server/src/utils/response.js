export const ok = (res, data = null, meta) =>
  res.json({ success: true, data, ...(meta && { meta }) });

export const created = (res, data) => res.status(201).json({ success: true, data });

export const noContent = (res) => res.json({ success: true, data: null });
