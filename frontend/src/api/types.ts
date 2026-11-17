export interface Store {
  id: string;
  name: string;
  createdAt: string;
}

export interface User {
  id: string;
  storeId: string;
  email: string;
  createdAt: string;
}

export interface Product {
  id: string;
  storeId: string;
  name: string;
  category: string;
  unit: string;
  shelfLifeDays: number;
  defaultPurchaseCost: number | string;
  defaultSellingPrice: number | string;
  isActive: boolean;
  createdAt: string;
}

export interface Batch {
  id: string;
  storeId: string;
  productId: string;
  quantityReceived: number | string;
  quantityRemaining: number | string;
  purchaseDate: string;
  expiryDate: string;
  purchaseCostPerUnit: number | string;
  status: 'ACTIVE' | 'DEPLETED' | 'EXPIRED';
  createdAt: string;
  product?: {
    id: string;
    name: string;
    category: string;
    unit: string;
  };
}

export interface SaleRecord {
  id: string;
  storeId: string;
  productId: string;
  date: string;
  quantitySold: number | string;
  revenue: number | string;
  source: 'SYNTHETIC' | 'MANUAL';
}

export interface DemandPrediction {
  id: string;
  storeId: string;
  productId: string;
  horizon: 'NEXT_DAY';
  predictedQuantity: number | string;
  isFallback: boolean;
  fallbackReason: string | null;
  modelVersion: string;
  generatedAt: string;
}

export interface ExpiryRisk {
  id: string;
  storeId: string;
  batchId: string;
  predictedUnsoldQuantity: number | string;
  riskScore: number | string;
  generatedAt: string;
}

export interface Recommendation {
  id: string;
  storeId: string;
  type: 'RESTOCK' | 'DISCOUNT';
  productId: string;
  batchId: string | null;
  suggestedValue: number | string;
  rationale: {
    predictedDemand: number;
    quantityAtRisk: number;
    daysToExpiry: number | null;
    basis: string;
  };
  generatedAt: string;
  product?: {
    id: string;
    name: string;
    category: string;
    unit: string;
    defaultSellingPrice: number | string;
  };
  batch?: {
    id: string;
    quantityRemaining: number | string;
    expiryDate: string;
  };
}

export interface ModelEvaluation {
  id: string;
  storeId: string;
  productId: string | null;
  modelVersion: string;
  mae: number | string;
  rmse: number | string;
  testSetSize: number;
  evaluatedAt: string;
  product?: {
    id: string;
    name: string;
    category: string;
  };
}
