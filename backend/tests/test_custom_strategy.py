import pandas as pd
import pytest
from pydantic import ValidationError

from app.models.strategy import StrategyType
from app.schemas.strategy import CustomStrategyCreate
from app.services import indicators
from app.services.backtester import build_strategy
from app.services.strategies.custom import CustomStrategy


def _prices(closes: list[float]) -> pd.DataFrame:
    return pd.DataFrame({"close": closes}, index=pd.date_range("2024-01-01", periods=len(closes)))


def test_sma_matches_rolling_mean():
    prices = _prices([1, 2, 3, 4, 5])
    result = indicators.sma(prices, 2)
    assert result.iloc[-1] == pytest.approx(4.5)
    assert pd.isna(result.iloc[0])


def test_price_indicator_is_close():
    prices = _prices([1, 2, 3])
    assert (indicators.get_indicator_series(prices, "price", None) == prices["close"]).all()


def test_get_indicator_series_rejects_unknown_indicator():
    with pytest.raises(ValueError):
        indicators.get_indicator_series(_prices([1, 2]), "macd", 12)


def test_get_indicator_series_requires_period_for_sma_rsi():
    with pytest.raises(ValueError):
        indicators.get_indicator_series(_prices([1, 2]), "sma", None)


def test_custom_strategy_fires_once_when_condition_first_becomes_true():
    # Close price drops under 5 on day index 2 and stays under 5 afterwards.
    # A naive "condition is true" signal would buy every day 2-4; the
    # crossing pattern should buy only on the day it first becomes true.
    prices = _prices([10, 10, 4, 3, 2])
    rules = {"buy": {"all": [{"indicator": "price", "op": "<", "value": 5}]}}
    strategy = CustomStrategy(rules=rules)

    signals = strategy.generate_signals(prices)

    assert list(signals[signals == 1].index) == [prices.index[2]]


def test_custom_strategy_requires_all_conditions_in_a_group():
    prices = _prices([100, 100, 100, 100, 100])
    # RSI needs history to be defined; use price + a condition that's never true
    # so only the AND combination matters, not each condition individually.
    rules = {
        "buy": {
            "all": [
                {"indicator": "price", "op": ">", "value": 50},
                {"indicator": "price", "op": "<", "value": 10},  # never true
            ]
        }
    }
    strategy = CustomStrategy(rules=rules)

    signals = strategy.generate_signals(prices)

    assert (signals == 0).all()


def test_custom_strategy_buy_and_sell_rules():
    closes = [10, 10, 4, 4, 20, 20]
    prices = _prices(closes)
    rules = {
        "buy": {"all": [{"indicator": "price", "op": "<", "value": 5}]},
        "sell": {"all": [{"indicator": "price", "op": ">", "value": 15}]},
    }
    strategy = CustomStrategy(rules=rules)

    signals = strategy.generate_signals(prices)

    assert signals[prices.index[2]] == 1
    assert signals[prices.index[4]] == -1
    assert signals.drop([prices.index[2], prices.index[4]]).eq(0).all()


def test_custom_strategy_empty_rules_never_signals():
    prices = _prices([1, 2, 3, 4])
    strategy = CustomStrategy(rules={})
    signals = strategy.generate_signals(prices)
    assert (signals == 0).all()


def test_custom_strategy_compute_indicators_skips_price_and_dedupes():
    prices = _prices([float(100 + i) for i in range(30)])
    rules = {
        "buy": {"all": [{"indicator": "rsi", "period": 14, "op": "<", "value": 30}]},
        "sell": {
            "all": [
                {"indicator": "rsi", "period": 14, "op": ">", "value": 70},
                {"indicator": "price", "op": ">", "value": 0},
            ]
        },
    }
    strategy = CustomStrategy(rules=rules)

    computed = strategy.compute_indicators(prices)

    assert list(computed.keys()) == ["rsi_14"]


def test_custom_strategy_create_rejects_missing_period_even_when_omitted():
    # `period` is optional at the JSON level (so "price" conditions can omit
    # it) but is required for rsi/sma - the omitted-field case is what
    # exercises Pydantic's "validators don't run on defaulted fields" trap.
    with pytest.raises(ValidationError):
        CustomStrategyCreate(
            name="bad",
            rules={"buy": {"all": [{"indicator": "rsi", "op": "<", "value": 30}]}},
        )


def test_custom_strategy_create_rejects_empty_rules():
    with pytest.raises(ValidationError):
        CustomStrategyCreate(name="bad", rules={})


def test_custom_strategy_create_accepts_price_condition_without_period():
    created = CustomStrategyCreate(
        name="ok",
        rules={"buy": {"all": [{"indicator": "price", "op": "<", "value": 100}]}},
    )
    assert created.rules.buy.all[0].period is None


def test_build_strategy_constructs_custom_strategy_from_registry():
    strategy = build_strategy(
        StrategyType.CUSTOM,
        {"rules": {"buy": {"all": [{"indicator": "price", "op": "<", "value": 5}]}}},
    )
    assert isinstance(strategy, CustomStrategy)
    assert strategy.rules["buy"]["all"][0]["indicator"] == "price"
