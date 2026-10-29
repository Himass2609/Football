import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const signAccessToken = (account) =>
  jwt.sign({ sub: account.id, role: account.role.code }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

export const signPurposeToken = (payload, purpose, expiresIn) =>
  jwt.sign({ ...payload, purpose }, env.jwtSecret, { expiresIn });

export const verifyToken = (token) => jwt.verify(token, env.jwtSecret);
