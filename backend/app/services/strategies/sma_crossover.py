import pandas as pd

from app.services.indicators import sma
from app.services.strategies.base import Strategy


class SmaCrossoverStrategy(Strategy):
    """Buy when the short SMA crosses above the long SMA, sell on the reverse cross."""

    def __init__(self, short_window: int = 20, long_window: int = 50, **params):
        super().__init__(short_window=short_window, long_window=long_window, **params)
        self.short_window = short_window
        self.long_window = long_window

    def generate_signals(self, prices: pd.DataFrame) -> pd.Series:
        # Fast-reacting average: mean of the last `short_window` closes, recomputed each day.
        short_sma = sma(prices, self.short_window)
        # Slow-reacting average: same idea, over a longer lookback.
        long_sma = sma(prices, self.long_window)

        # True/False per day: is the fast average currently above the slow one?
        # (NaN comparisons - during the first few days with no full window yet - are always False.)
        above = short_sma > long_sma
        # crossed_up[day] = True only when yesterday was False and today is True (it just turned on).
        # Not the same as `above` itself, which stays True every day the fast average is still on top.
        crossed_up = above & ~above.shift(1, fill_value=False)
        # crossed_down[day] = True only when yesterday was True and today is False (it just turned off).
        crossed_down = ~above & above.shift(1, fill_value=False)

        signals = pd.Series(0, index=prices.index)  # default: hold, every day
        signals[crossed_up] = 1  # buy on cross-up days
        signals[crossed_down] = -1  # sell on cross-down days
        return signals

    def compute_indicators(self, prices: pd.DataFrame) -> dict:
        return {
            "short_sma": sma(prices, self.short_window),
            "long_sma": sma(prices, self.long_window),
        }
