import { prisma } from '../../db/prisma.js';
import { mlClient } from '../../clients/mlClient.js';

export async function triggerModelEvaluationForStore(storeId: string) {
  const products = await prisma.product.findMany({
    where: { storeId, isActive: true },
    include: {
      saleRecords: {
        orderBy: { date: 'asc' },
        select: {
          date: true,
          quantitySold: true,
        },
      },
    },
  });

  const formattedProducts = products.map((p) => ({
    productId: p.id,
    salesHistory: p.saleRecords.map((s) => ({
      date: s.date.toISOString().split('T')[0],
      quantitySold: Number(s.quantitySold),
    })),
  }));

  // Call ML service
  const evalResponse = await mlClient.evaluate({
    storeId,
    products: formattedProducts,
  });

  const now = new Date();

  // Persist aggregate evaluation (with productId = null)
  const aggregateRecord = await prisma.modelEvaluation.create({
    data: {
      storeId,
      productId: null,
      modelVersion: evalResponse.modelVersion,
      mae: evalResponse.aggregate.mae,
      rmse: evalResponse.aggregate.rmse,
      testSetSize: evalResponse.aggregate.testSetSize,
      evaluatedAt: now,
    },
  });

  // Persist per-product evaluations (for non-skipped products)
  const productRecords = [];
  for (const item of evalResponse.byProduct) {
    if (!item.skipped && item.testSetSize > 0) {
      const rec = await prisma.modelEvaluation.create({
        data: {
          storeId,
          productId: item.productId,
          modelVersion: evalResponse.modelVersion,
          mae: item.mae,
          rmse: item.rmse,
          testSetSize: item.testSetSize,
          evaluatedAt: now,
        },
      });
      productRecords.push(rec);
    }
  }

  return {
    aggregate: aggregateRecord,
    byProduct: productRecords,
  };
}
