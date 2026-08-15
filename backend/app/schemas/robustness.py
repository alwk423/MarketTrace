from datetime import date
from typing import Any

from pydantic import BaseModel, Field

from app.models.strategy import StrategyType
from app.schemas.simulation import EquityPoint


class WalkForwardRequest(BaseModel):
    stock_symbol: str
    strategy_type: StrategyType
    strategy_parameters: dict[str, Any] = Field(default_factory=dict)
    start_date: date
    end_date: date
    initial_capital: float = 10_000.0
    fee_pct: float = 0.1
    slippage_pct: float = 0.05
    position_size_pct: float = 100.0
    # Fraction of the date range treated as the "train" window; the rest is "test".
    train_ratio: float = 0.7
    # SMA-crossover only: grid-search short/long windows on the train window and
    # carry the best-performing pair into the test window, instead of the
    # parameters supplied above.
    optimize_on_train: bool = False
    short_windows: list[int] = Field(default_factory=lambda: [5, 10, 15, 20, 25, 30])
    long_windows: list[int] = Field(default_factory=lambda: [20, 30, 40, 50, 60, 80])


class WalkForwardWindowResult(BaseModel):
    start_date: date
    end_date: date
    total_return_pct: float
    sharpe: float
    final_capital: float
    trade_count: int


class WalkForwardResult(BaseModel):
    split_date: date
    optimized_parameters: dict[str, Any] | None = None
    train: WalkForwardWindowResult
    test: WalkForwardWindowResult
    equity_curve: list[EquityPoint]
    buy_and_hold_equity_curve: list[EquityPoint] = []


class MonteCarloRequest(BaseModel):
    stock_symbol: str
    strategy_type: StrategyType
    strategy_parameters: dict[str, Any] = Field(default_factory=dict)
    start_date: date
    end_date: date
    initial_capital: float = 10_000.0
    fee_pct: float = 0.1
    slippage_pct: float = 0.05
    position_size_pct: float = 100.0
    num_simulations: int = 500


class MonteCarloResult(BaseModel):
    observed_return_pct: float
    observed_percentile: float
    mean_return_pct: float
    median_return_pct: float
    std_dev_pct: float
    percentiles: dict[str, float]
    simulated_returns_pct: list[float]
