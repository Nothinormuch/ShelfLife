import { Router } from 'express';
import { authenticateJwt } from '../../middleware/auth.js';
import {
  getProductBatches,
  receiveStock,
  getExpiringBatches,
} from './batchController.js';

export const batchRoutes = Router();

batchRoutes.use(authenticateJwt);

// /api/v1/batches/expiring
batchRoutes.get('/expiring', getExpiringBatches);

// Can also mount product batch routes
export const productBatchRoutes = Router({ mergeParams: true });
productBatchRoutes.use(authenticateJwt);
productBatchRoutes.get('/', getProductBatches);
productBatchRoutes.post('/', receiveStock);
