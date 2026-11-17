# SPEC.md — ShelfLife (Grocery Inventory Intelligence Platform)

Status: Locked specification for Antigravity planning. Antigravity must plan and build strictly against this document. Any ambiguity not resolved here should be flagged as a question, not silently decided.

---

## 1. Problem Statement

Small and mid-sized grocery stores routinely over-order or under-order perishable stock because they lack visibility into which products are likely to expire before they sell, and which products are likely to run out. This causes two correlated losses: wasted inventory (spoilage write-offs) and lost sales (stockouts on fast-moving items). Store owners currently make restocking and discounting decisions manually, based on intuition rather than data.

This project builds a multi-tenant SaaS platform that gives grocery stores (a) batch-level visibility into their inventory, down to individual purchase batches and their expiry dates, and (b) AI-driven decision support that predicts near-term demand and recommends restocking quantities and markdown discounts to reduce waste and stockouts. The system is a portfolio-grade demonstration of full-stack engineering with an integrated, swappable machine-learning layer — it is explicitly scoped around inventory and AI decision support, not a full store-operations ERP.

Because the project will not have access to months of real transactional data at build time, the system must generate realistic synthetic sales history per store so the ML layer has something non-trivial to learn from and recommend against.

---

## 2. Functional Requirements

### 2.1 Tenancy & Accounts
- FR-1: The system is multi-tenant. Each tenant is one independent grocery store ("Store"). Data (products, batches, predictions, recommendations) is strictly isolated per Store; no cross-store data access is possible through any API.
- FR-2: Each Store has exactly one user account at this stage (no employee sub-roles, no owner/employee distinction). "Multiple independent stores using the platform" refers to tenant isolation between Stores, not multiple users within one Store.
- FR-3: A user signs up, creating a new Store tenant, and logs in to access only that Store's data.

### 2.2 Product & Inventory Management
- FR-4: Users can create, edit, and deactivate Products (e.g., "Whole Milk 1L"), each with a category, unit of measure, default shelf-life-in-days, default purchase cost, and default selling price.
- FR-5: Inventory is tracked at the **batch level**. A Batch belongs to one Product and records: quantity received, purchase date, expiry date, purchase cost per unit, and remaining quantity.
- FR-6: Two batches of the same Product with different expiry dates (e.g., 20 units expiring Nov 20, 30 units expiring Nov 25) are always stored as two distinct Batch records, never merged.
- FR-7: Remaining quantity on a Batch decreases as (simulated) sales consume stock, using FIFO-by-expiry consumption (the batch expiring soonest is depleted first).
- FR-8: Users can view current inventory as a list of Products, each expandable into its active Batches with quantity remaining and days-to-expiry.
- FR-9: Full purchase-order workflows, supplier management, and manual sales-entry screens are explicitly **out of scope** for this project (see Constraints). Batches are seeded/created through the synthetic data generator and through a minimal "receive stock" action that creates a new Batch.

