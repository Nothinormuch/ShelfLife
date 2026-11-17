import { Response, NextFunction } from 'express';
import { prisma } from '../../db/prisma.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { triggerModelEvaluationForStore } from './evaluationService.js';

export const runEvaluation = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = req.user!.storeId;
    const result = await triggerModelEvaluationForStore(storeId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getLatestEvaluation = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = req.user!.storeId;
    const modelVersion = req.query.modelVersion as string | undefined;

    // Find latest aggregate evaluation
    const whereClause: any = { storeId, productId: null };
    if (modelVersion) {
      whereClause.modelVersion = modelVersion;
    }

    const latestAggregate = await prisma.modelEvaluation.findFirst({
      where: whereClause,
      orderBy: { evaluatedAt: 'desc' },
    });

    if (!latestAggregate) {
      res.status(200).json({
        aggregate: null,
        byProduct: [],
      });
      return;
    }

    // Find per-product evaluations generated at the same timestamp (within 2 seconds) and modelVersion
    const evaluatedAtWindowStart = new Date(latestAggregate.evaluatedAt.getTime() - 2000);
    const evaluatedAtWindowEnd = new Date(latestAggregate.evaluatedAt.getTime() + 2000);

    const byProduct = await prisma.modelEvaluation.findMany({
      where: {
        storeId,
        modelVersion: latestAggregate.modelVersion,
        productId: { not: null },
        evaluatedAt: {
          gte: evaluatedAtWindowStart,
          lte: evaluatedAtWindowEnd,
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
      },
    });

    res.status(200).json({
      aggregate: latestAggregate,
      byProduct,
    });
  } catch (error) {
    next(error);
  }
};

export const getEvaluationHistory = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = req.user!.storeId;
    const modelVersion = req.query.modelVersion as string | undefined;

    const whereClause: any = { storeId, productId: null };
    if (modelVersion) {
      whereClause.modelVersion = modelVersion;
    }

    const items = await prisma.modelEvaluation.findMany({
      where: whereClause,
      orderBy: { evaluatedAt: 'desc' },
    });

    res.status(200).json({ items });
  } catch (error) {
    next(error);
  }
};
