# MarketTrace

Pick a stock (or a portfolio of them), pick a strategy — or build your own —
run a backtest against historical data, and see exactly which trades fired,
why, and how it stacks up against just buying and holding.

**Live demo**: [markettrace-sim.onrender.com](https://markettrace-sim.onrender.com)
— sign up and try it out, no setup required.

## Features

- **Strategies**: SMA crossover and RSI presets, plus a custom strategy
  builder (combine indicators and thresholds without writing code).
- **Single-symbol backtests**: trade-by-trade log, equity curve, Sharpe
  ratio, bull/bear regime breakdown, and a buy-and-hold benchmark overlay.
- **Portfolio backtests**: run a strategy across multiple weighted symbols
  and compare combined performance against a combined buy-and-hold baseline.
- **Parameter optimization**: sweep a strategy's parameters to find the
  best-performing combination over a given window.
- **Walk-forward testing**: validate a strategy out-of-sample across rolling
  windows instead of curve-fitting to one backtest.
- **Monte Carlo simulation**: resample trade sequences to see a distribution
  of likely outcomes, not just one historical path.
- **Accounts**: signup/login (JWT), personal simulation history, and public
  share links for individual backtest reports.

## Stack

- **Backend**: FastAPI + SQLAlchemy + Alembic, pandas for the backtesting math, `yfinance` for historical OHLCV data.
- **Database**: PostgreSQL — stores users, strategy configs, simulation runs, and the resulting trade log.
- **Frontend**: React + Vite + TypeScript, Recharts for price/trade/equity charts.

## Project layout

```
backend/
  app/
    api/routes/          # HTTP endpoints (auth, stocks, strategies, simulations)
    core/                 # settings, DB session, JWT/password handling
    models/                # SQLAlchemy tables (user, strategy, custom_strategy, simulation)
    schemas/                # Pydantic request/response models (simulation, portfolio, robustness, ...)
    services/
      strategies/         # one file per strategy (implements generate_signals)
      backtester.py       # runs a strategy over price history, produces trades/equity/benchmark
      indicators.py       # SMA/RSI/price indicator helpers
      market_data.py      # fetches historical prices via yfinance
  alembic/                # migrations
  tests/
frontend/
  src/
    api/client.ts         # backend HTTP client
    context/AuthContext.tsx
    components/           # StockPicker, StrategyPicker, TradeChart, ResultsPanel,
                           # PortfolioResultsPanel, WalkForwardPanel, MonteCarloPanel,
                           # OptimizationHeatmap, ShareButton, ...
    pages/                 # SimulatePage, PortfolioPage, BuildStrategyPage, HistoryPage,
                           # LoginPage, SignupPage, SharedReportPage
    hooks/                 # useSimulation, useSymbolDirectory, useStrategySelection
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

Other useful targets: `make dev` (backend + frontend together), `make test`
(backend tests), `make lint` (ruff + eslint), `make migration msg="..."` (new
Alembic revision), `make up`/`make down` (run the whole stack via Docker
Compose instead of locally).

No third-party API keys are required — market data comes from `yfinance`,
and the only secret is a locally-generated `JWT_SECRET_KEY` for signing
login tokens (see `.env.example`).

## Adding a new strategy

1. Add a class in `backend/app/services/strategies/` implementing `generate_signals(prices) -> pd.Series` (values `1`/`-1`/`0` for buy/sell/hold).
2. Register it in `STRATEGY_REGISTRY` in `backend/app/services/backtester.py`.
3. Describe its parameters in `STRATEGY_CATALOG` in `backend/app/api/routes/strategies.py` so the frontend can render a form for it.

## CI/CD

`.github/workflows/ci.yml` runs backend tests (against a real Postgres
service container) and lints + builds the frontend on every push/PR to
`main`. There's no deploy step yet — add one (e.g. build + push Docker images)
once you've picked a hosting target.
