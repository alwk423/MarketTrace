from datetime import datetime

from pydantic import BaseModel


class PricePoint(BaseModel):
    date: datetime
    open: float
    high: float
    low: float
    close: float
    volume: int


class StockHistory(BaseModel):
    symbol: str
    prices: list[PricePoint]
