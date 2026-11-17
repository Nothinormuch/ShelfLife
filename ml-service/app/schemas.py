from typing import List, Optional
from pydantic import BaseModel, Field

class SaleHistoryItem(BaseModel):
  date: str
  quantitySold: float

class DemandPredictionRequest(BaseModel):
  storeId: str
  productId: str
  horizon: str = "NEXT_DAY"
  salesHistory: List[SaleHistoryItem]

class DemandPredictionResponse(BaseModel):
  predictedQuantity: float
  isFallback: bool = Field(..., alias="isFallback")
  fallbackReason: Optional[str] = None
  modelVersion: str

  class Config:
    populate_by_name = True

class ExpiryRiskRequest(BaseModel):
  storeId: str
  batchId: str
  productId: str
  quantityRemaining: float
  daysToExpiry: int
  demandPrediction: float

class ExpiryRiskResponse(BaseModel):
  predictedUnsoldQuantity: float
  riskScore: float

class ProductEvaluationInput(BaseModel):
  productId: str
  salesHistory: List[SaleHistoryItem]

class EvaluationRequest(BaseModel):
  storeId: str
  products: List[ProductEvaluationInput]

class ProductEvaluationResult(BaseModel):
  productId: str
  mae: float
  rmse: float
  testSetSize: int
  skipped: bool = False
  skipReason: Optional[str] = None

class AggregateEvaluation(BaseModel):
  mae: float
  rmse: float
  testSetSize: int

class EvaluationResponse(BaseModel):
  modelVersion: str
  aggregate: AggregateEvaluation
  byProduct: List[ProductEvaluationResult]
