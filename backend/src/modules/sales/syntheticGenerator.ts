import { prisma } from '../../db/prisma.js';

interface SeedProductDef {
  name: string;
  category: string;
  unit: string;
  shelfLifeDays: number;
  purchaseCost: number;
  sellingPrice: number;
  baseDemand: number; // average daily units
}

const DEFAULT_CATALOG: SeedProductDef[] = [
  { name: 'Whole Milk 1L', category: 'Dairy', unit: 'liter', shelfLifeDays: 7, purchaseCost: 1.20, sellingPrice: 1.89, baseDemand: 22 },
  { name: 'Greek Yogurt 500g', category: 'Dairy', unit: 'unit', shelfLifeDays: 14, purchaseCost: 1.80, sellingPrice: 2.99, baseDemand: 14 },
  { name: 'Farm Eggs 12pk', category: 'Dairy', unit: 'unit', shelfLifeDays: 21, purchaseCost: 2.10, sellingPrice: 3.49, baseDemand: 18 },
  { name: 'Sourdough Bread 500g', category: 'Bakery', unit: 'unit', shelfLifeDays: 4, purchaseCost: 1.50, sellingPrice: 2.80, baseDemand: 16 },
  { name: 'Butter Croissants 4pk', category: 'Bakery', unit: 'unit', shelfLifeDays: 5, purchaseCost: 2.00, sellingPrice: 3.50, baseDemand: 12 },
  { name: 'Bananas 1kg', category: 'Produce', unit: 'kg', shelfLifeDays: 5, purchaseCost: 0.90, sellingPrice: 1.69, baseDemand: 25 },
  { name: 'Gala Apples 1kg', category: 'Produce', unit: 'kg', shelfLifeDays: 14, purchaseCost: 1.40, sellingPrice: 2.49, baseDemand: 15 },
  { name: 'Fresh Chicken Breast 500g', category: 'Meat', unit: 'unit', shelfLifeDays: 6, purchaseCost: 3.50, sellingPrice: 5.99, baseDemand: 15 },
  { name: 'Ground Beef 500g', category: 'Meat', unit: 'unit', shelfLifeDays: 5, purchaseCost: 3.80, sellingPrice: 6.29, baseDemand: 13 },
  { name: 'Cheddar Cheese 250g', category: 'Dairy', unit: 'unit', shelfLifeDays: 30, purchaseCost: 2.20, sellingPrice: 3.99, baseDemand: 10 },
  { name: 'Extra Virgin Olive Oil 500ml', category: 'Pantry', unit: 'unit', shelfLifeDays: 120, purchaseCost: 4.50, sellingPrice: 7.99, baseDemand: 4 },
  { name: 'Organic Honey 250g', category: 'Pantry', unit: 'unit', shelfLifeDays: 180, purchaseCost: 3.20, sellingPrice: 5.49, baseDemand: 3 },
];

