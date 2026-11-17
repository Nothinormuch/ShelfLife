import { Router } from 'express';
import { authenticateJwt } from '../../middleware/auth.js';
import {
  getRecommendations,
  getRecommendationHistory,
} from './recommendationController.js';

export const recommendationRoutes = Router();

recommendationRoutes.use(authenticateJwt);

recommendationRoutes.get('/', getRecommendations);
recommendationRoutes.get('/history', getRecommendationHistory);
