import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authController, profileController } from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
  verifyOtpSchema,
} from '../validators/auth.validator.js';

const limiter = (limit, minutes) =>
  rateLimit({
    windowMs: minutes * 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) =>
      res.status(429).json({
        success: false,
        error: { code: 'TOO_MANY_REQUESTS', message: 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút', details: [] },
      }),
  });

export const authRouter = Router();

authRouter.post('/register', limiter(10, 15), validate({ body: registerSchema }), authController.register);
authRouter.post('/login', limiter(10, 15), validate({ body: loginSchema }), authController.login);
authRouter.post('/logout', authController.logout);
authRouter.post('/forgot-password', limiter(5, 15), validate({ body: forgotPasswordSchema }), authController.forgotPassword);
authRouter.post('/verify-otp', limiter(15, 15), validate({ body: verifyOtpSchema }), authController.verifyOtp);
authRouter.post('/reset-password', limiter(10, 15), validate({ body: resetPasswordSchema }), authController.resetPassword);
authRouter.get('/me', authenticate, authController.me);
authRouter.post('/change-password', authenticate, validate({ body: changePasswordSchema }), authController.changePassword);

export const accountRouter = Router();

accountRouter.use(authenticate);
accountRouter.get('/profile', profileController.get);
accountRouter.put('/profile', validate({ body: updateProfileSchema }), profileController.update);
