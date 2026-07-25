from datetime import date

import pandas as pd
import yfinance as yf


def get_price_history(symbol: str, start_date: date, end_date: date) -> pd.DataFrame:
    """Fetch daily OHLCV history for `symbol` between the given dates.

    Raises ValueError if the symbol has no data in that range (e.g. it's
    invalid or was never traded during that window).
    """
    df = yf.download(symbol, start=start_date, end=end_date, progress=False, auto_adjust=True)
    if df.empty:
        raise ValueError(f"No price data found for symbol '{symbol}'")

    # yfinance returns MultiIndex columns when given a single ticker as a list;
    # normalize so downstream code can always assume flat lowercase columns.
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    df = df.rename(columns=str.lower)
    df.index.name = "date"

    # The most recent row can be an in-progress trading session with NaN
    # OHLC values (real volume, no price yet) - unusable for backtesting.
    df = df.dropna(subset=["close"])
    if df.empty:
        raise ValueError(f"No price data found for symbol '{symbol}'")

    return df