### 2.3 Synthetic Data Generation
- FR-10: The system includes a synthetic data generator that, per Store, produces: a realistic product catalog (if the user doesn't define one), historical purchase batches with varied expiry windows, and a history of daily sales per product with realistic seasonality/randomness (e.g., weekday/weekend effects, occasional demand spikes, slow-moving vs fast-moving product profiles).
- FR-11: The generator must produce enough historical daily sales (configurable, default ~180 days) per product to support next-day demand model training.
- FR-12: Generated sales history is stored as first-class sales records (date, product, quantity sold, revenue) that both the ML service and the dashboard analytics read from — it is not just scratch data for training.

### 2.4 ML / AI Layer
- FR-13: The ML service predicts, per Product per Store, **next-day demand** (quantity expected to sell tomorrow).
- FR-14: The ML service computes, per active Batch, **expiry-risk**: the probability/quantity of that batch's remaining stock still being unsold at its expiry date, derived from the next-day demand prediction projected forward across the batch's remaining shelf life.
- FR-15: The system generates two types of recommendations, combining ML predictions with deterministic business rules (hybrid approach):
  - **Restock recommendation**: a suggested reorder quantity per Product, based on predicted demand vs. current remaining stock across all its batches.
  - **Discount recommendation**: a suggested markdown percentage for a specific at-risk Batch, based on its expiry-risk and days remaining.
- FR-16: The model layer must be architected so the underlying algorithm (e.g., Random Forest initially) can be swapped or extended without changing the API contract between the backend and the ML service — i.e., the ML service exposes stable prediction endpoints regardless of which model implementation sits behind them.
- FR-17: When a Product has insufficient sales history to train/support a reliable ML prediction (see Constraints §4.7 for the threshold), the ML service falls back to a simple statistical rule (e.g., moving average of available history, or category-average demand) and marks the response as a fallback estimate. It never silently returns a bare prediction without indicating fallback status, and it never refuses to return a number.
- FR-18: Predictions and recommendations are computed **on demand**, triggered when the user opens the relevant analytics/dashboard view. There is no background scheduler or nightly batch job in this version.
- FR-19: Each prediction/recommendation run is persisted (with a timestamp) so the dashboard's "Recommendation history" view can show past recommendations, even without recomputing them.

### 2.5 Dashboard (Frontend)
The dashboard must include all of the following views:
- FR-20: **Inventory overview** — all products with total remaining stock and batch breakdown.
- FR-21: **Expiring-soon alerts** — batches within a configurable threshold (default 5 days) of expiry, sorted by urgency.
- FR-22: **Demand forecast charts** — per-product next-day demand prediction, with recent actual sales plotted alongside for context.
- FR-23: **Waste analytics** — expired/unsold quantity and its cost over time, by product and category.
- FR-24: **Restock recommendations** — list of products with suggested reorder quantities.
- FR-25: **Discount recommendations** — list of at-risk batches with suggested markdown percentages.
- FR-26: **Profit/revenue analytics** — revenue, cost, gross margin over time, and estimated loss from waste vs. estimated savings from acted-on recommendations.
- FR-27: **Recommendation history** — a log of past restock/discount recommendations generated for the store.
- FR-28: **Product-level analytics** — drill-down per product: sales trend, batch history, demand accuracy (predicted vs. actual), and waste history.
- FR-29: Recommendations in the UI show only the recommendation itself (e.g., "Discount Milk by 15%") without an inline rationale. Rationale data (the numbers behind the recommendation) is still computed and stored by the backend (see API contract) so it can be exposed later, but the UI is not required to render it as explanatory text in this version.

### 2.6 Authentication
- FR-30: Users register and log in with email + password. Sessions are managed via JWT access tokens plus refresh tokens. Passwords are hashed (bcrypt or equivalent) before storage.

### 2.7 Model Evaluation
*(Gap filled from the original proposal, which specified MAE/RMSE evaluation but was not covered by an earlier question. Decision made unilaterally — see note below.)*
- FR-31: The ML service evaluates its own demand-prediction model using a **time-based holdout**: for each product with sufficient history (see C-7's 30-day threshold), the earliest 80% of its sales history is used for training and the most recent 20% is held out as a test set. The model never trains on data it is tested against.
- FR-32: On each evaluation run, the ML service computes **MAE (Mean Absolute Error)** and **RMSE (Root Mean Squared Error)** between predicted and actual demand on the holdout set, both **per product** and **aggregated** across all evaluated products for the current `modelVersion`.
- FR-33: Evaluation runs automatically at the end of `POST /sales/generate` (synthetic data creation/regeneration), since that is when sufficient history first exists, and can also be triggered manually. Each run's results are persisted with their `modelVersion` and timestamp, so metrics from different model implementations (e.g., Random Forest vs. a later swapped-in model, per FR-16) can be compared over time rather than only showing the latest run.
- FR-34: The dashboard includes a **Model Performance** view showing the current aggregate MAE/RMSE, a per-product breakdown, and — once more than one `modelVersion` has recorded evaluation history — a simple side-by-side comparison across versions.

---

## 3. API Contract

All endpoints are versioned under `/api/v1`. All authenticated endpoints require a `Authorization: Bearer <access_token>` header. All responses are JSON. All list endpoints support `page` and `pageSize` query params with a default `pageSize` of 25.

### 3.1 Internal Data Structures (shared types)

```
Store {
  id: UUID
  name: string
  createdAt: ISODateTime
}

User {
  id: UUID
  storeId: UUID
  email: string
  passwordHash: string        // never serialized to API responses
  createdAt: ISODateTime
}

Product {
  id: UUID
  storeId: UUID
  name: string
  category: string
  unit: string                 // e.g. "unit", "kg", "liter"
  shelfLifeDays: integer        // default shelf life used when generating new batches
  defaultPurchaseCost: decimal
  defaultSellingPrice: decimal
  isActive: boolean
  createdAt: ISODateTime
}

Batch {
  id: UUID
  storeId: UUID
  productId: UUID
  quantityReceived: decimal
  quantityRemaining: decimal
  purchaseDate: ISODate
  expiryDate: ISODate
  purchaseCostPerUnit: decimal
  status: enum("ACTIVE","DEPLETED","EXPIRED")
  createdAt: ISODateTime
}

SaleRecord {
  id: UUID
  storeId: UUID
  productId: UUID
  date: ISODate
  quantitySold: decimal
  revenue: decimal
  source: enum("SYNTHETIC","MANUAL")   // MANUAL reserved for future use; FR-9 scopes this version to SYNTHETIC
}

DemandPrediction {
  id: UUID
  storeId: UUID
  productId: UUID
  horizon: enum("NEXT_DAY")            // only NEXT_DAY in this version, enum reserved for future horizons
  predictedQuantity: decimal
  isFallback: boolean
  fallbackReason: string | null         // e.g. "insufficient_history"
  modelVersion: string                  // e.g. "random_forest_v1"
  generatedAt: ISODateTime
}

ExpiryRisk {
  id: UUID
  storeId: UUID
  batchId: UUID
  predictedUnsoldQuantity: decimal
  riskScore: decimal                    // 0.0–1.0
  generatedAt: ISODateTime
}

Recommendation {
  id: UUID
  storeId: UUID
  type: enum("RESTOCK","DISCOUNT")
  productId: UUID
  batchId: UUID | null                  // present for DISCOUNT, null for RESTOCK
  suggestedValue: decimal               // quantity for RESTOCK, percentage for DISCOUNT
  rationale: {                          // always computed/stored; UI may choose not to render it (FR-29)
    predictedDemand: decimal
    quantityAtRisk: decimal
    daysToExpiry: integer | null
    basis: string                       // short machine-readable rule id, e.g. "expiry_risk_gt_demand"
  }
  generatedAt: ISODateTime
}

ModelEvaluation {
  id: UUID
  storeId: UUID
  productId: UUID | null                // null row = aggregate across all evaluated products
  modelVersion: string
  mae: decimal
  rmse: decimal
  testSetSize: integer                  // number of holdout data points used
  evaluatedAt: ISODateTime
}
```

### 3.2 Auth

`POST /api/v1/auth/register`
- Input: `{ storeName: string, email: string, password: string }`
- Output: `{ user: User, store: Store, accessToken: string, refreshToken: string }`

`POST /api/v1/auth/login`
- Input: `{ email: string, password: string }`
- Output: `{ accessToken: string, refreshToken: string }`

`POST /api/v1/auth/refresh`
- Input: `{ refreshToken: string }`
- Output: `{ accessToken: string, refreshToken: string }`

### 3.3 Products

`GET /api/v1/products` → `{ items: Product[], page, pageSize, total }`
`POST /api/v1/products` — Input: `{ name, category, unit, shelfLifeDays, defaultPurchaseCost, defaultSellingPrice }` → `Product`
`PATCH /api/v1/products/:id` — Input: partial `Product` fields → `Product`
`DELETE /api/v1/products/:id` — soft-deactivates (`isActive=false`) → `204 No Content`

### 3.4 Batches

`GET /api/v1/products/:productId/batches` → `{ items: Batch[], page, pageSize, total }`
`POST /api/v1/products/:productId/batches` ("receive stock") — Input: `{ quantityReceived, purchaseDate, expiryDate, purchaseCostPerUnit }` → `Batch`
`GET /api/v1/batches/expiring?withinDays=5` → `{ items: Batch[] }`

### 3.5 Sales (synthetic)

`POST /api/v1/sales/generate` — triggers synthetic data generation for the store. Input: `{ days: integer (default 180), productCount: integer (optional, generates catalog if store has no products) }` → `{ productsCreated: integer, batchesCreated: integer, salesRecordsCreated: integer }`
`GET /api/v1/sales?productId=&from=&to=` → `{ items: SaleRecord[], page, pageSize, total }`

### 3.6 Predictions & Recommendations

`GET /api/v1/predictions/demand/:productId` — computes (on demand) and returns the latest `DemandPrediction`. Calls the ML service synchronously; persists the result.
`GET /api/v1/predictions/expiry-risk/:batchId` — computes and returns `ExpiryRisk` for a batch.
`GET /api/v1/recommendations?type=RESTOCK|DISCOUNT` → `{ items: Recommendation[], page, pageSize, total }` — triggers fresh computation across all active products/batches for the store, persists new `Recommendation` rows, and returns them.
`GET /api/v1/recommendations/history?from=&to=&type=` → `{ items: Recommendation[], page, pageSize, total }` — reads persisted history only, no recomputation.

### 3.7 Model Evaluation

`GET /api/v1/ml/evaluation?modelVersion=` → `{ aggregate: ModelEvaluation, byProduct: ModelEvaluation[] }` — returns the latest persisted evaluation; defaults to the current `modelVersion` if none specified.
`GET /api/v1/ml/evaluation/history?modelVersion=` → `{ items: ModelEvaluation[] }` — all historical evaluation runs, for cross-version comparison.
`POST /api/v1/ml/evaluation/run` — manually triggers an evaluation run (also triggered automatically by `POST /sales/generate`, FR-33) → `{ aggregate: ModelEvaluation, byProduct: ModelEvaluation[] }`

### 3.8 Analytics

`GET /api/v1/analytics/waste?from=&to=` → `{ byProduct: [{ productId, wastedQuantity, wastedCost }], total: { wastedQuantity, wastedCost } }`
`GET /api/v1/analytics/revenue?from=&to=` → `{ series: [{ date, revenue, cost, grossMargin }], estimatedWasteLoss: decimal, estimatedRecommendationSavings: decimal }`
`GET /api/v1/analytics/products/:productId` → `{ salesTrend: [...], batchHistory: Batch[], demandAccuracy: [{ date, predicted, actual }], wasteHistory: [...] }`

### 3.9 ML Service (internal, called by backend only — not exposed to frontend)

Base URL internal only, e.g. `http://ml-service:8000`.

`POST /predict/demand`
- Input: `{ storeId, productId, horizon: "NEXT_DAY", salesHistory: [{ date, quantitySold }] }`
- Output: `{ predictedQuantity: decimal, isFallback: boolean, fallbackReason: string | null, modelVersion: string }`

`POST /predict/expiry-risk`
- Input: `{ storeId, batchId, productId, quantityRemaining, daysToExpiry, demandPrediction: decimal }`
- Output: `{ predictedUnsoldQuantity: decimal, riskScore: decimal }`

`POST /evaluate`
- Input: `{ storeId, products: [{ productId, salesHistory: [{ date, quantitySold }] }] }`
- Output: `{ modelVersion: string, aggregate: { mae: decimal, rmse: decimal, testSetSize: integer }, byProduct: [{ productId, mae: decimal, rmse: decimal, testSetSize: integer, skipped: boolean, skipReason: string | null }] }`
- Performs the train/test split described in FR-31 internally; products without enough history are returned with `skipped: true` and a reason rather than omitted silently.

The ML service's internal model implementation (Random Forest or any replacement) is never reflected in this contract — only `modelVersion` changes.

---

## 4. Constraints

- C-1: **Stack**: React + TypeScript frontend; Node.js/Express + TypeScript backend API; Python (FastAPI) ML microservice; PostgreSQL as the single source-of-truth database. The ML service does not have its own database — it receives data it needs in the request payload or (optionally) reads directly from PostgreSQL for training data pulls only, never writes to it directly; all persistence of predictions/recommendations happens via the Node backend.
- C-2: The ML service is a **separate process/container** from the backend; the backend never shells out to or embeds Python.
- C-3: No real-time/streaming infrastructure (no websockets, no message queue) is required — all computation is synchronous request/response triggered by user navigation (FR-18).
- C-4: No background job scheduler (no cron, no nightly batch) is in scope for this version.
- C-5: No supplier management, purchase-order approval workflow, multi-user roles, or POS integration is in scope.
- C-6: Manual sales entry and CSV sales import are **not** in scope; all sales data originates from the synthetic generator (FR-10).
- C-7: A demand prediction is considered **reliable** only if the product has at least 30 days of sales history; below that threshold the fallback path (FR-17) is used. This 30-day threshold is a named constant the ML service exposes/configures, not hardcoded inline.
- C-8: **Local development/testing** uses Docker Compose (frontend, backend, ML service, Postgres as four services) — this remains the standard way to run and test the system during development.
- C-8a: **Production hosting target** (so the finished project is a live link to show an interviewer, not just a local demo): the React frontend deploys as a static build to **Vercel**; the Node/Express backend and the Python/FastAPI ML service deploy as two separate web services on **Render**; PostgreSQL runs as Render's managed Postgres instance. Antigravity must make the project **deployment-ready** for this split — correct build output, Dockerfiles for the two Render services, a `render.yaml` (or documented manual service config), and a documented frontend env var for the backend's base URL — but must **not** attempt to actually deploy, provision accounts, or run deploy commands against Vercel/Render; deployment itself is done by the user, manually, outside of Antigravity.
- C-8b: Because frontend (Vercel) and backend (Render) run on different domains in production, the backend must read its allowed CORS origin(s) from an environment variable rather than hardcoding `localhost`, and the frontend must read the backend's base URL from a build-time environment variable rather than hardcoding `localhost`.
- C-8c: The backend and the ML service each expose a lightweight `GET /health` endpoint (no auth required) returning `{ status: "ok" }`, since Render's web services require a health-check path to determine the service is live.
- C-8d: The ML service, as a separate Render web service on a free tier, may cold-start after inactivity. This is an accepted trade-off given predictions are already computed on-demand (FR-18/C-3) rather than a defect to design around; EC-5's existing timeout/`503` handling already covers a slow or unresponsive ML service.
- C-9: All monetary values are stored as decimals (not floats) to avoid rounding drift in revenue/cost calculations.
- C-10: Dates are stored in UTC; display-layer timezone conversion is a frontend concern only.
- C-11: The project's primary demonstration goal is **ML engineering** (per the chosen priority); the full-stack layer exists to make the ML layer demonstrable end-to-end, and engineering effort should bias toward model quality, evaluation, and the swappable-model architecture (FR-16) when trade-offs arise.
- C-12: Model evaluation (FR-31/32) only runs for products meeting the same 30-day minimum-history threshold as C-7; the 20% holdout is additionally required to contain at least 6 data points, otherwise that product is skipped (not padded or estimated around) for that evaluation run.

---

## 5. Edge Cases and Error Handling

- EC-1: **No sales history at all for a product** (e.g., just created): demand prediction returns the fallback path immediately with `fallbackReason: "no_history"`; the UI must render the fallback indicator, never a bare number presented as confident.
- EC-2: **Batch with quantityRemaining = 0**: status transitions to `DEPLETED`; it is excluded from expiry-risk and discount-recommendation computation, and excluded from "expiring soon" alerts.
- EC-3: **Batch whose expiryDate has passed while quantityRemaining > 0**: status transitions to `EXPIRED`; the unsold remaining quantity at the moment of expiry is recorded as waste (feeds FR-23 waste analytics) and the batch is excluded from future restock/discount recommendation runs.
- EC-4: **Synthetic data generation requested for a store that already has sales history**: the endpoint rejects with `409 Conflict` and an explanatory error unless an explicit `overwrite: true` flag is passed, in which case prior synthetic SaleRecords, Batches, and Products created by generation are deleted and regenerated.
- EC-5: **ML service unreachable or times out** (>5s): backend catches the failure, does not persist a prediction, and returns `503 Service Unavailable` with `{ error: "ml_service_unavailable" }`. It never fabricates a prediction value on the backend side as a substitute.
- EC-6: **ML service returns a malformed/out-of-range response** (e.g., negative predicted quantity): backend rejects the response, logs it, and returns `502 Bad Gateway` with `{ error: "invalid_ml_response" }` rather than persisting bad data.
- EC-7: **Two overlapping discount recommendations generated for the same batch on the same day**: only the most recent one is considered "current" (returned by `GET /recommendations`); older ones remain in history but are marked superseded via `generatedAt` ordering — no duplicate "current" state is exposed.
- EC-8: **Negative or zero quantity/cost values submitted via API** (e.g., creating a batch with `quantityReceived: -5`): request rejected with `400 Bad Request` and a field-level validation error.
- EC-9: **Expiry date earlier than purchase date** on batch creation: rejected with `400 Bad Request`.
- EC-10: **Concurrent stock consumption** (simulated sale and a manual "receive stock" happening close together): batch quantity updates are done via atomic SQL updates (row-level locking / `UPDATE ... WHERE quantityRemaining >= X`) to prevent negative stock from race conditions.
- EC-11: **Login/register with an email already in use**: `409 Conflict` with `{ error: "email_already_registered" }`.
- EC-12: **Expired/invalid JWT access token**: `401 Unauthorized` with `{ error: "token_expired" }`; frontend attempts a silent refresh via the refresh token before forcing re-login.
- EC-13: **Product deactivated while it still has active batches**: deactivation is still allowed (FR-9 soft delete), but active batches of a deactivated product continue to appear in expiry/waste tracking until depleted or expired; they are simply hidden from "create new batch" flows.
- EC-14: **Pagination requested beyond available data** (`page` beyond last page): returns `{ items: [], page, pageSize, total }`, not an error.
- EC-15: **Evaluation triggered when no product has enough history yet** (e.g., immediately after a store is created with no synthetic data generated): `POST /api/v1/ml/evaluation/run` returns `200 OK` with an empty `byProduct` array and a null/zero-valued `aggregate` marked clearly as "no data," not an error — the Model Performance view must distinguish this from a genuinely poor-performing model.
- EC-16: **A product crosses the 30-day history threshold between two evaluation runs**: it is simply included starting from the run after it qualifies; no retroactive evaluation of its earlier (insufficient) history is attempted.

---

## 6. Acceptance Criteria

- AC-1: Given a new Store with no data, calling `POST /sales/generate` with no existing products creates a product catalog, batches with varied expiry dates, and at least `days` worth of daily SaleRecords per product, and the dashboard's Inventory Overview reflects the generated products and batches without further action.
- AC-2: Given two batches of the same product with expiry dates 5 days apart, the system never merges them into a single inventory row; both appear distinctly in `GET /products/:id/batches` and in the Inventory Overview drill-down.
- AC-3: Given a product with ≥30 days of synthetic sales history, `GET /predictions/demand/:productId` returns `isFallback: false` and a `predictedQuantity` derived from the ML model (not a static average).
- AC-4: Given a product with <30 days of sales history, `GET /predictions/demand/:productId` returns `isFallback: true`, a non-null `fallbackReason`, and a usable (non-null, non-negative) `predictedQuantity` computed via the statistical fallback — the endpoint never returns an error or a null prediction solely due to insufficient history.
- AC-5: Given a batch within its configured "expiring soon" threshold, it appears in `GET /batches/expiring` and in the Expiring-Soon Alerts dashboard view, sorted with the most urgent (soonest expiry) first.
- AC-6: Given a batch whose predicted unsold quantity at expiry is greater than zero, a `DISCOUNT` Recommendation is generated for that batch with a `suggestedValue` percentage greater than 0, and the stored `rationale` object contains the predicted demand, quantity at risk, and days to expiry used to derive it (even though the UI does not render this rationale per FR-29).
- AC-7: Given a product whose predicted demand exceeds current total remaining stock across its active batches, a `RESTOCK` Recommendation is generated with a `suggestedValue` quantity greater than zero.
- AC-8: The Recommendation History view returns previously generated recommendations via `GET /recommendations/history` without triggering any new ML computation (verifiable by the ML service receiving zero additional calls when only the history endpoint is hit).
- AC-9: The Waste Analytics view's total wasted cost for a given date range equals the sum of `(quantityRemaining at time of expiry) × purchaseCostPerUnit` across all batches that transitioned to `EXPIRED` in that range.
- AC-10: The Profit/Revenue Analytics view's `estimatedWasteLoss` and `estimatedRecommendationSavings` figures are derived from stored SaleRecord, Batch, and Recommendation data — not hardcoded or randomly displayed.
- AC-11: Swapping the ML service's internal model implementation (e.g., from Random Forest to gradient boosting) requires no changes to the backend code or the `/predict/demand` and `/predict/expiry-risk` request/response contracts — only `modelVersion` in the response changes.
- AC-12: A user cannot, through any API call with a valid token for Store A, read or mutate any Product, Batch, SaleRecord, Prediction, or Recommendation belonging to Store B.
- AC-13: Submitting a batch with a negative quantity, or an expiry date earlier than its purchase date, is rejected with `400 Bad Request` and never persisted.
- AC-14: Registering with an email that already exists returns `409 Conflict` and does not create a duplicate User/Store.
- AC-15: With the ML service stopped, requesting a demand prediction returns `503` within 5 seconds and does not create a `DemandPrediction` row, and the dashboard surfaces a clear "prediction unavailable" state rather than a blank or broken chart.
- AC-16: The entire system (frontend, backend, ML service, PostgreSQL) starts from a single `docker-compose up` with no manual post-start steps beyond running migrations/seed.
- AC-17: Given synthetic data generation (`POST /sales/generate`) completes for a store with products that have ≥30 days of history, a subsequent `GET /ml/evaluation` returns a non-null `aggregate.mae` and `aggregate.rmse`, and a `byProduct` entry for each qualifying product with its own `mae`/`rmse`, computed strictly from each product's held-out last-20% window (verifiable: the test window's dates never overlap the training window's dates for any product).
- AC-18: Given two evaluation runs recorded under different `modelVersion` values for the same store, `GET /ml/evaluation/history` returns both runs distinctly, and the Model Performance dashboard view can render them side by side without additional computation.
- AC-19: The backend and ML service each respond `200 { status: "ok" }` on `GET /health` with no auth header. The frontend's backend base URL and the backend's allowed CORS origin are both read from environment variables (verifiable by changing the env var and confirming the app points elsewhere, with no source-code edit required). No Vercel- or Render-specific CLI command or API call is invoked by any code or script in the repository — deployment configuration is prepared as files only.
