import { Response, NextFunction } from 'express';
import { prisma } from '../../db/prisma.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { generateFreshRecommendations } from './recommendationService.js';

export const getRecommendations = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = req.user!.storeId;
    const type = req.query.type as 'RESTOCK' | 'DISCOUNT' | undefined;
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const pageSize = Math.max(1, parseInt(req.query.pageSize as string || '25', 10));

    // Fresh on-demand generation per FR-18 / Section 3.6
    await generateFreshRecommendations(storeId, type);

    // EC-7: Fetch latest recommendations per (type, productId, batchId)
    // Order by generatedAt desc, then group/deduplicate to return only current
    const whereClause: any = { storeId };
    if (type) {
      whereClause.type = type;
    }

    const allRecs = await prisma.recommendation.findMany({
      where: whereClause,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            category: true,
            unit: true,
            defaultSellingPrice: true,
          },
        },
        batch: {
          select: {
            id: true,
            quantityRemaining: true,
            expiryDate: true,
          },
        },
      },
      orderBy: { generatedAt: 'desc' },
    });

    // Deduplicate: key = `${type}_${productId}_${batchId || 'all'}`
    const seen = new Set<string>();
    const currentRecs = [];
    for (const rec of allRecs) {
      const key = `${rec.type}_${rec.productId}_${rec.batchId || 'none'}`;
      if (!seen.has(key)) {
        seen.add(key);
        currentRecs.push(rec);
      }
    }

    const total = currentRecs.length;
    const skip = (page - 1) * pageSize;
    const items = currentRecs.slice(skip, skip + pageSize);

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

export const getRecommendationHistory = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = req.user!.storeId;
    const type = req.query.type as 'RESTOCK' | 'DISCOUNT' | undefined;
    const fromStr = req.query.from as string | undefined;
    const toStr = req.query.to as string | undefined;
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const pageSize = Math.max(1, parseInt(req.query.pageSize as string || '25', 10));
    const skip = (page - 1) * pageSize;

    const whereClause: any = { storeId };
    if (type) {
      whereClause.type = type;
    }
    if (fromStr || toStr) {
      whereClause.generatedAt = {};
      if (fromStr) whereClause.generatedAt.gte = new Date(fromStr);
      if (toStr) whereClause.generatedAt.lte = new Date(toStr);
    }

    // AC-8: Reads persisted history ONLY, NO recomputation
    const [total, items] = await Promise.all([
      prisma.recommendation.count({ where: whereClause }),
      prisma.recommendation.findMany({
        where: whereClause,
        skip,
        take: pageSize,
        orderBy: { generatedAt: 'desc' },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              category: true,
            },
          },
          batch: {
            select: {
              id: true,
              quantityRemaining: true,
              expiryDate: true,
            },
          },
        },
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
