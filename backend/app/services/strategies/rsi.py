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
        # RSI (Relative Strength Index): a 0-100 score for "how one-sided has price
        # movement been lately." Near 100 = almost all recent days were gains
        # ("overbought"). Near 0 = almost all recent days were losses ("oversold").
        delta = close.diff()  # today's price minus yesterday's, for every day
        # Keep only the up-days (clip everything below 0 up to 0), then average
        # over the last `period` days -> "how big have the recent gains been."
        gain = delta.clip(lower=0).rolling(self.period).mean()
        # Keep only the down-days (clip everything above 0 down to 0), flip the
        # sign so it's a positive number -> "how big have the recent losses been."
        loss = (-delta.clip(upper=0)).rolling(self.period).mean()
        rs = gain / loss.replace(0, float("nan"))  # avg gain vs avg loss ratio
        return 100 - (100 / (1 + rs))  # squash that ratio onto the 0-100 RSI scale

    def generate_signals(self, prices: pd.DataFrame) -> pd.Series:
        rsi = self._rsi(prices["close"])

        signals = pd.Series(0, index=prices.index)  # default: hold, every day
        # Just dropped below the oversold line (e.g. 30): price has been falling a
        # lot lately -> bet on a bounce back up -> buy.
        signals[(rsi < self.oversold) & (rsi.shift(1) >= self.oversold)] = 1
        # Just rose above the overbought line (e.g. 70): price has been rising a
        # lot lately -> bet it cools off -> sell.
        signals[(rsi > self.overbought) & (rsi.shift(1) <= self.overbought)] = -1
        return signals
