from abc import ABC, abstractmethod

import pandas as pd


class Strategy(ABC):
    """Turns a price series into buy/sell signals."""

    def __init__(self, **params):
        self.params = params

    @abstractmethod
    def generate_signals(self, prices: pd.DataFrame) -> pd.Series:
        """Return a Series aligned to `prices.index` with values in {1, -1, 0}
        meaning buy, sell, hold.
        """
