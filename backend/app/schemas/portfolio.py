from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field

from app.models.strategy import StrategyType
from app.schemas.simulation import EquityPoint, TradeRead


class PortfolioSimulationRequest(BaseModel):
    stock_symbols: list[str]
    # Symbol -> relative weight. Missing/zero-sum weights fall back to an
    # equal split across stock_symbols (see run_portfolio_backtest).
    weights: dict[str, float] = Field(default_factory=dict)
    strategy_type: StrategyType
    strategy_parameters: dict[str, Any] = Field(default_factory=dict)
    start_date: date
    end_date: date
    initial_capital: float = 10_000.0
    fee_pct: float = 0.1
    slippage_pct: float = 0.05
    position_size_pct: float = 100.0


class PortfolioPoint(BaseModel):
    date: datetime
    equity: float


class PortfolioSymbolResult(BaseModel):
    symbol: str
    weight: float
    allocated_capital: float
    final_capital: float
    total_return_pct: float
    return_before_costs_pct: float
    sharpe: float
    buy_and_hold_return_pct: float | None = None
    trades: list[TradeRead]
    equity_curve: list[EquityPoint]


class PortfolioSimulationResult(BaseModel):
    symbols: list[PortfolioSymbolResult]
    initial_capital: float
    final_capital: float
    total_return_pct: float
    sharpe: float
    combined_equity_curve: list[PortfolioPoint]
    combined_buy_and_hold_equity_curve: list[PortfolioPoint] = []
    combined_buy_and_hold_return_pct: float | None = None
