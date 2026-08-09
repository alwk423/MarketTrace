import pandas as pd
import pytest

from app.models.strategy import StrategyType
from app.services import backtester
from app.services.strategies.sma_crossover import SmaCrossoverStrategy


class DummyStrategy:
    def generate_signals(self, prices):
        return pd.Series([1, -1], index=prices.index)

    def compute_indicators(self, prices):
        return {}


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


def test_run_backtest_applies_fees_and_slippage(monkeypatch):
    prices = pd.DataFrame(
        {"close": [100.0, 100.0]},
        index=pd.date_range("2024-01-01", periods=2),
    )
    monkeypatch.setattr(backtester, "get_price_history", lambda *args, **kwargs: prices)
    monkeypatch.setattr(backtester, "build_strategy", lambda strategy_type, parameters: DummyStrategy())

    result = backtester.run_backtest(
        symbol="AAPL",
        strategy_type=StrategyType.SMA_CROSSOVER,
        parameters={},
        start_date=prices.index[0].date(),
        end_date=prices.index[-1].date(),
        initial_capital=100.0,
        fee_pct=0.1,
        slippage_pct=0.05,
        position_size_pct=100.0,
    )

    assert result["return_before_costs_pct"] == pytest.approx(0.0)
    assert result["total_return_pct"] < 0
    assert result["final_capital"] < 100.0


def test_run_backtest_respects_position_size(monkeypatch):
    prices = pd.DataFrame(
        {"close": [100.0, 100.0]},
        index=pd.date_range("2024-01-01", periods=2),
    )
    monkeypatch.setattr(backtester, "get_price_history", lambda *args, **kwargs: prices)
    monkeypatch.setattr(backtester, "build_strategy", lambda strategy_type, parameters: DummyStrategy())

    result = backtester.run_backtest(
        symbol="AAPL",
        strategy_type=StrategyType.SMA_CROSSOVER,
        parameters={},
        start_date=prices.index[0].date(),
        end_date=prices.index[-1].date(),
        initial_capital=100.0,
        fee_pct=0.0,
        slippage_pct=0.0,
        position_size_pct=50.0,
    )

    assert result["trades"][0]["quantity"] == pytest.approx(0.5)


def test_run_backtest_returns_regime_and_sharpe(monkeypatch):
    prices = pd.DataFrame(
        {"close": [float(100 + i) for i in range(220)]},
        index=pd.date_range("2024-01-01", periods=220),
    )

    class HoldStrategy:
        def generate_signals(self, prices):
            signals = pd.Series(0, index=prices.index)
            signals.iloc[0] = 1
            return signals

    monkeypatch.setattr(backtester, "get_price_history", lambda *args, **kwargs: prices)
    monkeypatch.setattr(backtester, "build_strategy", lambda strategy_type, parameters: HoldStrategy())

    result = backtester.run_backtest(
        symbol="AAPL",
        strategy_type=StrategyType.SMA_CROSSOVER,
        parameters={"short_window": 5, "long_window": 20},
        start_date=prices.index[0].date(),
        end_date=prices.index[-1].date(),
        initial_capital=100.0,
        fee_pct=0.0,
        slippage_pct=0.0,
        position_size_pct=100.0,
    )

    assert "sharpe" in result
    assert "bull_market_return_pct" in result
    assert "bear_market_return_pct" in result
    assert isinstance(result["regime_periods"], list)
    assert result["regime_periods"]


def test_optimize_parameter_grid_returns_grid(monkeypatch):
    prices = pd.DataFrame(
        {"close": [100.0, 101.0, 102.0]},
        index=pd.date_range("2024-01-01", periods=3),
    )
    monkeypatch.setattr(backtester, "get_price_history", lambda *args, **kwargs: prices)

    calls = []

    def fake_run_backtest(**kwargs):
        calls.append(kwargs["parameters"])
        short_window = kwargs["parameters"]["short_window"]
        long_window = kwargs["parameters"]["long_window"]
        return {"total_return_pct": float(short_window + long_window), "sharpe": float(short_window)}

    monkeypatch.setattr(backtester, "run_backtest", fake_run_backtest)

    results = backtester.optimize_parameter_grid(
        symbol="AAPL",
        strategy_type=StrategyType.SMA_CROSSOVER,
        strategy_parameters={},
        start_date=prices.index[0].date(),
        end_date=prices.index[-1].date(),
        initial_capital=100.0,
        short_windows=[5, 10],
        long_windows=[10, 15],
    )

    assert calls == [
        {"short_window": 5, "long_window": 10},
        {"short_window": 5, "long_window": 15},
        {"short_window": 10, "long_window": 15},
    ]
    assert results == [
        {"parameters": {"short_window": 5, "long_window": 10}, "return_pct": 15.0, "sharpe": 5.0},
        {"parameters": {"short_window": 5, "long_window": 15}, "return_pct": 20.0, "sharpe": 5.0},
        {"parameters": {"short_window": 10, "long_window": 15}, "return_pct": 25.0, "sharpe": 10.0},
    ]
