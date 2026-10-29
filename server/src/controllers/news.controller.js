import { newsService } from '../services/news.service.js';
import { created, noContent, ok } from '../utils/response.js';

export const newsController = {
  listPublic: async (req, res) => {
    const { items, meta } = await newsService.listPublic(req.valid.query);
    ok(res, items, meta);
  },
  getPublic: async (req, res) => ok(res, await newsService.getPublicBySlug(req.valid.params.slug)),

  listAdmin: async (req, res) => {
    const { items, meta } = await newsService.listAdmin(req.valid.query);
    ok(res, items, meta);
  },
  get: async (req, res) => ok(res, await newsService.getById(req.valid.params.id)),
  create: async (req, res) => created(res, await newsService.create(req.user.id, req.valid.body)),
  update: async (req, res) => ok(res, await newsService.update(req.valid.params.id, req.valid.body)),
  changeStatus: async (req, res) => ok(res, await newsService.changeStatus(req.valid.params.id, req.valid.body.status)),
  remove: async (req, res) => {
    await newsService.remove(req.valid.params.id);
    noContent(res);
  },
};
