import { Router } from 'express';
import { register, login, refresh } from './authController.js';

export const authRoutes = Router();

authRoutes.post('/register', register);
authRoutes.post('/login', login);
authRoutes.post('/refresh', refresh);
