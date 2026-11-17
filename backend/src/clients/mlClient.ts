import { config } from '../config/index.js';

export interface MLDemandRequest {
  storeId: string;
  productId: string;
  horizon?: string;
  salesHistory: Array<{ date: string; quantitySold: number }>;
}

export interface MLDemandResponse {
  predictedQuantity: number;
  isFallback: boolean;
  fallbackReason: string | null;
  modelVersion: string;
}

export interface MLExpiryRiskRequest {
  storeId: string;
  batchId: string;
  productId: string;
  quantityRemaining: number;
  daysToExpiry: number;
  demandPrediction: number;
}

export interface MLExpiryRiskResponse {
  predictedUnsoldQuantity: number;
  riskScore: number;
}

export interface MLEvaluationRequest {
  storeId: string;
  products: Array<{
    productId: string;
    salesHistory: Array<{ date: string; quantitySold: number }>;
  }>;
}

export interface MLEvaluationResponse {
  modelVersion: string;
  aggregate: {
    mae: number;
    rmse: number;
    testSetSize: number;
  };
  byProduct: Array<{
    productId: string;
    mae: number;
    rmse: number;
    testSetSize: number;
    skipped: boolean;
    skipReason: string | null;
  }>;
}

export class MLServiceError extends Error {
  statusCode: number;
  errorCode: string;

  constructor(message: string, statusCode: number, errorCode: string) {
    super(message);
    this.name = 'MLServiceError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

async function requestML<T>(path: string, body: any): Promise<T> {
  const url = `${config.mlServiceUrl}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout per EC-5

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new MLServiceError(
        `ML service responded with HTTP ${response.status}`,
        502,
        'invalid_ml_response'
      );
    }

    const data = await response.json();
    return data as T;
  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err instanceof MLServiceError) {
      throw err;
    }

    // EC-5: Timeout (>5s) or unreachable network connection
    if (err.name === 'AbortError' || err.code === 'ECONNREFUSED' || err.type === 'system') {
      throw new MLServiceError(
        'ML microservice is currently unreachable or timed out (>5s)',
        503,
        'ml_service_unavailable'
      );
    }

    throw new MLServiceError(
      'ML service error: ' + (err.message || 'unknown error'),
      503,
      'ml_service_unavailable'
    );
  }
}

export const mlClient = {
  async predictDemand(payload: MLDemandRequest): Promise<MLDemandResponse> {
    const res = await requestML<MLDemandResponse>('/predict/demand', payload);
    // EC-6: validate response shape
    if (
      typeof res.predictedQuantity !== 'number' ||
      isNaN(res.predictedQuantity) ||
      res.predictedQuantity < 0 ||
      typeof res.isFallback !== 'boolean' ||
      typeof res.modelVersion !== 'string'
    ) {
      throw new MLServiceError(
        'Malformed or out-of-range response from ML service',
        502,
        'invalid_ml_response'
      );
    }
    return res;
  },

  async predictExpiryRisk(payload: MLExpiryRiskRequest): Promise<MLExpiryRiskResponse> {
    const res = await requestML<MLExpiryRiskResponse>('/predict/expiry-risk', payload);
    if (
      typeof res.predictedUnsoldQuantity !== 'number' ||
      res.predictedUnsoldQuantity < 0 ||
      typeof res.riskScore !== 'number' ||
      res.riskScore < 0 ||
      res.riskScore > 1
    ) {
      throw new MLServiceError(
        'Malformed or out-of-range response from ML expiry-risk service',
        502,
        'invalid_ml_response'
      );
    }
    return res;
  },

  async evaluate(payload: MLEvaluationRequest): Promise<MLEvaluationResponse> {
    const res = await requestML<MLEvaluationResponse>('/evaluate', payload);
    if (!res || !res.aggregate || !Array.isArray(res.byProduct) || !res.modelVersion) {
      throw new MLServiceError(
        'Malformed response from ML evaluation service',
        502,
        'invalid_ml_response'
      );
    }
    return res;
  },
};
