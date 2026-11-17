import { Router } from 'express';
import { authenticateJwt } from '../../middleware/auth.js';
import {
  getWasteAnalytics,
  getRevenueAnalytics,
  getProductAnalytics,
} from './analyticsController.js';

export const analyticsRoutes = Router();

analyticsRoutes.use(authenticateJwt);

analyticsRoutes.get('/waste', getWasteAnalytics);
analyticsRoutes.get('/revenue', getRevenueAnalytics);
analyticsRoutes.get('/products/:productId', getProductAnalytics);
