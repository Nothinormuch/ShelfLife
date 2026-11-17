from fastapi import APIRouter
from ..schemas import DemandPredictionRequest, DemandPredictionResponse
from ..models.random_forest import RandomForestDemandModel

router = APIRouter()
default_model = RandomForestDemandModel()

@router.post("/demand", response_model=DemandPredictionResponse)
def predict_demand(req: DemandPredictionRequest):
  predicted, is_fallback, fallback_reason = default_model.predict(req.salesHistory)
  return DemandPredictionResponse(
    predictedQuantity=predicted,
    isFallback=is_fallback,
    fallbackReason=fallback_reason,
    modelVersion=default_model.version
  )
