from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import demand, expiry_risk, evaluation

app = FastAPI(
  title="ShelfLife ML Microservice",
  version="1.0.0",
  description="Demand prediction, expiry risk calculation, and model evaluation service"
)

app.add_middleware(
  CORSMiddleware,
  allow_origins=["*"],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

@app.get("/health")
def health_check():
  return {"status": "ok"}

app.include_router(demand.router, prefix="/predict", tags=["Demand Prediction"])
app.include_router(expiry_risk.router, prefix="/predict", tags=["Expiry Risk"])
app.include_router(evaluation.router, tags=["Evaluation"])
