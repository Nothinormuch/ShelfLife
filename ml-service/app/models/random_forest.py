import math
from datetime import datetime, timedelta
from typing import List, Tuple, Optional
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor

from .base import DemandModel
from ..schemas import SaleHistoryItem, ProductEvaluationResult
from ..config import MIN_HISTORY_DAYS, MIN_TEST_SET_SIZE, CURRENT_MODEL_VERSION

class RandomForestDemandModel(DemandModel):
  def __init__(self, version: str = CURRENT_MODEL_VERSION):
    self._version = version

  @property
  def version(self) -> str:
    return self._version

  def _build_dataframe(self, sales_history: List[SaleHistoryItem]) -> pd.DataFrame:
    records = [{"date": pd.to_datetime(item.date), "quantity": float(item.quantitySold)} for item in sales_history]
    df = pd.DataFrame(records)
    if df.empty:
      return df
    df = df.sort_values("date").reset_index(drop=True)
    return df

  def _extract_features_and_targets(self, df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
    """
    Construct lag & calendar features:
    Lag 1, Lag 7, Rolling 7-day mean, Rolling 7-day std, Day of week, Is weekend.
    """
    df = df.copy()
    df["dow"] = df["date"].dt.dayofweek
    df["is_weekend"] = df["dow"].isin([5, 6]).astype(int)
    df["lag_1"] = df["quantity"].shift(1)
    df["lag_7"] = df["quantity"].shift(7)
    df["rolling_mean_7"] = df["quantity"].shift(1).rolling(window=7, min_periods=1).mean()
    df["rolling_std_7"] = df["quantity"].shift(1).rolling(window=7, min_periods=1).std().fillna(0)

    # Drop rows where lag_7 is NaN (first 7 rows)
    clean_df = df.dropna().reset_index(drop=True)
    if clean_df.empty:
      return np.empty((0, 6)), np.empty((0,))

    feature_cols = ["dow", "is_weekend", "lag_1", "lag_7", "rolling_mean_7", "rolling_std_7"]
    X = clean_df[feature_cols].values
    y = clean_df["quantity"].values
    return X, y

  def predict(self, sales_history: List[SaleHistoryItem]) -> Tuple[float, bool, Optional[str]]:
    n = len(sales_history)
    if n == 0:
      return 0.0, True, "no_history"

    df = self._build_dataframe(sales_history)
    if n < MIN_HISTORY_DAYS:
      # Statistical fallback: moving average of available days
      avg = float(df["quantity"].tail(7).mean())
      return round(max(0.0, avg), 2), True, "insufficient_history"

    X, y = self._extract_features_and_targets(df)
    if len(X) < 10:
      avg = float(df["quantity"].tail(7).mean())
      return round(max(0.0, avg), 2), True, "insufficient_history"

    model = RandomForestRegressor(n_estimators=40, max_depth=6, random_state=42)
    model.fit(X, y)

    # Features for the next day
    last_date = df["date"].iloc[-1]
    next_date = last_date + timedelta(days=1)
    next_dow = next_date.dayofweek
    next_is_weekend = 1 if next_dow in [5, 6] else 0
    lag_1 = float(df["quantity"].iloc[-1])
    lag_7 = float(df["quantity"].iloc[-7]) if len(df) >= 7 else lag_1
    rolling_mean_7 = float(df["quantity"].tail(7).mean())
    rolling_std_7 = float(df["quantity"].tail(7).std()) if len(df) >= 2 else 0.0
    if math.isnan(rolling_std_7):
      rolling_std_7 = 0.0

    next_features = np.array([[next_dow, next_is_weekend, lag_1, lag_7, rolling_mean_7, rolling_std_7]])
    predicted = float(model.predict(next_features)[0])
    return round(max(0.0, predicted), 2), False, None

  def evaluate_product(self, product_id: str, sales_history: List[SaleHistoryItem]) -> ProductEvaluationResult:
    n = len(sales_history)
    if n < MIN_HISTORY_DAYS:
      return ProductEvaluationResult(
        productId=product_id,
        mae=0.0,
        rmse=0.0,
        testSetSize=0,
        skipped=True,
        skipReason="insufficient_history"
      )

    df = self._build_dataframe(sales_history)
    split_idx = int(n * 0.8)
    train_df = df.iloc[:split_idx].copy()
    test_df = df.iloc[split_idx:].copy()

    test_size = len(test_df)
    if test_size < MIN_TEST_SET_SIZE:
      return ProductEvaluationResult(
        productId=product_id,
        mae=0.0,
        rmse=0.0,
        testSetSize=test_size,
        skipped=True,
        skipReason="test_set_too_small"
      )

    X_train, y_train = self._extract_features_and_targets(train_df)
    if len(X_train) < 10:
      return ProductEvaluationResult(
        productId=product_id,
        mae=0.0,
        rmse=0.0,
        testSetSize=test_size,
        skipped=True,
        skipReason="insufficient_training_samples"
      )

    model = RandomForestRegressor(n_estimators=40, max_depth=6, random_state=42)
    model.fit(X_train, y_train)

    # Walk through test set and predict using known history up to that point
    # Test set evaluation: predict each point in test_df
    # For robust evaluation without data leakage, use features computed from preceding points
    full_df = df.copy()
    full_df["dow"] = full_df["date"].dt.dayofweek
    full_df["is_weekend"] = full_df["dow"].isin([5, 6]).astype(int)
    full_df["lag_1"] = full_df["quantity"].shift(1)
    full_df["lag_7"] = full_df["quantity"].shift(7)
    full_df["rolling_mean_7"] = full_df["quantity"].shift(1).rolling(window=7, min_periods=1).mean()
    full_df["rolling_std_7"] = full_df["quantity"].shift(1).rolling(window=7, min_periods=1).std().fillna(0)

    test_slice = full_df.iloc[split_idx:].copy()
    feature_cols = ["dow", "is_weekend", "lag_1", "lag_7", "rolling_mean_7", "rolling_std_7"]
    X_test = test_slice[feature_cols].values
    y_test = test_slice["quantity"].values

    preds = model.predict(X_test)
    preds = np.maximum(0.0, preds)

    errors = np.abs(y_test - preds)
    mae = float(np.mean(errors))
    rmse = float(np.sqrt(np.mean((y_test - preds) ** 2)))

    return ProductEvaluationResult(
      productId=product_id,
      mae=round(mae, 4),
      rmse=round(rmse, 4),
      testSetSize=len(y_test),
      skipped=False,
      skipReason=None
    )
