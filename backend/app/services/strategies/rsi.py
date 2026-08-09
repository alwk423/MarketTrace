import pandas as pd

from app.services.indicators import rsi as compute_rsi
from app.services.strategies.base import Strategy


class RsiStrategy(Strategy):
    """Buy when RSI exits oversold territory, sell when it exits overbought territory."""

    def __init__(self, period: int = 14, oversold: float = 30, overbought: float = 70, **params):
        super().__init__(period=period, oversold=oversold, overbought=overbought, **params)
        self.period = period
        self.oversold = oversold
        self.overbought = overbought

    def generate_signals(self, prices: pd.DataFrame) -> pd.Series:
        rsi = compute_rsi(prices, self.period)

        signals = pd.Series(0, index=prices.index)  # default: hold, every day
        # Just dropped below the oversold line (e.g. 30): price has been falling a
        # lot lately -> bet on a bounce back up -> buy.
        signals[(rsi < self.oversold) & (rsi.shift(1) >= self.oversold)] = 1
        # Just rose above the overbought line (e.g. 70): price has been rising a
        # lot lately -> bet it cools off -> sell.
        signals[(rsi > self.overbought) & (rsi.shift(1) <= self.overbought)] = -1
        return signals

    def compute_indicators(self, prices: pd.DataFrame) -> dict:
        return {"rsi": compute_rsi(prices, self.period)}
