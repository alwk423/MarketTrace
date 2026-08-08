from datetime import date, datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.strategy import StrategyType


class SimulationRequest(BaseModel):
    stock_symbol: str
    strategy_type: StrategyType
    strategy_parameters: dict[str, Any] = Field(default_factory=dict)
    start_date: date
    end_date: date
    initial_capital: float = 10_000.0
    fee_pct: float = 0.1
    slippage_pct: float = 0.05
    position_size_pct: float = 100.0


class TradeRead(BaseModel):
    trade_type: Literal["buy", "sell"]
    trade_date: datetime
    price: float
    quantity: float
    reason: str | None = None

    model_config = {"from_attributes": True}


class EquityPoint(BaseModel):
    date: datetime
    price: float
    equity: float


class SimulationResult(BaseModel):
    id: UUID
    stock_symbol: str
    start_date: date
    end_date: date
    initial_capital: float
    final_capital: float
    total_return_pct: float
    return_before_costs_pct: float
    trades: list[TradeRead]
    equity_curve: list[EquityPoint]
