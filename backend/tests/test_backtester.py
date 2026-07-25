import pandas as pd

from app.services.strategies.sma_crossover import SmaCrossoverStrategy


def test_sma_crossover_generates_buy_then_sell():
    prices = pd.DataFrame(
        {"close": [10, 10, 10, 12, 14, 16, 14, 12, 10, 8]},
        index=pd.date_range("2024-01-01", periods=10),
    )
    strategy = SmaCrossoverStrategy(short_window=2, long_window=4)
    signals = strategy.generate_signals(prices)

    assert 1 in signals.values
    assert -1 in signals.values
    # A buy must precede the first sell.
    first_buy = signals[signals == 1].index[0]
    first_sell = signals[signals == -1].index[0]
    assert first_buy < first_sell
