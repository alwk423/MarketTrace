# MarketTrace

Pick a stock, pick a strategy, run a backtest against historical data, and see
exactly which trades fired and why.

## Stack

- **Backend**: FastAPI + SQLAlchemy + Alembic, pandas for the backtesting math, `yfinance` for historical OHLCV data.
- **Database**: PostgreSQL — stores strategy configs, simulation runs, and the resulting trade log.
- **Frontend**: React + Vite + TypeScript, Recharts for the price/trade chart.

## Project layout

```
backend/
  app/
    api/routes/        # HTTP endpoints (stocks, strategies, simulations)
    core/               # settings + DB session
    models/             # SQLAlchemy tables
    schemas/             # Pydantic request/response models
    services/
      strategies/       # one file per strategy (implements generate_signals)
      backtester.py     # runs a strategy over price history, produces trades
      market_data.py    # fetches historical prices
  alembic/              # migrations
  tests/
frontend/
  src/
    api/                # backend HTTP client
    components/         # StockPicker, StrategyPicker, TradeChart, ResultsPanel
    pages/SimulatorPage.tsx
    hooks/useSimulation.ts
    types/
```

## Local development

Requires Python 3.11+, Node 20+, and Docker (for Postgres).

```bash
cp .env.example .env
cp backend/.env.example backend/.env

make setup       # installs backend (venv) + frontend (npm) deps
make db-up       # starts Postgres in Docker
make migrate     # applies migrations
make backend     # runs FastAPI on :8000
make frontend    # in another terminal, runs Vite on :5173
```

Visit `http://localhost:5173`. The Vite dev server proxies `/api` to the
backend, so no CORS setup is needed locally.

Other useful targets: `make test` (backend tests), `make lint` (ruff + eslint),
`make migration msg="..."` (new Alembic revision), `make up`/`make down`
(run the whole stack via Docker Compose instead of locally).

## Adding a new strategy

1. Add a class in `backend/app/services/strategies/` implementing `generate_signals(prices) -> pd.Series` (values `1`/`-1`/`0` for buy/sell/hold).
2. Register it in `STRATEGY_REGISTRY` in `backend/app/services/backtester.py`.
3. Describe its parameters in `STRATEGY_CATALOG` in `backend/app/api/routes/strategies.py` so the frontend can render a form for it.

## CI/CD

`.github/workflows/ci.yml` runs backend tests (against a real Postgres
service container) and lints + builds the frontend on every push/PR to
`main`. There's no deploy step yet — add one (e.g. build + push Docker images)
once you've picked a hosting target.
