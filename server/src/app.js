import path from 'node:path';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';
import { UPLOAD_DIR } from './middlewares/upload.js';
import { adminRouter } from './routes/admin.routes.js';
import { accountRouter, authRouter } from './routes/auth.routes.js';
import { publicRouter } from './routes/public.routes.js';

const CLIENT_DIR = path.resolve(import.meta.dirname, '../../client');
// Ảnh sản phẩm / logo giải có sẵn (thư mục image/ ở gốc repo, không commit)
const IMAGE_DIR = path.resolve(import.meta.dirname, '../../image');

export const app = express();

app.set('trust proxy', 1);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com', 'https://cdn.jsdelivr.net', "'unsafe-inline'"],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'"],
      },
    },
  }),
);
app.use(cors({ origin: env.isDev ? true : env.appUrl }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan(env.isDev ? 'dev' : 'combined'));

app.get('/api/v1/health', (_req, res) => res.json({ success: true, data: { status: 'ok', time: new Date() } }));
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/account', accountRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1', publicRouter);
app.use('/api', notFoundHandler);

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));
app.use('/images', express.static(IMAGE_DIR, { maxAge: '7d' }));
app.use(express.static(CLIENT_DIR, { extensions: ['html'] }));
app.use((_req, res) => res.status(404).sendFile(path.join(CLIENT_DIR, '404.html')));

app.use(errorHandler);
