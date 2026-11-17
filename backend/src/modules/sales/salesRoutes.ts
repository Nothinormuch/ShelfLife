import { Router } from 'express';
import { authenticateJwt } from '../../middleware/auth.js';
import { generateSales, getSales } from './salesController.js';

export const salesRoutes = Router();

salesRoutes.use(authenticateJwt);

salesRoutes.post('/generate', generateSales);
salesRoutes.get('/', getSales);
