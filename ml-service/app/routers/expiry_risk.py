from fastapi import APIRouter
from ..schemas import ExpiryRiskRequest, ExpiryRiskResponse

router = APIRouter()

@router.post("/expiry-risk", response_model=ExpiryRiskResponse)
def predict_expiry_risk(req: ExpiryRiskRequest):
  if req.daysToExpiry <= 0:
    unsold = max(0.0, req.quantityRemaining)
    risk_score = 1.0 if req.quantityRemaining > 0 else 0.0
    return ExpiryRiskResponse(
      predictedUnsoldQuantity=round(unsold, 2),
      riskScore=round(risk_score, 4)
    )

  projected_demand = max(0.0, req.demandPrediction * req.daysToExpiry)
  unsold = max(0.0, req.quantityRemaining - projected_demand)
  
  if req.quantityRemaining <= 0:
    risk_score = 0.0
  else:
    risk_score = min(1.0, max(0.0, unsold / req.quantityRemaining))

  return ExpiryRiskResponse(
    predictedUnsoldQuantity=round(unsold, 2),
    riskScore=round(risk_score, 4)
  )
