import pandas as pd


def sma(prices: pd.DataFrame, period: int) -> pd.Series:
    """Simple moving average of the close over `period` days."""
    return prices["close"].rolling(period).mean()


def rsi(prices: pd.DataFrame, period: int) -> pd.Series:
    # RSI (Relative Strength Index): a 0-100 score for "how one-sided has price
    # movement been lately." Near 100 = almost all recent days were gains
    # ("overbought"). Near 0 = almost all recent days were losses ("oversold").
    close = prices["close"]
    delta = close.diff()  # today's price minus yesterday's, for every day
    # Keep only the up-days (clip everything below 0 up to 0), then average
    # over the last `period` days -> "how big have the recent gains been."
    gain = delta.clip(lower=0).rolling(period).mean()
    # Keep only the down-days (clip everything above 0 down to 0), flip the
    # sign so it's a positive number -> "how big have the recent losses been."
    loss = (-delta.clip(upper=0)).rolling(period).mean()
    rs = gain / loss.replace(0, float("nan"))  # avg gain vs avg loss ratio
    return 100 - (100 / (1 + rs))  # squash that ratio onto the 0-100 RSI scale


def price(prices: pd.DataFrame) -> pd.Series:
    return prices["close"]


# Every indicator a custom strategy rule can reference. `price` takes no
# period; sma/rsi do. Kept in one place so the custom rule engine and the
# built-in strategies compute these the same way.
INDICATOR_REGISTRY = {"sma": sma, "rsi": rsi, "price": price}


def get_indicator_series(prices: pd.DataFrame, indicator: str, period: int | None) -> pd.Series:
    if indicator not in INDICATOR_REGISTRY:
        raise ValueError(f"Unknown indicator '{indicator}'")
    if indicator == "price":
        return price(prices)
    if period is None:
        raise ValueError(f"Indicator '{indicator}' requires a period")
    return INDICATOR_REGISTRY[indicator](prices, period)
