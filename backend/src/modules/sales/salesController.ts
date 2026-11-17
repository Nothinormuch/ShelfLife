import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { generateSyntheticDataForStore } from './syntheticGenerator.js';
import { triggerModelEvaluationForStore } from '../evaluation/evaluationService.js';

const generateSalesSchema = z.object({
  days: z.number().int().positive().optional().default(180),
  productCount: z.number().int().positive().optional(),
  overwrite: z.boolean().optional().default(false),
});

export const generateSales = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = req.user!.storeId;
    const { days, productCount, overwrite } = generateSalesSchema.parse(req.body);

    const existingSalesCount = await prisma.saleRecord.count({
      where: { storeId },
    });

    if (existingSalesCount > 0 && !overwrite) {
      res.status(409).json({
        error: 'sales_history_exists',
        message: 'Store already has sales history. Pass overwrite: true to regenerate.',
      });
      return;
    }

    if (overwrite) {
      await prisma.$transaction([
        prisma.recommendation.deleteMany({ where: { storeId } }),
        prisma.expiryRisk.deleteMany({ where: { storeId } }),
        prisma.demandPrediction.deleteMany({ where: { storeId } }),
        prisma.modelEvaluation.deleteMany({ where: { storeId } }),
        prisma.saleRecord.deleteMany({ where: { storeId } }),
        prisma.batch.deleteMany({ where: { storeId } }),
        prisma.product.deleteMany({ where: { storeId } }),
      ]);
    }

    const result = await generateSyntheticDataForStore(storeId, days, productCount);

    // FR-33: Automatically trigger evaluation run after data generation
    try {
      await triggerModelEvaluationForStore(storeId);
    } catch (evalErr) {
      console.warn('Post-generation model evaluation warning:', evalErr);
    }

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getSales = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = req.user!.storeId;
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const pageSize = Math.max(1, parseInt(req.query.pageSize as string || '25', 10));
    const skip = (page - 1) * pageSize;

    const productId = req.query.productId as string | undefined;
    const fromStr = req.query.from as string | undefined;
    const toStr = req.query.to as string | undefined;

    const where: any = { storeId };
    if (productId) {
      where.productId = productId;
    }
    if (fromStr || toStr) {
      where.date = {};
      if (fromStr) where.date.gte = new Date(fromStr);
      if (toStr) where.date.lte = new Date(toStr);
    }

    const [total, items] = await Promise.all([
      prisma.saleRecord.count({ where }),
      prisma.saleRecord.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { date: 'desc' },
      }),
    ]);

    res.status(200).json({
      items,
      page,
      pageSize,
      total,
    });
  } catch (error) {
    next(error);
  }
};
