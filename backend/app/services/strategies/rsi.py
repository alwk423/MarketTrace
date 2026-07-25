import pandas as pd

from app.services.strategies.base import Strategy


class RsiStrategy(Strategy):
    """Buy when RSI exits oversold territory, sell when it exits overbought territory."""

    def __init__(self, period: int = 14, oversold: float = 30, overbought: float = 70, **params):
        super().__init__(period=period, oversold=oversold, overbought=overbought, **params)
        self.period = period
        self.oversold = oversold
        self.overbought = overbought

    def _rsi(self, close: pd.Series) -> pd.Series:
        delta = close.diff()
        gain = delta.clip(lower=0).rolling(self.period).mean()
        loss = (-delta.clip(upper=0)).rolling(self.period).mean()
        rs = gain / loss.replace(0, float("nan"))
        return 100 - (100 / (1 + rs))

    def generate_signals(self, prices: pd.DataFrame) -> pd.Series:
        rsi = self._rsi(prices["close"])

        signals = pd.Series(0, index=prices.index)
        signals[(rsi < self.oversold) & (rsi.shift(1) >= self.oversold)] = 1
        signals[(rsi > self.overbought) & (rsi.shift(1) <= self.overbought)] = -1
        return signals
