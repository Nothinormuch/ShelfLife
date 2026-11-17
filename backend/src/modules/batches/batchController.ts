import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';

const receiveStockSchema = z.object({
  quantityReceived: z.number().positive('Quantity received must be greater than 0'),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Purchase date must be YYYY-MM-DD'),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Expiry date must be YYYY-MM-DD'),
  purchaseCostPerUnit: z.number().positive('Purchase cost per unit must be greater than 0'),
}).refine(data => {
  const pDate = new Date(data.purchaseDate);
  const eDate = new Date(data.expiryDate);
  return eDate > pDate;
}, {
  message: 'Expiry date must be later than purchase date',
  path: ['expiryDate'],
});

export const getProductBatches = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = req.user!.storeId;
    const { productId } = req.params;
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const pageSize = Math.max(1, parseInt(req.query.pageSize as string || '25', 10));
    const skip = (page - 1) * pageSize;

    // Verify product belongs to store
    const product = await prisma.product.findFirst({
      where: { id: productId, storeId },
    });

    if (!product) {
      res.status(404).json({ error: 'not_found', message: 'Product not found' });
      return;
    }

    const [total, items] = await Promise.all([
      prisma.batch.count({ where: { productId, storeId } }),
      prisma.batch.findMany({
        where: { productId, storeId },
        skip,
        take: pageSize,
        orderBy: { expiryDate: 'asc' },
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

export const receiveStock = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = req.user!.storeId;
    const { productId } = req.params;
    const data = receiveStockSchema.parse(req.body);

    const product = await prisma.product.findFirst({
      where: { id: productId, storeId },
    });

    if (!product) {
      res.status(404).json({ error: 'not_found', message: 'Product not found' });
      return;
    }

    const pDate = new Date(data.purchaseDate);
    const eDate = new Date(data.expiryDate);

    const batch = await prisma.batch.create({
      data: {
        storeId,
        productId,
        quantityReceived: data.quantityReceived,
        quantityRemaining: data.quantityReceived,
        purchaseDate: pDate,
        expiryDate: eDate,
        purchaseCostPerUnit: data.purchaseCostPerUnit,
        status: 'ACTIVE',
      },
    });

    res.status(201).json(batch);
  } catch (error) {
    next(error);
  }
};

export const getExpiringBatches = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = req.user!.storeId;
    const withinDays = Math.max(1, parseInt(req.query.withinDays as string || '5', 10));

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const targetDate = new Date(today);
    targetDate.setUTCDate(targetDate.getUTCDate() + withinDays);
    targetDate.setUTCHours(23, 59, 59, 999);

    // Active batches with quantityRemaining > 0 and expiryDate >= today and <= targetDate
    const items = await prisma.batch.findMany({
      where: {
        storeId,
        status: 'ACTIVE',
        quantityRemaining: { gt: 0 },
        expiryDate: {
          gte: today,
          lte: targetDate,
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            category: true,
            unit: true,
          },
        },
      },
      orderBy: { expiryDate: 'asc' },
    });

    res.status(200).json({ items });
  } catch (error) {
    next(error);
  }
};
