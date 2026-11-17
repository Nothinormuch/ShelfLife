import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';

const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  category: z.string().min(1, 'Category is required'),
  unit: z.string().min(1, 'Unit is required'),
  shelfLifeDays: z.number().int().positive('Shelf life days must be a positive integer'),
  defaultPurchaseCost: z.number().positive('Default purchase cost must be positive'),
  defaultSellingPrice: z.number().positive('Default selling price must be positive'),
});

const patchProductSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  unit: z.string().min(1).optional(),
  shelfLifeDays: z.number().int().positive().optional(),
  defaultPurchaseCost: z.number().positive().optional(),
  defaultSellingPrice: z.number().positive().optional(),
  isActive: z.boolean().optional(),
});

export const getProducts = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = req.user!.storeId;
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const pageSize = Math.max(1, parseInt(req.query.pageSize as string || '25', 10));
    const skip = (page - 1) * pageSize;

    const [total, items] = await Promise.all([
      prisma.product.count({ where: { storeId } }),
      prisma.product.findMany({
        where: { storeId },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
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

export const createProduct = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = req.user!.storeId;
    const data = createProductSchema.parse(req.body);

    const product = await prisma.product.create({
      data: {
        storeId,
        name: data.name,
        category: data.category,
        unit: data.unit,
        shelfLifeDays: data.shelfLifeDays,
        defaultPurchaseCost: data.defaultPurchaseCost,
        defaultSellingPrice: data.defaultSellingPrice,
      },
    });

    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
};

export const patchProduct = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = req.user!.storeId;
    const { id } = req.params;
    const data = patchProductSchema.parse(req.body);

    const existing = await prisma.product.findFirst({
      where: { id, storeId },
    });

    if (!existing) {
      res.status(404).json({ error: 'not_found', message: 'Product not found' });
      return;
    }

    const updated = await prisma.product.update({
      where: { id },
      data,
    });

    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = req.user!.storeId;
    const { id } = req.params;

    const existing = await prisma.product.findFirst({
      where: { id, storeId },
    });

    if (!existing) {
      res.status(404).json({ error: 'not_found', message: 'Product not found' });
      return;
    }

    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
