from typing import List
import numpy as np
from fastapi import APIRouter
from ..schemas import (
  EvaluationRequest,
  EvaluationResponse,
  AggregateEvaluation,
  ProductEvaluationResult
)
from ..models.random_forest import RandomForestDemandModel

router = APIRouter()
default_model = RandomForestDemandModel()

@router.post("/evaluate", response_model=EvaluationResponse)
def evaluate_models(req: EvaluationRequest):
  by_product: List[ProductEvaluationResult] = []
  total_test_points = 0
  sum_mae_weighted = 0.0
  sum_squared_errors = 0.0

  for p in req.products:
    res = default_model.evaluate_product(p.productId, p.salesHistory)
    by_product.append(res)
    if not res.skipped and res.testSetSize > 0:
      total_test_points += res.testSetSize
      sum_mae_weighted += res.mae * res.testSetSize
      # res.rmse is sqrt(mean_squared_error), so squared error sum = rmse^2 * testSetSize
      sum_squared_errors += (res.rmse ** 2) * res.testSetSize

  if total_test_points > 0:
    agg_mae = round(sum_mae_weighted / total_test_points, 4)
    agg_rmse = round(float(np.sqrt(sum_squared_errors / total_test_points)), 4)
  else:
    agg_mae = 0.0
    agg_rmse = 0.0

  return EvaluationResponse(
    modelVersion=default_model.version,
    aggregate=AggregateEvaluation(
      mae=agg_mae,
      rmse=agg_rmse,
      testSetSize=total_test_points
    ),
    byProduct=by_product
  )
