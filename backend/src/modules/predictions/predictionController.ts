import { Response, NextFunction } from 'express';
import { prisma } from '../../db/prisma.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { mlClient } from '../../clients/mlClient.js';

export const getDemandPrediction = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
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

    const sales = await prisma.saleRecord.findMany({
      where: { productId, storeId },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        quantitySold: true,
      },
    });

    const salesHistory = sales.map((s) => ({
      date: s.date.toISOString().split('T')[0],
      quantitySold: Number(s.quantitySold),
    }));

    // Call ML service
    const mlResult = await mlClient.predictDemand({
      storeId,
      productId,
      horizon: 'NEXT_DAY',
      salesHistory,
    });

    // Persist prediction
    const prediction = await prisma.demandPrediction.create({
      data: {
        storeId,
        productId,
        horizon: 'NEXT_DAY',
        predictedQuantity: mlResult.predictedQuantity,
        isFallback: mlResult.isFallback,
        fallbackReason: mlResult.fallbackReason,
        modelVersion: mlResult.modelVersion,
        generatedAt: new Date(),
      },
    });

    res.status(200).json(prediction);
  } catch (error) {
    next(error);
  }
};

export const getBatchExpiryRisk = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = req.user!.storeId;
    const { batchId } = req.params;

    const batch = await prisma.batch.findFirst({
      where: { id: batchId, storeId },
      include: { product: true },
    });

    if (!batch) {
      res.status(404).json({ error: 'not_found', message: 'Batch not found' });
      return;
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const expDate = new Date(batch.expiryDate);
    expDate.setUTCHours(0, 0, 0, 0);

    const diffMs = expDate.getTime() - today.getTime();
    const daysToExpiry = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    // Get demand prediction for product
    const sales = await prisma.saleRecord.findMany({
      where: { productId: batch.productId, storeId },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        quantitySold: true,
      },
    });

    const salesHistory = sales.map((s) => ({
      date: s.date.toISOString().split('T')[0],
      quantitySold: Number(s.quantitySold),
    }));

    const demandResult = await mlClient.predictDemand({
      storeId,
      productId: batch.productId,
      salesHistory,
    });

    // Call ML service for expiry risk
    const riskResult = await mlClient.predictExpiryRisk({
      storeId,
      batchId: batch.id,
      productId: batch.productId,
      quantityRemaining: Number(batch.quantityRemaining),
      daysToExpiry: Math.max(0, daysToExpiry),
      demandPrediction: demandResult.predictedQuantity,
    });

    // Persist
    const expiryRisk = await prisma.expiryRisk.create({
      data: {
        storeId,
        batchId: batch.id,
        predictedUnsoldQuantity: riskResult.predictedUnsoldQuantity,
        riskScore: riskResult.riskScore,
        generatedAt: new Date(),
      },
    });

    res.status(200).json(expiryRisk);
  } catch (error) {
    next(error);
  }
};
