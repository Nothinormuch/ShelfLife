import { prisma } from '../../db/prisma.js';
import { mlClient } from '../../clients/mlClient.js';

export async function generateFreshRecommendations(storeId: string, typeFilter?: 'RESTOCK' | 'DISCOUNT') {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const products = await prisma.product.findMany({
    where: { storeId, isActive: true },
    include: {
      batches: {
        where: {
          status: 'ACTIVE',
          quantityRemaining: { gt: 0 },
          expiryDate: { gt: today },
        },
      },
      saleRecords: {
        orderBy: { date: 'asc' },
        select: { date: true, quantitySold: true },
      },
    },
  });

  const now = new Date();
  const createdRecommendations = [];

  for (const product of products) {
    const totalRemaining = product.batches.reduce(
      (sum, b) => sum + Number(b.quantityRemaining),
      0
    );

    const salesHistory = product.saleRecords.map((s) => ({
      date: s.date.toISOString().split('T')[0],
      quantitySold: Number(s.quantitySold),
    }));

    // Demand prediction
    const demandRes = await mlClient.predictDemand({
      storeId,
      productId: product.id,
      salesHistory,
    });
    const predictedDemand = demandRes.predictedQuantity;

    // 1. RESTOCK RECOMMENDATION
    if (!typeFilter || typeFilter === 'RESTOCK') {
      if (predictedDemand > totalRemaining) {
        // Suggested restock quantity to cover 3 days of demand minus remaining stock
        const suggestedReorder = Math.max(
          1,
          Math.ceil(predictedDemand * 2.5 - totalRemaining)
        );

        const rec = await prisma.recommendation.create({
          data: {
            storeId,
            type: 'RESTOCK',
            productId: product.id,
            batchId: null,
            suggestedValue: suggestedReorder,
            rationale: {
              predictedDemand,
              quantityAtRisk: 0,
              daysToExpiry: null,
              basis: 'demand_exceeds_stock',
            },
            generatedAt: now,
          },
        });
        createdRecommendations.push(rec);
      }
    }

    // 2. DISCOUNT RECOMMENDATION for at-risk batches
    if (!typeFilter || typeFilter === 'DISCOUNT') {
      for (const batch of product.batches) {
        const expDate = new Date(batch.expiryDate);
        expDate.setUTCHours(0, 0, 0, 0);
        const diffDays = Math.max(1, Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

        const riskRes = await mlClient.predictExpiryRisk({
          storeId,
          batchId: batch.id,
          productId: product.id,
          quantityRemaining: Number(batch.quantityRemaining),
          daysToExpiry: diffDays,
          demandPrediction: predictedDemand,
        });

        // AC-6: If predicted unsold quantity at expiry > 0, generate DISCOUNT recommendation
        if (riskRes.predictedUnsoldQuantity > 0) {
          // Markdown % based on risk score and days remaining
          let discountPct = 10;
          if (riskRes.riskScore >= 0.75) {
            discountPct = diffDays <= 3 ? 35 : 25;
          } else if (riskRes.riskScore >= 0.4) {
            discountPct = diffDays <= 4 ? 20 : 15;
          } else {
            discountPct = 10;
          }

          const rec = await prisma.recommendation.create({
            data: {
              storeId,
              type: 'DISCOUNT',
              productId: product.id,
              batchId: batch.id,
              suggestedValue: discountPct,
              rationale: {
                predictedDemand,
                quantityAtRisk: riskRes.predictedUnsoldQuantity,
                daysToExpiry: diffDays,
                basis: 'expiry_risk_gt_demand',
              },
              generatedAt: now,
            },
          });
          createdRecommendations.push(rec);
        }
      }
    }
  }

  return createdRecommendations;
}
