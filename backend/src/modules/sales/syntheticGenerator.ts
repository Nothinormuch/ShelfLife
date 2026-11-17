import { prisma } from '../../db/prisma.js';

interface SeedProductDef {
  name: string;
  category: string;
  unit: string;
  shelfLifeDays: number;
  purchaseCost: number; // in INR (₹)
  sellingPrice: number; // in INR (₹)
  baseDemand: number;   // average daily units
}

const INDIAN_GROCERY_CATALOG: SeedProductDef[] = [
  { name: 'Amul Taaza Milk 1L', category: 'Dairy', unit: 'packet', shelfLifeDays: 3, purchaseCost: 48, sellingPrice: 56, baseDemand: 45 },
  { name: 'Fresh Malai Paneer 200g', category: 'Dairy', unit: 'packet', shelfLifeDays: 5, purchaseCost: 75, sellingPrice: 90, baseDemand: 28 },
  { name: 'Amul Butter 100g', category: 'Dairy', unit: 'pack', shelfLifeDays: 60, purchaseCost: 50, sellingPrice: 60, baseDemand: 22 },
  { name: 'Pav Bread 6pcs', category: 'Bakery', unit: 'pack', shelfLifeDays: 4, purchaseCost: 22, sellingPrice: 30, baseDemand: 35 },
  { name: 'Aashirvaad Shudh Chakki Atta 5kg', category: 'Staples', unit: 'bag', shelfLifeDays: 90, purchaseCost: 220, sellingPrice: 265, baseDemand: 16 },
  { name: 'India Gate Basmati Rice 1kg', category: 'Staples', unit: 'kg', shelfLifeDays: 180, purchaseCost: 110, sellingPrice: 145, baseDemand: 18 },
  { name: 'Tata Sampann Toor Dal 1kg', category: 'Staples', unit: 'kg', shelfLifeDays: 120, purchaseCost: 140, sellingPrice: 175, baseDemand: 20 },
  { name: 'Nasik Red Onions 1kg', category: 'Vegetables', unit: 'kg', shelfLifeDays: 10, purchaseCost: 28, sellingPrice: 38, baseDemand: 50 },
  { name: 'Farm Fresh Tomatoes 1kg', category: 'Vegetables', unit: 'kg', shelfLifeDays: 6, purchaseCost: 25, sellingPrice: 35, baseDemand: 40 },
  { name: 'Fresh Coriander (Dhaniya) Bunch', category: 'Vegetables', unit: 'bunch', shelfLifeDays: 3, purchaseCost: 8, sellingPrice: 15, baseDemand: 35 },
  { name: 'Fortune Kachi Ghani Mustard Oil 1L', category: 'Oils & Ghee', unit: 'bottle', shelfLifeDays: 180, purchaseCost: 135, sellingPrice: 165, baseDemand: 12 },
  { name: 'Everest Garam Masala 100g', category: 'Spices', unit: 'box', shelfLifeDays: 180, purchaseCost: 65, sellingPrice: 82, baseDemand: 10 },
];

export async function generateSyntheticDataForStore(
  storeId: string,
  days: number = 180,
  productCount?: number
): Promise<{ productsCreated: number; batchesCreated: number; salesRecordsCreated: number }> {
  let existingProducts = await prisma.product.findMany({
    where: { storeId, isActive: true },
  });

  let productsCreated = 0;
  if (existingProducts.length === 0) {
    const catalogToSeed = productCount ? INDIAN_GROCERY_CATALOG.slice(0, Math.max(1, productCount)) : INDIAN_GROCERY_CATALOG;
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

  const startDate = new Date(today);
  startDate.setUTCDate(today.getUTCDate() - days);

  let batchesCreated = 0;
  let salesRecordsCreated = 0;

  for (const product of existingProducts) {
    const catalogItem = INDIAN_GROCERY_CATALOG.find(c => c.name === product.name) || {
      baseDemand: 15,
      shelfLifeDays: product.shelfLifeDays,
      purchaseCost: Number(product.defaultPurchaseCost),
      sellingPrice: Number(product.defaultSellingPrice),
    };

    const baseDemand = catalogItem.baseDemand;
    const shelfLife = product.shelfLifeDays;
    const purchaseCost = Number(product.defaultPurchaseCost);
    const sellingPrice = Number(product.defaultSellingPrice);

    interface SimBatch {
      purchaseDate: Date;
      expiryDate: Date;
      quantityReceived: number;
      quantityRemaining: number;
      purchaseCostPerUnit: number;
      status: 'ACTIVE' | 'DEPLETED' | 'EXPIRED';
    }
    const simulatedBatches: SimBatch[] = [];

    const reorderInterval = Math.max(2, Math.floor(shelfLife * 0.6));
    const batchSize = Math.round(baseDemand * reorderInterval * 1.15);

    // Stagger restocking so some products are low on stock around today to trigger restock decisions
    const stopRestockDaysBeforeEnd = (existingProducts.indexOf(product) % 2 === 0) ? Math.max(2, Math.floor(shelfLife * 0.5)) : 0;
    const restockCutoff = new Date(today);
    restockCutoff.setUTCDate(restockCutoff.getUTCDate() - stopRestockDaysBeforeEnd);

    const currentDate = new Date(startDate);
    let daysSinceLastRestock = reorderInterval;

    while (currentDate < today) {
      const dayOfWeek = currentDate.getUTCDay();

      // Check batch expiry
      for (const b of simulatedBatches) {
        if (b.status === 'ACTIVE' && b.expiryDate <= currentDate) {
          b.status = b.quantityRemaining > 0 ? 'EXPIRED' : 'DEPLETED';
        }
      }

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

      // Weekend & day-of-week multiplier
      let dowMultiplier = 1.0;
      if (dayOfWeek === 6) dowMultiplier = 1.35; // Saturday
      else if (dayOfWeek === 0) dowMultiplier = 1.30; // Sunday
      else if (dayOfWeek === 5) dowMultiplier = 1.15; // Friday
      else if (dayOfWeek === 1) dowMultiplier = 0.88; // Monday
      else dowMultiplier = 0.95;

      const randomNoise = 0.85 + Math.random() * 0.3;
      const spike = Math.random() < 0.05 ? 1.5 : 1.0;
      let expectedSold = Math.max(1, Math.round(baseDemand * dowMultiplier * randomNoise * spike));

      // Deplete from active batches using FIFO-by-expiry
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

      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    for (const b of simulatedBatches) {
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
