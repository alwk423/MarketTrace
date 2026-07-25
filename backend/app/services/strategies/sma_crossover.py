import pandas as pd

from app.services.strategies.base import Strategy


class SmaCrossoverStrategy(Strategy):
    """Buy when the short SMA crosses above the long SMA, sell on the reverse cross."""

    def __init__(self, short_window: int = 20, long_window: int = 50, **params):
        super().__init__(short_window=short_window, long_window=long_window, **params)
        self.short_window = short_window
        self.long_window = long_window

    def generate_signals(self, prices: pd.DataFrame) -> pd.Series:
        close = prices["close"]
        short_sma = close.rolling(self.short_window).mean()
        long_sma = close.rolling(self.long_window).mean()

        above = short_sma > long_sma
        crossed_up = above & ~above.shift(1, fill_value=False)
        crossed_down = ~above & above.shift(1, fill_value=False)

        signals = pd.Series(0, index=prices.index)
        signals[crossed_up] = 1
        signals[crossed_down] = -1
        return signals
