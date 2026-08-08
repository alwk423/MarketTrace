from datetime import date, datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel

from app.models.strategy import StrategyType


class SimulationRequest(BaseModel):
    stock_symbol: str
    strategy_type: StrategyType
    strategy_parameters: dict[str, Any] = {}
    start_date: date
    end_date: date
    initial_capital: float = 10_000.0


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


class IndicatorPoint(BaseModel):
    date: datetime
    value: float | None


class SimulationResult(BaseModel):
    id: UUID
    stock_symbol: str
    start_date: date
    end_date: date
    initial_capital: float
    final_capital: float
    total_return_pct: float
    buy_and_hold_return_pct: float | None = None
    trades: list[TradeRead]
    equity_curve: list[EquityPoint]
    buy_and_hold_equity_curve: list[EquityPoint] = []
    indicators: dict[str, list[IndicatorPoint]] = {}
