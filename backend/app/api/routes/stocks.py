from datetime import date

from fastapi import APIRouter, HTTPException

from app.schemas.stock import PricePoint, StockHistory
from app.services.market_data import get_price_history

router = APIRouter(prefix="/api/stocks", tags=["stocks"])


@router.get("/{symbol}/history", response_model=StockHistory)
def get_history(symbol: str, start_date: date, end_date: date):
    try:
        df = get_price_history(symbol, start_date, end_date)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    prices = [
        PricePoint(
            date=idx,
            open=float(row["open"]),
            high=float(row["high"]),
            low=float(row["low"]),
            close=float(row["close"]),
            volume=int(row["volume"]),
        )
        for idx, row in df.iterrows()
    ]
    return StockHistory(symbol=symbol.upper(), prices=prices)
