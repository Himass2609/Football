import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const transporter = env.smtp.host
  ? nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    })
  : null;

export async function sendMail({ to, subject, html, text }) {
  if (!transporter) {
    // Chưa cấu hình SMTP: in ra console để test ở môi trường dev
    console.info(`[mail:dev] to=${to} | ${subject}\n${text}`);
    return;
  }
  await transporter.sendMail({ from: env.smtp.from, to, subject, html, text });
}
