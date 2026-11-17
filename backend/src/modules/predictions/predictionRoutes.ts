import { Router } from 'express';
import { authenticateJwt } from '../../middleware/auth.js';
import {
  getDemandPrediction,
  getBatchExpiryRisk,
} from './predictionController.js';

export const predictionRoutes = Router();

predictionRoutes.use(authenticateJwt);

predictionRoutes.get('/demand/:productId', getDemandPrediction);
predictionRoutes.get('/expiry-risk/:batchId', getBatchExpiryRisk);
