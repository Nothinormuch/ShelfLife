import { Router } from 'express';
import { authenticateJwt } from '../../middleware/auth.js';
import {
  runEvaluation,
  getLatestEvaluation,
  getEvaluationHistory,
} from './evaluationController.js';

export const evaluationRoutes = Router();

evaluationRoutes.use(authenticateJwt);

evaluationRoutes.post('/run', runEvaluation);
evaluationRoutes.get('/', getLatestEvaluation);
evaluationRoutes.get('/history', getEvaluationHistory);
