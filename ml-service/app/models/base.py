from abc import ABC, abstractmethod
from typing import List, Tuple, Dict, Any, Optional
import numpy as np
from ..schemas import SaleHistoryItem, ProductEvaluationResult

class DemandModel(ABC):
  @property
  @abstractmethod
  def version(self) -> str:
    """Returns the model version string (e.g. random_forest_v1)."""
    pass

  @abstractmethod
  def predict(self, sales_history: List[SaleHistoryItem]) -> Tuple[float, bool, Optional[str]]:
    """
    Predict next-day demand.
    Returns: (predicted_quantity, is_fallback, fallback_reason)
    """
    pass

  @abstractmethod
  def evaluate_product(self, product_id: str, sales_history: List[SaleHistoryItem]) -> ProductEvaluationResult:
    """
    Evaluate model on 80/20 train/test holdout for a product.
    """
    pass