export async function generateSyntheticDataForStore(
  storeId: string,
  days: number = 180,
  productCount?: number
): Promise<{ productsCreated: number; batchesCreated: number; salesRecordsCreated: number }> {
  // Determine products to use
  let existingProducts = await prisma.product.findMany({
    where: { storeId, isActive: true },
  });

  let productsCreated = 0;
  if (existingProducts.length === 0) {
    const catalogToSeed = productCount ? DEFAULT_CATALOG.slice(0, Math.max(1, productCount)) : DEFAULT_CATALOG;
    for (const item of catalogToSeed) {
      const p = await prisma.product.create({
        data: {
          storeId,
          name: item.name,
          category: item.category,
          unit: item.unit,
          shelfLifeDays: item.shelfLifeDays,
          defaultPurchaseCost: item.purchaseCost,
          defaultSellingPrice: item.sellingPrice,
        },
      });
      existingProducts.push(p);
      productsCreated++;
    }
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // We will simulate from (today - days) up to (today - 1)
  const startDate = new Date(today);
  startDate.setUTCDate(today.getUTCDate() - days);

  let batchesCreated = 0;
  let salesRecordsCreated = 0;

  // For each product, simulate timeline
  for (const product of existingProducts) {
    const catalogItem = DEFAULT_CATALOG.find(c => c.name === product.name) || {
      baseDemand: 10,
      shelfLifeDays: product.shelfLifeDays,
      purchaseCost: Number(product.defaultPurchaseCost),
      sellingPrice: Number(product.defaultSellingPrice),
    };

    const baseDemand = catalogItem.baseDemand;
    const shelfLife = product.shelfLifeDays;
    const purchaseCost = Number(product.defaultPurchaseCost);
    const sellingPrice = Number(product.defaultSellingPrice);

    // Active batches in memory for FIFO simulation
    interface SimBatch {
      id?: string;
      purchaseDate: Date;
      expiryDate: Date;
      quantityReceived: number;
      quantityRemaining: number;
      purchaseCostPerUnit: number;
      status: 'ACTIVE' | 'DEPLETED' | 'EXPIRED';
    }
    const simulatedBatches: SimBatch[] = [];

    // Reorder interval approx shelfLife / 2, or minimum 3 days
    const reorderInterval = Math.max(2, Math.floor(shelfLife * 0.6));
    const batchSize = Math.round(baseDemand * reorderInterval * 1.15); // slight surplus for perishable expiry risk

    const currentDate = new Date(startDate);
    let daysSinceLastRestock = reorderInterval;

    // Stagger restocking so some products are low on stock at today's date (triggers restock)
    const stopRestockDaysBeforeEnd = (existingProducts.indexOf(product) % 2 === 0) ? Math.max(2, Math.floor(shelfLife * 0.5)) : 0;
    const restockCutoff = new Date(today);
    restockCutoff.setUTCDate(restockCutoff.getUTCDate() - stopRestockDaysBeforeEnd);

    // Simulation loop day by day
    while (currentDate < today) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayOfWeek = currentDate.getUTCDay(); // 0 = Sun, 6 = Sat

      // Check if any batches expired on this day
      for (const b of simulatedBatches) {
        if (b.status === 'ACTIVE' && b.expiryDate <= currentDate) {
          if (b.quantityRemaining > 0) {
            b.status = 'EXPIRED';
          } else {
            b.status = 'DEPLETED';
          }
        }
      }

      // Time to restock a new batch?
      daysSinceLastRestock++;
      if (daysSinceLastRestock >= reorderInterval && currentDate < restockCutoff) {
        const batchPurchaseDate = new Date(currentDate);
        const batchExpiryDate = new Date(currentDate);
        batchExpiryDate.setUTCDate(batchExpiryDate.getUTCDate() + shelfLife);

        simulatedBatches.push({
          purchaseDate: batchPurchaseDate,
          expiryDate: batchExpiryDate,
          quantityReceived: batchSize,
          quantityRemaining: batchSize,
          purchaseCostPerUnit: purchaseCost,
          status: 'ACTIVE',
        });
        daysSinceLastRestock = 0;
      }

      // Calculate daily sales demand
      // Day of week factor
      let dowMultiplier = 1.0;
      if (dayOfWeek === 6) dowMultiplier = 1.35; // Saturday
      else if (dayOfWeek === 0) dowMultiplier = 1.25; // Sunday
      else if (dayOfWeek === 5) dowMultiplier = 1.15; // Friday
      else if (dayOfWeek === 1) dowMultiplier = 0.88; // Monday
      else dowMultiplier = 0.95;

      // Random variation +/- 20%
      const randomNoise = 0.8 + Math.random() * 0.4;
      // Occasional spike (5% chance)
      const spike = Math.random() < 0.05 ? 1.6 : 1.0;

      let expectedSold = Math.max(1, Math.round(baseDemand * dowMultiplier * randomNoise * spike));

      // Deplete from active batches using FIFO-by-expiry
      // Sort active batches by expiry ascending
      const activeBatches = simulatedBatches
        .filter(b => b.status === 'ACTIVE' && b.quantityRemaining > 0 && b.expiryDate > currentDate)
        .sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime());

      let unitsSold = 0;
      for (const batch of activeBatches) {
        if (expectedSold <= 0) break;
        const take = Math.min(expectedSold, batch.quantityRemaining);
        batch.quantityRemaining -= take;
        expectedSold -= take;
        unitsSold += take;
        if (batch.quantityRemaining === 0) {
          batch.status = 'DEPLETED';
        }
      }

      // Record daily sale record if units were sold
      if (unitsSold > 0) {
        const rev = Number((unitsSold * sellingPrice).toFixed(2));
        await prisma.saleRecord.create({
          data: {
            storeId,
            productId: product.id,
            date: new Date(currentDate),
            quantitySold: unitsSold,
            revenue: rev,
            source: 'SYNTHETIC',
          },
        });
        salesRecordsCreated++;
      }

      // Advance one day
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    // Persist all batches for this product
    for (const b of simulatedBatches) {
      // Check final status relative to today
      let finalStatus: 'ACTIVE' | 'DEPLETED' | 'EXPIRED' = b.status;
      if (b.quantityRemaining <= 0) {
        finalStatus = 'DEPLETED';
      } else if (b.expiryDate <= today) {
        finalStatus = 'EXPIRED';
      } else {
        finalStatus = 'ACTIVE';
      }

      await prisma.batch.create({
        data: {
          storeId,
          productId: product.id,
          quantityReceived: b.quantityReceived,
          quantityRemaining: b.quantityRemaining,
          purchaseDate: b.purchaseDate,
          expiryDate: b.expiryDate,
          purchaseCostPerUnit: b.purchaseCostPerUnit,
          status: finalStatus,
        },
      });
      batchesCreated++;
    }
  }

  return { productsCreated, batchesCreated, salesRecordsCreated };
}
