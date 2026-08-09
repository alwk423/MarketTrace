import operator

import pandas as pd

from app.services.indicators import get_indicator_series
from app.services.strategies.base import Strategy

OPERATORS = {
    "<": operator.lt,
    "<=": operator.le,
    ">": operator.gt,
    ">=": operator.ge,
    "==": operator.eq,
    "!=": operator.ne,
}


class CustomStrategy(Strategy):
    """Evaluates user-built buy/sell rules.

    `rules` looks like:
        {"buy": {"all": [{"indicator": "rsi", "period": 14, "op": "<", "value": 30}]},
         "sell": {"all": [{"indicator": "rsi", "period": 14, "op": ">", "value": 70}]}}

    Each condition in a group is ANDed together (v1 only supports "all"). A
    signal fires the day the whole group's conditions first become true
    together (not every day they stay true) - the same "state -> one-time
    event" crossing pattern the built-in SMA/RSI strategies use, generalized
    to an arbitrary condition instead of a hardcoded threshold.
    """

    def __init__(self, rules: dict | None = None, **params):
        super().__init__(rules=rules, **params)
        self.rules = rules or {}

    def _condition_series(self, prices: pd.DataFrame, condition: dict) -> pd.Series:
        indicator = get_indicator_series(prices, condition["indicator"], condition.get("period"))
        compare = OPERATORS[condition["op"]]
        return compare(indicator, condition["value"]).fillna(False)

    def _group_state(self, prices: pd.DataFrame, group: dict) -> pd.Series:
        conditions = group.get("all") or []
        if not conditions:
            return pd.Series(False, index=prices.index)

        state = pd.Series(True, index=prices.index)
        for condition in conditions:
            state &= self._condition_series(prices, condition)
        return state

    def generate_signals(self, prices: pd.DataFrame) -> pd.Series:
        signals = pd.Series(0, index=prices.index)  # default: hold, every day

        buy_group = self.rules.get("buy")
        if buy_group:
            buy_state = self._group_state(prices, buy_group)
            # True today AND False yesterday - the group just turned on. Buys
            # once, on the transition, not every day the state stays true.
            buy_event = buy_state & ~buy_state.shift(1, fill_value=False)
            signals[buy_event] = 1

        sell_group = self.rules.get("sell")
        if sell_group:
            sell_state = self._group_state(prices, sell_group)
            # Same true-today-false-yesterday check, mirrored for the sell group.
            sell_event = sell_state & ~sell_state.shift(1, fill_value=False)
            signals[sell_event] = -1

        return signals

    def compute_indicators(self, prices: pd.DataFrame) -> dict:
        # Every distinct indicator referenced across buy/sell rules, so the
        # chart can plot the same series the rules evaluate against. `price`
        # is skipped - it's identical to the price line already on the chart.
        series_by_key: dict[str, pd.Series] = {}
        for group in self.rules.values():
            for condition in (group or {}).get("all") or []:
                if condition["indicator"] == "price":
                    continue
                key = f"{condition['indicator']}_{condition.get('period')}"
                # Same indicator/period can appear in both buy and sell rules
                # (e.g. rsi_14 in both) - only compute it the first time.
                if key not in series_by_key:
                    series_by_key[key] = get_indicator_series(
                        prices, condition["indicator"], condition.get("period")
                    )
        return series_by_key
