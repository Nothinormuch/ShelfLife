# ShelfLife — Grocery Inventory Intelligence Platform

ShelfLife is a multi-tenant SaaS platform engineered for small and mid-sized grocery stores to eliminate perishable stock write-offs and avoid stockouts. It provides batch-level inventory tracking down to individual expiry dates paired with machine learning decision support for demand forecasting, expiry risk quantification, and hybrid restock/markdown recommendations.

---

## Architecture Overview

ShelfLife is built across four distinct decoupled services:
1. **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS (SPA).
2. **Backend**: Node.js + Express + TypeScript with Prisma ORM connecting to PostgreSQL.
3. **ML Microservice**: Python 3.11 + FastAPI + scikit-learn.
4. **Database**: PostgreSQL 16.

```
   [Browser Client]
          │
          ▼
   [Frontend (Vercel)] ───HTTP───▶ [Backend API (Render)] ───SQL───▶ [PostgreSQL]
                                          │
                                        HTTP
                                          ▼
                               [ML Microservice (Render)]
```

---

## Local Development & Docker Compose

Run the entire four-service stack locally with Docker Compose:

```bash
# Start all 4 services (Postgres, ML Microservice, Backend API, Frontend)
docker compose up --build
```

- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:5000](http://localhost:5000)
  - Health check: `GET http://localhost:5000/health`
- **ML Microservice**: [http://localhost:8000](http://localhost:8000)
  - Health check: `GET http://localhost:8000/health`
- **PostgreSQL**: `localhost:5432` (db: `shelflife_db`, user: `shelflife`, pass: `shelflife_password`)

---

## CLI Seeding Command

To populate a store with realistic Indian grocery products (Amul Taaza Milk, Fresh Paneer, Atta, Basmati Rice, Toor Dal, Tomatoes, Onions, Spices) and 180 days of daily sales:

```bash
# From backend directory
npm run seed:store -- --days 180

# Or targeting a specific store by owner email:
npm run seed:store -- --email storeowner@example.com --days 180

# Or via Docker Compose:
docker compose exec backend npm run seed:store -- --days 180
```

---

## Environment Variables Documentation

### 1. Frontend (Vercel)

| Variable | Required | Description | Example / Default |
| :--- | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Yes | Absolute URL to the backend API v1 root | `https://shelflife-backend.onrender.com/api/v1` |

### 2. Backend Web Service (Render)

| Variable | Required | Description | Example / Default |
| :--- | :--- | :--- | :--- |
| `PORT` | Yes | HTTP listening port | `5000` |
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://user:pass@host:5432/shelflife_db` |
| `ML_SERVICE_URL` | Yes | Internal/External URL to the Python ML microservice | `https://shelflife-ml-service.onrender.com` or `http://ml-service:8000` |
| `CORS_ORIGIN` | Yes | Comma-separated list of allowed frontend domains | `https://shelflife.vercel.app,http://localhost:3000` |
| `JWT_SECRET` | Yes | Secret key used to sign JWT access tokens | Long random string |
| `JWT_REFRESH_SECRET`| Yes | Secret key used to sign JWT refresh tokens | Long random string |

### 3. ML Microservice Web Service (Render)

| Variable | Required | Description | Example / Default |
| :--- | :--- | :--- | :--- |
| `PORT` | Yes | HTTP listening port | `8000` |

---

## Deployment Configuration (Render & Vercel)

The repository is pre-configured for deployment:

- **Render Blueprint (`render.yaml`)**:
  - Automatically provisions `shelflife-backend` and `shelflife-ml-service` as Docker Web Services.
  - Provisions a managed PostgreSQL instance `shelflife-postgres`.
  - Configures `/health` health-check endpoints on both web services.
- **Vercel Configuration (`frontend/vercel.json`)**:
  - Contains SPA route rewrites mapping all paths `/(.*)` to `/index.html` to prevent 404s on browser reloads.

---

## Machine Learning & Evaluation Layer

1. **Demand Forecasting (`random_forest_v1`)**:
   - Trains a `RandomForestRegressor` per product using time-series features (day of week, weekend indicator, 1-day lag, 7-day lag, rolling 7-day mean, rolling 7-day standard deviation).
   - If a product has `< 30` days of sales history, it falls back to a rolling moving average statistical estimate and explicitly flags `isFallback: true` with `fallbackReason: "insufficient_history"`.
2. **Expiry Risk Quantification**:
   - Derives unsold quantity at batch expiry date from projected demand over remaining shelf life:
     $$\text{unsold} = \max(0, \text{quantityRemaining} - (\text{demandPrediction} \times \text{daysToExpiry}))$$
     $$\text{riskScore} = \min(1.0, \frac{\text{unsold}}{\text{quantityRemaining}})$$
3. **Out-of-Sample Holdout Model Evaluation**:
   - For every qualifying product (≥30 days sales history, ≥6 holdout points), splits chronological sales 80% train / 20% test holdout without lookahead data leakage.
   - Computes **MAE** (Mean Absolute Error) and **RMSE** (Root Mean Squared Error) per product and aggregate.
