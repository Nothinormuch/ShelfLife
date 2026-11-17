#!/usr/bin/env node
import { prisma } from '../db/prisma.js';
import { generateSyntheticDataForStore } from '../modules/sales/syntheticGenerator.js';
import { triggerModelEvaluationForStore } from '../modules/evaluation/evaluationService.js';

async function main() {
  const args = process.argv.slice(2);
  let email: string | undefined;
  let days: number = 180;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email' && args[i + 1]) {
      email = args[i + 1];
      i++;
    } else if (args[i] === '--days' && args[i + 1]) {
      days = parseInt(args[i + 1], 10);
      i++;
    }
  }

  let store;
  if (email) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { store: true },
    });
    if (!user) {
      console.error(`User with email "${email}" not found.`);
      process.exit(1);
    }
    store = user.store;
  } else {
    // Pick the most recent store
    store = await prisma.store.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    if (!store) {
      console.error('No stores found in database. Please register a store first.');
      process.exit(1);
    }
  }

  console.log(`\n🌱 Seeding ${days} days of Indian grocery sales and batches for Store: "${store.name}" (${store.id})...`);

  // Clear previous data for clean seed
  await prisma.$transaction([
    prisma.recommendation.deleteMany({ where: { storeId: store.id } }),
    prisma.expiryRisk.deleteMany({ where: { storeId: store.id } }),
    prisma.demandPrediction.deleteMany({ where: { storeId: store.id } }),
    prisma.modelEvaluation.deleteMany({ where: { storeId: store.id } }),
    prisma.saleRecord.deleteMany({ where: { storeId: store.id } }),
    prisma.batch.deleteMany({ where: { storeId: store.id } }),
    prisma.product.deleteMany({ where: { storeId: store.id } }),
  ]);

  const result = await generateSyntheticDataForStore(store.id, days);
  console.log(`✅ Catalog created: ${result.productsCreated} Indian grocery products`);
  console.log(`✅ Batches created: ${result.batchesCreated} purchase batches`);
  console.log(`✅ Sales created: ${result.salesRecordsCreated} daily transaction records`);

  console.log('🤖 Triggering holdout model evaluation...');
  try {
    const evalResult = await triggerModelEvaluationForStore(store.id);
    console.log(`✅ Model evaluation complete: MAE = ₹${evalResult.aggregate.mae}, RMSE = ₹${evalResult.aggregate.rmse}`);
  } catch (err: any) {
    console.warn('⚠️ Warning evaluating models:', err.message);
  }

  console.log('\n🎉 Store seeding successfully finished!\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seeding error:', err);
  process.exit(1);
});
