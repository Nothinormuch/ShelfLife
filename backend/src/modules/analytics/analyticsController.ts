import { Response, NextFunction } from 'express';
import { prisma } from '../../db/prisma.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';

export const getWasteAnalytics = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = req.user!.storeId;
    const fromStr = req.query.from as string | undefined;
    const toStr = req.query.to as string | undefined;

    const where: any = {
      storeId,
      status: 'EXPIRED',
    };

    if (fromStr || toStr) {
      where.expiryDate = {};
      if (fromStr) where.expiryDate.gte = new Date(fromStr);
      if (toStr) where.expiryDate.lte = new Date(toStr);
    }

    const expiredBatches = await prisma.batch.findMany({
      where,
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

    // Calculate total as sum of (quantityRemaining at time of expiry) * purchaseCostPerUnit
    const byProductMap = new Map<string, { productId: string; productName: string; category: string; wastedQuantity: number; wastedCost: number }>();
    let totalWastedQuantity = 0;
    let totalWastedCost = 0;

    for (const b of expiredBatches) {
      const qty = Number(b.quantityRemaining);
      const cost = Number(b.purchaseCostPerUnit);
      const wastedCost = qty * cost;

      totalWastedQuantity += qty;
      totalWastedCost += wastedCost;

      const existing = byProductMap.get(b.productId) || {
        productId: b.productId,
        productName: b.product.name,
        category: b.product.category,
        wastedQuantity: 0,
        wastedCost: 0,
      };

      existing.wastedQuantity += qty;
      existing.wastedCost += wastedCost;
      byProductMap.set(b.productId, existing);
    }

    const byProduct = Array.from(byProductMap.values()).map(p => ({
      productId: p.productId,
      productName: p.productName,
      category: p.category,
      wastedQuantity: Number(p.wastedQuantity.toFixed(2)),
      wastedCost: Number(p.wastedCost.toFixed(2)),
    }));

    res.status(200).json({
      byProduct,
      total: {
        wastedQuantity: Number(totalWastedQuantity.toFixed(2)),
        wastedCost: Number(totalWastedCost.toFixed(2)),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getRevenueAnalytics = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = req.user!.storeId;
    const fromStr = req.query.from as string | undefined;
    const toStr = req.query.to as string | undefined;

    const salesWhere: any = { storeId };
    if (fromStr || toStr) {
      salesWhere.date = {};
      if (fromStr) salesWhere.date.gte = new Date(fromStr);
      if (toStr) salesWhere.date.lte = new Date(toStr);
    }

    const sales = await prisma.saleRecord.findMany({
      where: salesWhere,
      include: {
        product: {
          select: {
            defaultPurchaseCost: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    // Group sales by date
    const dailyMap = new Map<string, { date: string; revenue: number; cost: number; grossMargin: number }>();

    for (const s of sales) {
      const dateKey = s.date.toISOString().split('T')[0];
      const entry = dailyMap.get(dateKey) || { date: dateKey, revenue: 0, cost: 0, grossMargin: 0 };
      const rev = Number(s.revenue);
      const c = Number(s.quantitySold) * Number(s.product.defaultPurchaseCost);

      entry.revenue += rev;
      entry.cost += c;
      entry.grossMargin += (rev - c);
      dailyMap.set(dateKey, entry);
    }

    const series = Array.from(dailyMap.values()).map(d => ({
      date: d.date,
      revenue: Number(d.revenue.toFixed(2)),
      cost: Number(d.cost.toFixed(2)),
      grossMargin: Number(d.grossMargin.toFixed(2)),
    }));

    // Estimated waste loss and recommendation savings derived from stored records
    const expiredBatches = await prisma.batch.findMany({
      where: { storeId, status: 'EXPIRED' },
    });

    const estimatedWasteLoss = expiredBatches.reduce(
      (sum, b) => sum + Number(b.quantityRemaining) * Number(b.purchaseCostPerUnit),
      0
    );

    // Estimated recommendation savings: Discount recommendations save stock from complete waste write-off
    const discountRecs = await prisma.recommendation.findMany({
      where: { storeId, type: 'DISCOUNT' },
      include: { product: true },
    });

    const estimatedRecommendationSavings = discountRecs.reduce((sum, r) => {
      const rationale = r.rationale as any;
      const atRisk = Number(rationale?.quantityAtRisk || 0);
      const cost = Number(r.product.defaultPurchaseCost);
      // Saved cost = recovered value (assuming 70% of at-risk units sold at markdown instead of 100% loss)
      return sum + (atRisk * cost * 0.7);
    }, 0);

    res.status(200).json({
      series,
      estimatedWasteLoss: Number(estimatedWasteLoss.toFixed(2)),
      estimatedRecommendationSavings: Number(estimatedRecommendationSavings.toFixed(2)),
    });
  } catch (error) {
    next(error);
  }
};

export const getProductAnalytics = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = req.user!.storeId;
    const { productId } = req.params;

    const product = await prisma.product.findFirst({
      where: { id: productId, storeId },
    });

    if (!product) {
      res.status(404).json({ error: 'not_found', message: 'Product not found' });
      return;
    }

    const [sales, batches, predictions, expiredBatches] = await Promise.all([
      prisma.saleRecord.findMany({
        where: { productId, storeId },
        orderBy: { date: 'asc' },
      }),
      prisma.batch.findMany({
        where: { productId, storeId },
        orderBy: { purchaseDate: 'desc' },
      }),
      prisma.demandPrediction.findMany({
        where: { productId, storeId },
        orderBy: { generatedAt: 'asc' },
      }),
      prisma.batch.findMany({
        where: { productId, storeId, status: 'EXPIRED' },
        orderBy: { expiryDate: 'desc' },
      }),
    ]);

    // Sales trend
    const salesTrend = sales.map(s => ({
      date: s.date.toISOString().split('T')[0],
      quantitySold: Number(s.quantitySold),
      revenue: Number(s.revenue),
    }));

    // Demand accuracy (join predictions with actual sales by date)
    const actualMap = new Map<string, number>();
    sales.forEach(s => actualMap.set(s.date.toISOString().split('T')[0], Number(s.quantitySold)));

    const demandAccuracy = predictions.map(p => {
      const dateStr = p.generatedAt.toISOString().split('T')[0];
      const actual = actualMap.get(dateStr) ?? Number(p.predictedQuantity);
      return {
        date: dateStr,
        predicted: Number(p.predictedQuantity),
        actual,
      };
    });

    // Waste history
    const wasteHistory = expiredBatches.map(b => ({
      date: b.expiryDate.toISOString().split('T')[0],
      wastedQuantity: Number(b.quantityRemaining),
      wastedCost: Number((Number(b.quantityRemaining) * Number(b.purchaseCostPerUnit)).toFixed(2)),
    }));

    res.status(200).json({
      salesTrend,
      batchHistory: batches,
      demandAccuracy,
      wasteHistory,
    });
  } catch (error) {
    next(error);
  }
};
