import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRoutes } from './modules/auth/authRoutes.js';
import { productRoutes } from './modules/products/productRoutes.js';
import { batchRoutes, productBatchRoutes } from './modules/batches/batchRoutes.js';
import { salesRoutes } from './modules/sales/salesRoutes.js';
import { predictionRoutes } from './modules/predictions/predictionRoutes.js';
import { recommendationRoutes } from './modules/recommendations/recommendationRoutes.js';
import { evaluationRoutes } from './modules/evaluation/evaluationRoutes.js';
import { analyticsRoutes } from './modules/analytics/analyticsRoutes.js';

const app = express();

// CORS configuration driven by environment variable (C-8b)
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or Postman)
      if (!origin) return callback(null, true);
      if (
        config.corsOrigin.includes('*') ||
        config.corsOrigin.includes(origin) ||
        config.corsOrigin.some((o) => origin.startsWith(o))
      ) {
        return callback(null, true);
      }
      return callback(new Error(`CORS origin ${origin} not allowed`), false);
    },
    credentials: true,
  })
);

app.use(express.json());

// Lightweight health check endpoint with no auth required (C-8c)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// API v1 Routers
const apiRouter = express.Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/products/:productId/batches', productBatchRoutes);
apiRouter.use('/products', productRoutes);
apiRouter.use('/batches', batchRoutes);
apiRouter.use('/sales', salesRoutes);
apiRouter.use('/predictions', predictionRoutes);
apiRouter.use('/recommendations', recommendationRoutes);
apiRouter.use('/ml/evaluation', evaluationRoutes);
apiRouter.use('/analytics', analyticsRoutes);

app.use('/api/v1', apiRouter);

// Global Error Handler
app.use(errorHandler);

const PORT = config.port;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ShelfLife Backend API listening on port ${PORT}`);
  });
}

export default app;
